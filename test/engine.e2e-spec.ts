/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { LoggerModule } from 'nestjs-pino';
import { RulesModule } from '../src/rules/rules.module';
import { RuleTemplatesModule } from '../src/rule-templates/rule-templates.module';
import { TemplateOverridesModule } from '../src/template-overrides/template-overrides.module';
import { EngineModule } from '../src/engine/engine.module';
import { Rule } from '../src/rules/entities/rule.entity';
import { RuleTemplate } from '../src/rule-templates/entities/rule-template.entity';
import { TemplateOverride } from '../src/template-overrides/entities/template-override.entity';
import { AllExceptionsFilter } from '../src/common/filters';
import { DataSource } from 'typeorm';
import configuration from '../src/config/configuration';
import { validationSchema } from '../src/config/validation.schema';
import { randomUUID } from 'crypto';

describe('EngineController (e2e)', () => {
  const generateUUID = () => randomUUID();
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let testTemplate: RuleTemplate;
  const organizationId = generateUUID();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
          load: [configuration],
          validationSchema,
        }),
        EventEmitterModule.forRoot(),
        LoggerModule.forRoot({
          pinoHttp: {
            level: 'silent',
          },
        }),
        PrometheusModule.register({
          path: '/metrics',
          defaultMetrics: { enabled: false },
        }),
        TypeOrmModule.forRootAsync({
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get<string>('database.host'),
            port: configService.get<number>('database.port'),
            username: configService.get<string>('database.username'),
            password: configService.get<string>('database.password'),
            database: configService.get<string>('database.name'),
            entities: [RuleTemplate, TemplateOverride, Rule],
            synchronize: true,
            dropSchema: true,
          }),
          inject: [ConfigService],
        }),
        RuleTemplatesModule,
        TemplateOverridesModule,
        RulesModule,
        EngineModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api', {
      exclude: ['health', 'metrics'],
    });

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "rules" CASCADE');
    await dataSource.query('TRUNCATE TABLE "template_overrides" CASCADE');
    await dataSource.query('TRUNCATE TABLE "rule_templates" CASCADE');

    testTemplate = await dataSource.getRepository(RuleTemplate).save({
      name: 'High Amount Alert',
      config: {
        conditions: {
          all: [
            {
              fact: 'transaction.amount',
              operator: 'greaterThan',
              value: 10000,
            },
          ],
        },
        event: {
          type: 'high-amount-alert',
          params: { severity: 'HIGH', category: 'AML' },
        },
      },
    });
  });

  const createTestTransaction = (overrides: Record<string, unknown> = {}) => ({
    id: generateUUID(),
    idAccount: generateUUID(),
    amount: 5000,
    amountNormalized: 5000,
    currency: 'USD',
    type: 'CASH_IN',
    datetime: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    country: 'US',
    ...overrides,
  });

  describe('POST /api/engine/evaluate', () => {
    it('should return empty events when no rules exist', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', organizationId)
        .send({ transaction: createTestTransaction() })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.events).toHaveLength(0);
      expect(response.body.evaluatedRulesCount).toBe(0);
      expect(response.body.evaluationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should trigger event when rule conditions are met', async () => {
      const triggerTestOrgId = generateUUID();

      // Create a rule that will trigger
      await dataSource.getRepository(Rule).save({
        idOrganization: triggerTestOrgId,
        name: 'High Amount Rule',
        enabled: true,
        priority: 0,
        config: {
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 1000,
              },
            ],
          },
          event: {
            type: 'amount-exceeded',
            params: { severity: 'HIGH' },
          },
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', triggerTestOrgId)
        .send({ transaction: createTestTransaction({ amount: 5000 }) })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].type).toBe('amount-exceeded');
      expect(response.body.events[0].params.severity).toBe('HIGH');
      expect(response.body.evaluatedRulesCount).toBe(1);
    });

    it('should not trigger event when conditions are not met', async () => {
      const noTriggerTestOrgId = generateUUID();

      await dataSource.getRepository(Rule).save({
        idOrganization: noTriggerTestOrgId,
        name: 'High Amount Rule',
        enabled: true,
        priority: 0,
        config: {
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 10000,
              },
            ],
          },
          event: { type: 'amount-exceeded', params: {} },
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', noTriggerTestOrgId)
        .send({ transaction: createTestTransaction({ amount: 5000 }) })
        .expect(201);

      expect(response.body.events).toHaveLength(0);
      expect(response.body.evaluatedRulesCount).toBe(1);
    });

    it('should only evaluate enabled rules', async () => {
      const enabledTestOrgId = generateUUID();

      await dataSource.getRepository(Rule).save([
        {
          idOrganization: enabledTestOrgId,
          name: 'Enabled Rule',
          enabled: true,
          priority: 0,
          config: {
            conditions: {
              all: [
                {
                  fact: 'transaction.amount',
                  operator: 'greaterThan',
                  value: 100,
                },
              ],
            },
            event: { type: 'enabled-alert', params: {} },
          },
        },
        {
          idOrganization: enabledTestOrgId,
          name: 'Disabled Rule',
          enabled: false,
          priority: 1,
          config: {
            conditions: {
              all: [
                {
                  fact: 'transaction.amount',
                  operator: 'greaterThan',
                  value: 100,
                },
              ],
            },
            event: { type: 'disabled-alert', params: {} },
          },
        },
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', enabledTestOrgId)
        .send({ transaction: createTestTransaction({ amount: 5000 }) })
        .expect(201);

      expect(response.body.evaluatedRulesCount).toBe(1);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].type).toBe('enabled-alert');
    });

    it('should evaluate rules in priority order', async () => {
      const priorityTestOrgId = generateUUID();

      await dataSource.getRepository(Rule).save([
        {
          idOrganization: priorityTestOrgId,
          name: 'Low Priority',
          enabled: true,
          priority: 10,
          config: {
            conditions: {
              all: [
                {
                  fact: 'transaction.amount',
                  operator: 'greaterThan',
                  value: 100,
                },
              ],
            },
            event: { type: 'low-priority', params: { order: 2 } },
          },
        },
        {
          idOrganization: priorityTestOrgId,
          name: 'High Priority',
          enabled: true,
          priority: 1,
          config: {
            conditions: {
              all: [
                {
                  fact: 'transaction.amount',
                  operator: 'greaterThan',
                  value: 100,
                },
              ],
            },
            event: { type: 'high-priority', params: { order: 1 } },
          },
        },
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', priorityTestOrgId)
        .send({ transaction: createTestTransaction({ amount: 5000 }) })
        .expect(201);

      expect(response.body.events).toHaveLength(2);
      // High priority should be first
      expect(response.body.events[0].type).toBe('high-priority');
      expect(response.body.events[1].type).toBe('low-priority');
    });

    it('should use template config when rule has template', async () => {
      // Use a unique org ID
      const templateTestOrgId = generateUUID();

      await dataSource.getRepository(Rule).save({
        idOrganization: templateTestOrgId,
        idTemplate: testTemplate.id,
        name: 'Template Rule',
        enabled: true,
        priority: 0,
        config: {}, // Empty config, will use template
      });

      const response = await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', templateTestOrgId)
        .send({ transaction: createTestTransaction({ amount: 15000 }) })
        .expect(201);

      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].type).toBe('high-amount-alert');
      expect(response.body.events[0].params.severity).toBe('HIGH');
    });

    it('should apply template overrides', async () => {
      // Use a unique org ID for this test
      const overrideTestOrgId = generateUUID();

      // Create org-specific override that lowers the threshold
      await dataSource.getRepository(TemplateOverride).save({
        idOrganization: overrideTestOrgId,
        idTemplate: testTemplate.id,
        enabled: true,
        overrides: {
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 5000,
              },
            ],
          },
        },
      });

      await dataSource.getRepository(Rule).save({
        idOrganization: overrideTestOrgId,
        idTemplate: testTemplate.id,
        name: 'Override Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      // Amount 6000 should trigger with override (threshold 5000)
      const response = await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', overrideTestOrgId)
        .send({ transaction: createTestTransaction({ amount: 6000 }) })
        .expect(201);

      expect(response.body.events).toHaveLength(1);
    });

    it('should support country operators', async () => {
      // Use a unique org ID for this test
      const countryTestOrgId = generateUUID();

      await dataSource.getRepository(Rule).save({
        idOrganization: countryTestOrgId,
        name: 'Country Rule',
        enabled: true,
        priority: 0,
        config: {
          conditions: {
            all: [
              { fact: 'transaction.country', operator: 'equal', value: 'US' },
            ],
          },
          event: { type: 'domestic-transaction', params: {} },
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', countryTestOrgId)
        .send({ transaction: createTestTransaction({ country: 'US' }) })
        .expect(201);

      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].type).toBe('domestic-transaction');
    });

    it('should not evaluate rules from other organizations', async () => {
      const otherOrgId = generateUUID();

      await dataSource.getRepository(Rule).save({
        idOrganization: otherOrgId,
        name: 'Other Org Rule',
        enabled: true,
        priority: 0,
        config: {
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 100,
              },
            ],
          },
          event: { type: 'other-org-alert', params: {} },
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', organizationId)
        .send({ transaction: createTestTransaction({ amount: 5000 }) })
        .expect(201);

      expect(response.body.events).toHaveLength(0);
    });

    it('should fail without organization header', async () => {
      await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .send({ transaction: createTestTransaction() })
        .expect(400);
    });

    it('should validate transaction data', async () => {
      await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', organizationId)
        .send({ transaction: { id: 'missing-fields' } })
        .expect(400);
    });
  });

  describe('POST /api/engine/evaluate/:ruleId', () => {
    it('should evaluate a single rule', async () => {
      const rule = await dataSource.getRepository(Rule).save({
        idOrganization: organizationId,
        name: 'Single Rule',
        enabled: true,
        priority: 0,
        config: {
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 100,
              },
            ],
          },
          event: { type: 'single-alert', params: {} },
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/engine/evaluate/${rule.id}`)
        .set('x-organization-id', organizationId)
        .send({ transaction: createTestTransaction({ amount: 5000 }) })
        .expect(201);

      expect(response.body.evaluatedRulesCount).toBe(1);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].type).toBe('single-alert');
      expect(response.body.events[0].params.ruleId).toBe(rule.id);
    });

    it('should return 404 for non-existent rule', async () => {
      const fakeRuleId = generateUUID();

      const response = await request(app.getHttpServer())
        .post(`/api/engine/evaluate/${fakeRuleId}`)
        .set('x-organization-id', organizationId)
        .send({ transaction: createTestTransaction() })
        .expect(201);

      // Fail-open: returns result with failed rule
      expect(response.body.success).toBe(false);
      expect(response.body.failedRules).toHaveLength(1);
    });

    it('should not evaluate rule from different organization', async () => {
      const otherOrgId = generateUUID();
      const rule = await dataSource.getRepository(Rule).save({
        idOrganization: otherOrgId,
        name: 'Other Org Rule',
        enabled: true,
        priority: 0,
        config: {
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 100,
              },
            ],
          },
          event: { type: 'alert', params: {} },
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/engine/evaluate/${rule.id}`)
        .set('x-organization-id', organizationId)
        .send({ transaction: createTestTransaction() })
        .expect(201);

      // Fail-open: returns result with failed rule (not found)
      expect(response.body.success).toBe(false);
      expect(response.body.failedRules).toHaveLength(1);
    });
  });

  describe('Cache invalidation', () => {
    it('should invalidate cache when rule is created', async () => {
      // Use a unique org ID for this test to avoid cache pollution
      const cacheTestOrgId = generateUUID();

      // First evaluation with no rules
      let response = await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', cacheTestOrgId)
        .send({ transaction: createTestTransaction({ amount: 5000 }) })
        .expect(201);

      expect(response.body.events).toHaveLength(0);

      // Create a rule
      await request(app.getHttpServer())
        .post('/api/rules')
        .set('x-organization-id', cacheTestOrgId)
        .send({
          name: 'New Rule',
          enabled: true,
          config: {
            conditions: {
              all: [
                {
                  fact: 'transaction.amount',
                  operator: 'greaterThan',
                  value: 100,
                },
              ],
            },
            event: { type: 'new-alert', params: {} },
          },
        })
        .expect(201);

      // Second evaluation should pick up the new rule
      response = await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', cacheTestOrgId)
        .send({ transaction: createTestTransaction({ amount: 5000 }) })
        .expect(201);

      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].type).toBe('new-alert');
    });

    it('should invalidate cache when rule is updated', async () => {
      // Use a unique org ID for this test to avoid cache pollution
      const updateTestOrgId = generateUUID();

      const rule = await dataSource.getRepository(Rule).save({
        idOrganization: updateTestOrgId,
        name: 'Update Rule',
        enabled: true,
        priority: 0,
        config: {
          conditions: {
            all: [
              {
                fact: 'transaction.amount',
                operator: 'greaterThan',
                value: 10000,
              },
            ],
          },
          event: { type: 'original-alert', params: {} },
        },
      });

      // First evaluation - should not trigger (5000 < 10000)
      let response = await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', updateTestOrgId)
        .send({ transaction: createTestTransaction({ amount: 5000 }) })
        .expect(201);

      expect(response.body.events).toHaveLength(0);

      // Update rule to lower threshold
      await request(app.getHttpServer())
        .patch(`/api/rules/${rule.id}`)
        .set('x-organization-id', updateTestOrgId)
        .send({
          config: {
            conditions: {
              all: [
                {
                  fact: 'transaction.amount',
                  operator: 'greaterThan',
                  value: 1000,
                },
              ],
            },
            event: { type: 'updated-alert', params: {} },
          },
        })
        .expect(200);

      // Second evaluation - should trigger with updated config
      response = await request(app.getHttpServer())
        .post('/api/engine/evaluate')
        .set('x-organization-id', updateTestOrgId)
        .send({ transaction: createTestTransaction({ amount: 5000 }) })
        .expect(201);

      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].type).toBe('updated-alert');
    });
  });
});
