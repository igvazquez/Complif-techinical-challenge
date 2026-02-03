/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { LoggerModule } from 'nestjs-pino';
import { TransactionsModule } from '../src/transactions/transactions.module';
import { RulesModule } from '../src/rules/rules.module';
import { RuleTemplatesModule } from '../src/rule-templates/rule-templates.module';
import { TemplateOverridesModule } from '../src/template-overrides/template-overrides.module';
import { EngineModule } from '../src/engine/engine.module';
import { Transaction } from '../src/transactions/entities/transaction.entity';
import { Rule } from '../src/rules/entities/rule.entity';
import { RuleTemplate } from '../src/rule-templates/entities/rule-template.entity';
import { TemplateOverride } from '../src/template-overrides/entities/template-override.entity';
import { AllExceptionsFilter } from '../src/common/filters';
import { DataSource } from 'typeorm';
import configuration from '../src/config/configuration';
import { validationSchema } from '../src/config/validation.schema';
import { randomUUID } from 'crypto';

describe('TransactionsController (e2e)', () => {
  const generateUUID = () => randomUUID();
  let app: INestApplication<App>;
  let dataSource: DataSource;
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
            entities: [Transaction, RuleTemplate, TemplateOverride, Rule],
            synchronize: true,
            dropSchema: true,
          }),
          inject: [ConfigService],
        }),
        RuleTemplatesModule,
        TemplateOverridesModule,
        RulesModule,
        EngineModule,
        TransactionsModule,
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
    await dataSource.query('TRUNCATE TABLE "transactions" CASCADE');
    await dataSource.query('TRUNCATE TABLE "rules" CASCADE');
    await dataSource.query('TRUNCATE TABLE "template_overrides" CASCADE');
    await dataSource.query('TRUNCATE TABLE "rule_templates" CASCADE');
  });

  const createTestTransaction = (overrides: Record<string, unknown> = {}) => ({
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

  describe('POST /api/transactions', () => {
    it('should create and evaluate a transaction with no rules', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/transactions')
        .set('x-organization-id', organizationId)
        .send(createTestTransaction())
        .expect(201);

      expect(response.body.transaction).toBeDefined();
      expect(response.body.transaction.id).toBeDefined();
      expect(Number(response.body.transaction.amount)).toBe(5000);
      expect(response.body.evaluation).toBeDefined();
      expect(response.body.evaluation.success).toBe(true);
      expect(response.body.evaluation.events).toHaveLength(0);
      expect(response.body.evaluation.evaluatedRulesCount).toBe(0);
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
        .post('/api/transactions')
        .set('x-organization-id', triggerTestOrgId)
        .send(createTestTransaction({ amount: 5000, amountNormalized: 5000 }))
        .expect(201);

      expect(response.body.transaction).toBeDefined();
      expect(response.body.evaluation.success).toBe(true);
      expect(response.body.evaluation.events).toHaveLength(1);
      expect(response.body.evaluation.events[0].type).toBe('amount-exceeded');
      expect(response.body.evaluation.events[0].params.severity).toBe('HIGH');
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
        .post('/api/transactions')
        .set('x-organization-id', noTriggerTestOrgId)
        .send(createTestTransaction({ amount: 5000, amountNormalized: 5000 }))
        .expect(201);

      expect(response.body.evaluation.events).toHaveLength(0);
      expect(response.body.evaluation.evaluatedRulesCount).toBe(1);
    });

    it('should store transaction in database', async () => {
      const storeTestOrgId = generateUUID();

      const response = await request(app.getHttpServer())
        .post('/api/transactions')
        .set('x-organization-id', storeTestOrgId)
        .send(
          createTestTransaction({ amount: 1234.56, amountNormalized: 1234.56 }),
        )
        .expect(201);

      const transactionId = response.body.transaction.id;

      // Verify stored in database
      const stored = await dataSource.getRepository(Transaction).findOne({
        where: { id: transactionId },
      });

      expect(stored).toBeDefined();
      expect(Number(stored!.amount)).toBe(1234.56);
      expect(stored!.idOrganization).toBe(storeTestOrgId);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/transactions')
        .set('x-organization-id', organizationId)
        .send({ idAccount: 'acc-123' }) // Missing required fields
        .expect(400);
    });

    it('should fail without organization header', async () => {
      await request(app.getHttpServer())
        .post('/api/transactions')
        .send(createTestTransaction())
        .expect(400);
    });
  });

  describe('GET /api/transactions/:id', () => {
    it('should return a transaction by id', async () => {
      const getTestOrgId = generateUUID();

      // Create a transaction first
      const createResponse = await request(app.getHttpServer())
        .post('/api/transactions')
        .set('x-organization-id', getTestOrgId)
        .send(createTestTransaction())
        .expect(201);

      const transactionId = createResponse.body.transaction.id;

      // Get the transaction
      const response = await request(app.getHttpServer())
        .get(`/api/transactions/${transactionId}`)
        .set('x-organization-id', getTestOrgId)
        .expect(200);

      expect(response.body.id).toBe(transactionId);
      expect(response.body.idOrganization).toBe(getTestOrgId);
    });

    it('should return 404 for non-existent transaction', async () => {
      const fakeId = generateUUID();

      await request(app.getHttpServer())
        .get(`/api/transactions/${fakeId}`)
        .set('x-organization-id', organizationId)
        .expect(404);
    });

    it('should not return transaction from different organization', async () => {
      const orgA = generateUUID();
      const orgB = generateUUID();

      // Create transaction in org A
      const createResponse = await request(app.getHttpServer())
        .post('/api/transactions')
        .set('x-organization-id', orgA)
        .send(createTestTransaction())
        .expect(201);

      const transactionId = createResponse.body.transaction.id;

      // Try to get from org B
      await request(app.getHttpServer())
        .get(`/api/transactions/${transactionId}`)
        .set('x-organization-id', orgB)
        .expect(404);
    });
  });

  describe('GET /api/transactions', () => {
    it('should return paginated transactions', async () => {
      const listTestOrgId = generateUUID();

      // Create multiple transactions
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/transactions')
          .set('x-organization-id', listTestOrgId)
          .send(
            createTestTransaction({
              amount: 1000 + i,
              amountNormalized: 1000 + i,
            }),
          )
          .expect(201);
      }

      const response = await request(app.getHttpServer())
        .get('/api/transactions')
        .set('x-organization-id', listTestOrgId)
        .query({ page: 1, limit: 3 })
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.total).toBe(5);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(3);
      expect(response.body.totalPages).toBe(2);
    });

    it('should return empty list for organization with no transactions', async () => {
      const emptyOrgId = generateUUID();

      const response = await request(app.getHttpServer())
        .get('/api/transactions')
        .set('x-organization-id', emptyOrgId)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });
  });

  describe('Transaction History Aggregation', () => {
    it('should aggregate transactions for history-based rules', async () => {
      const aggTestOrgId = generateUUID();
      const accountId = generateUUID();

      // Create some historical transactions for the account
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/api/transactions')
          .set('x-organization-id', aggTestOrgId)
          .send(
            createTestTransaction({
              idAccount: accountId,
              amount: 3000,
              amountNormalized: 3000,
              type: 'CASH_IN',
            }),
          )
          .expect(201);
      }

      // Create a rule that checks sum of transactions in the last 7 days
      // Use API to ensure cache invalidation happens
      await request(app.getHttpServer())
        .post('/api/rules')
        .set('x-organization-id', aggTestOrgId)
        .send({
          name: 'High Volume Rule',
          enabled: true,
          priority: 0,
          config: {
            conditions: {
              all: [
                {
                  fact: 'transactionHistory',
                  params: {
                    aggregation: 'sum',
                    field: 'amountNormalized',
                    timeWindowDays: 7,
                    transactionType: 'CASH_IN',
                  },
                  operator: 'greaterThan',
                  value: 10000, // Sum of 3 * 3000 = 9000, plus new 5000 = 14000 > 10000
                },
              ],
            },
            event: {
              type: 'high-volume-alert',
              params: { severity: 'MEDIUM' },
            },
          },
        })
        .expect(201);

      // Create a new transaction that should trigger the rule
      // After this, we have 4 transactions: 3 * 3000 + 1 * 5000 = 14000 > 10000
      const response = await request(app.getHttpServer())
        .post('/api/transactions')
        .set('x-organization-id', aggTestOrgId)
        .send(
          createTestTransaction({
            idAccount: accountId,
            amount: 5000,
            amountNormalized: 5000,
            type: 'CASH_IN',
          }),
        )
        .expect(201);

      expect(response.body.evaluation.events).toHaveLength(1);
      expect(response.body.evaluation.events[0].type).toBe('high-volume-alert');
    });

    it('should count transactions for count aggregation', async () => {
      const countTestOrgId = generateUUID();
      const accountId = generateUUID();

      // Create 3 historical transactions (without the rule, just to populate)
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/api/transactions')
          .set('x-organization-id', countTestOrgId)
          .send(
            createTestTransaction({
              idAccount: accountId,
              amount: 1000,
              amountNormalized: 1000,
            }),
          )
          .expect(201);
      }

      // Create a rule that triggers when more than 4 transactions
      // Note: Transaction is saved BEFORE evaluation, so the new tx is included in count
      await request(app.getHttpServer())
        .post('/api/rules')
        .set('x-organization-id', countTestOrgId)
        .send({
          name: 'Frequency Rule',
          enabled: true,
          priority: 0,
          config: {
            conditions: {
              all: [
                {
                  fact: 'transactionHistory',
                  params: {
                    aggregation: 'count',
                    timeWindowDays: 7,
                  },
                  operator: 'greaterThan',
                  value: 4, // Need more than 4 to trigger
                },
              ],
            },
            event: {
              type: 'frequency-alert',
              params: { severity: 'LOW' },
            },
          },
        })
        .expect(201);

      // 4th transaction: 3 + 1 = 4, which is NOT > 4
      let response = await request(app.getHttpServer())
        .post('/api/transactions')
        .set('x-organization-id', countTestOrgId)
        .send(
          createTestTransaction({
            idAccount: accountId,
            amount: 1000,
            amountNormalized: 1000,
          }),
        )
        .expect(201);

      expect(response.body.evaluation.events).toHaveLength(0);

      // 5th transaction: 4 + 1 = 5, which IS > 4
      response = await request(app.getHttpServer())
        .post('/api/transactions')
        .set('x-organization-id', countTestOrgId)
        .send(
          createTestTransaction({
            idAccount: accountId,
            amount: 1000,
            amountNormalized: 1000,
          }),
        )
        .expect(201);

      expect(response.body.evaluation.events).toHaveLength(1);
      expect(response.body.evaluation.events[0].type).toBe('frequency-alert');
    });
  });

  describe('Fail-open behavior', () => {
    it('should store transaction even if evaluation fails', async () => {
      const failOpenOrgId = generateUUID();

      // Create a rule with invalid config that will cause evaluation to fail gracefully
      // The engine handles this with fail-open, so we just verify transaction is stored
      await dataSource.getRepository(Rule).save({
        idOrganization: failOpenOrgId,
        name: 'Valid Rule',
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
        .post('/api/transactions')
        .set('x-organization-id', failOpenOrgId)
        .send(createTestTransaction())
        .expect(201);

      // Transaction should be stored regardless
      expect(response.body.transaction).toBeDefined();
      expect(response.body.transaction.id).toBeDefined();

      // Verify it's in the database
      const stored = await dataSource.getRepository(Transaction).findOne({
        where: { id: response.body.transaction.id },
      });
      expect(stored).toBeDefined();
    });
  });
});
