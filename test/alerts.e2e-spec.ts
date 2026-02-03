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
import { AlertsModule } from '../src/alerts/alerts.module';
import { TransactionsModule } from '../src/transactions/transactions.module';
import { RulesModule } from '../src/rules/rules.module';
import { RuleTemplatesModule } from '../src/rule-templates/rule-templates.module';
import { TemplateOverridesModule } from '../src/template-overrides/template-overrides.module';
import { EngineModule } from '../src/engine/engine.module';
import { Alert } from '../src/alerts/entities/alert.entity';
import { Transaction } from '../src/transactions/entities/transaction.entity';
import { Rule } from '../src/rules/entities/rule.entity';
import { RuleTemplate } from '../src/rule-templates/entities/rule-template.entity';
import { TemplateOverride } from '../src/template-overrides/entities/template-override.entity';
import { AllExceptionsFilter } from '../src/common/filters';
import { DataSource } from 'typeorm';
import configuration from '../src/config/configuration';
import { validationSchema } from '../src/config/validation.schema';
import { randomUUID } from 'crypto';
import {
  AlertStatus,
  AlertSeverity,
  AlertCategory,
} from '../src/alerts/entities/alert.entity';

describe('AlertsController (e2e)', () => {
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
            entities: [
              Alert,
              Transaction,
              RuleTemplate,
              TemplateOverride,
              Rule,
            ],
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
        AlertsModule,
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
    await dataSource.query('TRUNCATE TABLE "alerts" CASCADE');
    await dataSource.query('TRUNCATE TABLE "transactions" CASCADE');
    await dataSource.query('TRUNCATE TABLE "rules" CASCADE');
    await dataSource.query('TRUNCATE TABLE "template_overrides" CASCADE');
    await dataSource.query('TRUNCATE TABLE "rule_templates" CASCADE');
  });

  const createTestAlert = async (
    orgId: string,
    ruleId: string,
    transactionId: string,
    overrides: Partial<Alert> = {},
  ) => {
    const alert = dataSource.getRepository(Alert).create({
      idOrganization: orgId,
      idRule: ruleId,
      idTransaction: transactionId,
      idAccount: 'acc-123',
      severity: AlertSeverity.HIGH,
      category: AlertCategory.FRAUD,
      status: AlertStatus.OPEN,
      hitCount: 1,
      firstTriggeredAt: new Date(),
      lastTriggeredAt: new Date(),
      dedupKey: `${ruleId}:acc-123:${new Date().toISOString().split('T')[0]}`,
      metadata: {},
      ...overrides,
    });
    return dataSource.getRepository(Alert).save(alert);
  };

  describe('GET /api/alerts', () => {
    it('should return empty list when no alerts exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/alerts')
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });

    it('should return paginated alerts', async () => {
      const testOrgId = generateUUID();

      // Create rule and transaction first
      const rule = await dataSource.getRepository(Rule).save({
        idOrganization: testOrgId,
        name: 'Test Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      const tx = await dataSource.getRepository(Transaction).save({
        idOrganization: testOrgId,
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date(),
        date: new Date().toISOString().split('T')[0],
        data: {},
      });

      // Create multiple alerts
      for (let i = 0; i < 5; i++) {
        await createTestAlert(testOrgId, rule.id, tx.id, {
          dedupKey: `${rule.id}:acc-123:key-${i}`,
        });
      }

      const response = await request(app.getHttpServer())
        .get('/api/alerts')
        .set('x-organization-id', testOrgId)
        .query({ page: 1, limit: 3 })
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.total).toBe(5);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(3);
      expect(response.body.totalPages).toBe(2);
    });

    it('should filter alerts by status', async () => {
      const testOrgId = generateUUID();

      const rule = await dataSource.getRepository(Rule).save({
        idOrganization: testOrgId,
        name: 'Test Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      const tx = await dataSource.getRepository(Transaction).save({
        idOrganization: testOrgId,
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date(),
        date: new Date().toISOString().split('T')[0],
        data: {},
      });

      await createTestAlert(testOrgId, rule.id, tx.id, {
        status: AlertStatus.OPEN,
        dedupKey: 'key-1',
      });
      await createTestAlert(testOrgId, rule.id, tx.id, {
        status: AlertStatus.ACKNOWLEDGED,
        dedupKey: 'key-2',
      });
      await createTestAlert(testOrgId, rule.id, tx.id, {
        status: AlertStatus.RESOLVED,
        dedupKey: 'key-3',
      });

      const response = await request(app.getHttpServer())
        .get('/api/alerts')
        .set('x-organization-id', testOrgId)
        .query({ status: 'OPEN' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('OPEN');
    });

    it('should filter alerts by severity', async () => {
      const testOrgId = generateUUID();

      const rule = await dataSource.getRepository(Rule).save({
        idOrganization: testOrgId,
        name: 'Test Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      const tx = await dataSource.getRepository(Transaction).save({
        idOrganization: testOrgId,
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date(),
        date: new Date().toISOString().split('T')[0],
        data: {},
      });

      await createTestAlert(testOrgId, rule.id, tx.id, {
        severity: AlertSeverity.HIGH,
        dedupKey: 'key-1',
      });
      await createTestAlert(testOrgId, rule.id, tx.id, {
        severity: AlertSeverity.LOW,
        dedupKey: 'key-2',
      });

      const response = await request(app.getHttpServer())
        .get('/api/alerts')
        .set('x-organization-id', testOrgId)
        .query({ severity: 'HIGH' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].severity).toBe('HIGH');
    });

    it('should filter alerts by category', async () => {
      const testOrgId = generateUUID();

      const rule = await dataSource.getRepository(Rule).save({
        idOrganization: testOrgId,
        name: 'Test Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      const tx = await dataSource.getRepository(Transaction).save({
        idOrganization: testOrgId,
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date(),
        date: new Date().toISOString().split('T')[0],
        data: {},
      });

      await createTestAlert(testOrgId, rule.id, tx.id, {
        category: AlertCategory.FRAUD,
        dedupKey: 'key-1',
      });
      await createTestAlert(testOrgId, rule.id, tx.id, {
        category: AlertCategory.AML,
        dedupKey: 'key-2',
      });

      const response = await request(app.getHttpServer())
        .get('/api/alerts')
        .set('x-organization-id', testOrgId)
        .query({ category: 'FRAUD' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].category).toBe('FRAUD');
    });

    it('should filter alerts by ruleId', async () => {
      const testOrgId = generateUUID();

      const rule1 = await dataSource.getRepository(Rule).save({
        idOrganization: testOrgId,
        name: 'Rule 1',
        enabled: true,
        priority: 0,
        config: {},
      });

      const rule2 = await dataSource.getRepository(Rule).save({
        idOrganization: testOrgId,
        name: 'Rule 2',
        enabled: true,
        priority: 0,
        config: {},
      });

      const tx = await dataSource.getRepository(Transaction).save({
        idOrganization: testOrgId,
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date(),
        date: new Date().toISOString().split('T')[0],
        data: {},
      });

      await createTestAlert(testOrgId, rule1.id, tx.id, {
        dedupKey: 'key-1',
      });
      await createTestAlert(testOrgId, rule2.id, tx.id, {
        dedupKey: 'key-2',
      });

      const response = await request(app.getHttpServer())
        .get('/api/alerts')
        .set('x-organization-id', testOrgId)
        .query({ ruleId: rule1.id })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].idRule).toBe(rule1.id);
    });
  });

  describe('GET /api/alerts/:id', () => {
    it('should return alert by id', async () => {
      const testOrgId = generateUUID();

      const rule = await dataSource.getRepository(Rule).save({
        idOrganization: testOrgId,
        name: 'Test Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      const tx = await dataSource.getRepository(Transaction).save({
        idOrganization: testOrgId,
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date(),
        date: new Date().toISOString().split('T')[0],
        data: {},
      });

      const alert = await createTestAlert(testOrgId, rule.id, tx.id);

      const response = await request(app.getHttpServer())
        .get(`/api/alerts/${alert.id}`)
        .set('x-organization-id', testOrgId)
        .expect(200);

      expect(response.body.id).toBe(alert.id);
      expect(response.body.idOrganization).toBe(testOrgId);
      expect(response.body.severity).toBe('HIGH');
    });

    it('should return 404 for non-existent alert', async () => {
      const fakeId = generateUUID();

      await request(app.getHttpServer())
        .get(`/api/alerts/${fakeId}`)
        .set('x-organization-id', organizationId)
        .expect(404);
    });

    it('should not return alert from different organization', async () => {
      const orgA = generateUUID();
      const orgB = generateUUID();

      const rule = await dataSource.getRepository(Rule).save({
        idOrganization: orgA,
        name: 'Test Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      const tx = await dataSource.getRepository(Transaction).save({
        idOrganization: orgA,
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date(),
        date: new Date().toISOString().split('T')[0],
        data: {},
      });

      const alert = await createTestAlert(orgA, rule.id, tx.id);

      await request(app.getHttpServer())
        .get(`/api/alerts/${alert.id}`)
        .set('x-organization-id', orgB)
        .expect(404);
    });
  });

  describe('PATCH /api/alerts/:id', () => {
    it('should update alert status', async () => {
      const testOrgId = generateUUID();

      const rule = await dataSource.getRepository(Rule).save({
        idOrganization: testOrgId,
        name: 'Test Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      const tx = await dataSource.getRepository(Transaction).save({
        idOrganization: testOrgId,
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date(),
        date: new Date().toISOString().split('T')[0],
        data: {},
      });

      const alert = await createTestAlert(testOrgId, rule.id, tx.id);

      const response = await request(app.getHttpServer())
        .patch(`/api/alerts/${alert.id}`)
        .set('x-organization-id', testOrgId)
        .send({ status: 'ACKNOWLEDGED' })
        .expect(200);

      expect(response.body.status).toBe('ACKNOWLEDGED');

      // Verify in database
      const updated = await dataSource.getRepository(Alert).findOne({
        where: { id: alert.id },
      });
      expect(updated?.status).toBe('ACKNOWLEDGED');
    });

    it('should update to RESOLVED status', async () => {
      const testOrgId = generateUUID();

      const rule = await dataSource.getRepository(Rule).save({
        idOrganization: testOrgId,
        name: 'Test Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      const tx = await dataSource.getRepository(Transaction).save({
        idOrganization: testOrgId,
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date(),
        date: new Date().toISOString().split('T')[0],
        data: {},
      });

      const alert = await createTestAlert(testOrgId, rule.id, tx.id);

      const response = await request(app.getHttpServer())
        .patch(`/api/alerts/${alert.id}`)
        .set('x-organization-id', testOrgId)
        .send({ status: 'RESOLVED' })
        .expect(200);

      expect(response.body.status).toBe('RESOLVED');
    });

    it('should update to FALSE_POSITIVE status', async () => {
      const testOrgId = generateUUID();

      const rule = await dataSource.getRepository(Rule).save({
        idOrganization: testOrgId,
        name: 'Test Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      const tx = await dataSource.getRepository(Transaction).save({
        idOrganization: testOrgId,
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date(),
        date: new Date().toISOString().split('T')[0],
        data: {},
      });

      const alert = await createTestAlert(testOrgId, rule.id, tx.id);

      const response = await request(app.getHttpServer())
        .patch(`/api/alerts/${alert.id}`)
        .set('x-organization-id', testOrgId)
        .send({ status: 'FALSE_POSITIVE' })
        .expect(200);

      expect(response.body.status).toBe('FALSE_POSITIVE');
    });

    it('should return 400 for invalid status', async () => {
      const testOrgId = generateUUID();

      const rule = await dataSource.getRepository(Rule).save({
        idOrganization: testOrgId,
        name: 'Test Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      const tx = await dataSource.getRepository(Transaction).save({
        idOrganization: testOrgId,
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date(),
        date: new Date().toISOString().split('T')[0],
        data: {},
      });

      const alert = await createTestAlert(testOrgId, rule.id, tx.id);

      await request(app.getHttpServer())
        .patch(`/api/alerts/${alert.id}`)
        .set('x-organization-id', testOrgId)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });

    it('should return 404 for non-existent alert', async () => {
      const fakeId = generateUUID();

      await request(app.getHttpServer())
        .patch(`/api/alerts/${fakeId}`)
        .set('x-organization-id', organizationId)
        .send({ status: 'ACKNOWLEDGED' })
        .expect(404);
    });
  });

  describe('Organization isolation', () => {
    it('should not return alerts from other organizations', async () => {
      const orgA = generateUUID();
      const orgB = generateUUID();

      const ruleA = await dataSource.getRepository(Rule).save({
        idOrganization: orgA,
        name: 'Rule A',
        enabled: true,
        priority: 0,
        config: {},
      });

      const txA = await dataSource.getRepository(Transaction).save({
        idOrganization: orgA,
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date(),
        date: new Date().toISOString().split('T')[0],
        data: {},
      });

      await createTestAlert(orgA, ruleA.id, txA.id);

      // Query from org B should return empty
      const response = await request(app.getHttpServer())
        .get('/api/alerts')
        .set('x-organization-id', orgB)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });
});
