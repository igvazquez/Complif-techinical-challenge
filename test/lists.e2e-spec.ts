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
import { ListsModule } from '../src/lists/lists.module';
import {
  ListEntry,
  ListType,
  EntityType,
} from '../src/lists/entities/list-entry.entity';
import { AllExceptionsFilter } from '../src/common/filters';
import { DataSource } from 'typeorm';
import configuration from '../src/config/configuration';
import { validationSchema } from '../src/config/validation.schema';
import { randomUUID } from 'crypto';

describe('ListsController (e2e)', () => {
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
            entities: [ListEntry],
            synchronize: true,
            dropSchema: true,
          }),
          inject: [ConfigService],
        }),
        ListsModule,
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
    await dataSource.query('TRUNCATE TABLE "list_entries" CASCADE');
  });

  const createTestListEntry = async (
    orgId: string,
    overrides: Partial<ListEntry> = {},
  ) => {
    const entry = dataSource.getRepository(ListEntry).create({
      idOrganization: orgId,
      listType: ListType.BLACKLIST,
      entityType: EntityType.COUNTRY,
      entityValue: 'AR',
      reason: null,
      expiresAt: null,
      createdBy: null,
      ...overrides,
    });
    return dataSource.getRepository(ListEntry).save(entry);
  };

  describe('POST /api/lists', () => {
    it('should create a new list entry', async () => {
      const dto = {
        listType: 'BLACKLIST',
        entityType: 'COUNTRY',
        entityValue: 'AR',
        reason: 'High-risk jurisdiction',
      };

      const response = await request(app.getHttpServer())
        .post('/api/lists')
        .set('x-organization-id', organizationId)
        .send(dto)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.listType).toBe('BLACKLIST');
      expect(response.body.entityType).toBe('COUNTRY');
      expect(response.body.entityValue).toBe('AR');
      expect(response.body.reason).toBe('High-risk jurisdiction');
      expect(response.body.idOrganization).toBe(organizationId);
    });

    it('should create entry with expiration date', async () => {
      const expiresAt = '2025-12-31T23:59:59.000Z';
      const dto = {
        listType: 'WHITELIST',
        entityType: 'ACCOUNT',
        entityValue: 'acc-123',
        expiresAt,
      };

      const response = await request(app.getHttpServer())
        .post('/api/lists')
        .set('x-organization-id', organizationId)
        .send(dto)
        .expect(201);

      expect(response.body.expiresAt).toBe(expiresAt);
    });

    it('should return 409 for duplicate entry', async () => {
      const testOrgId = generateUUID();
      await createTestListEntry(testOrgId, {
        listType: ListType.BLACKLIST,
        entityType: EntityType.COUNTRY,
        entityValue: 'AR',
      });

      const dto = {
        listType: 'BLACKLIST',
        entityType: 'COUNTRY',
        entityValue: 'AR',
      };

      const response = await request(app.getHttpServer())
        .post('/api/lists')
        .set('x-organization-id', testOrgId)
        .send(dto)
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });

    it('should return 400 for invalid listType', async () => {
      const dto = {
        listType: 'INVALID',
        entityType: 'COUNTRY',
        entityValue: 'AR',
      };

      await request(app.getHttpServer())
        .post('/api/lists')
        .set('x-organization-id', organizationId)
        .send(dto)
        .expect(400);
    });

    it('should return 400 for invalid entityType', async () => {
      const dto = {
        listType: 'BLACKLIST',
        entityType: 'INVALID',
        entityValue: 'AR',
      };

      await request(app.getHttpServer())
        .post('/api/lists')
        .set('x-organization-id', organizationId)
        .send(dto)
        .expect(400);
    });

    it('should return 400 for missing required fields', async () => {
      const dto = {
        listType: 'BLACKLIST',
        // missing entityType and entityValue
      };

      await request(app.getHttpServer())
        .post('/api/lists')
        .set('x-organization-id', organizationId)
        .send(dto)
        .expect(400);
    });
  });

  describe('GET /api/lists', () => {
    it('should return empty list when no entries exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/lists')
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });

    it('should return paginated list entries', async () => {
      const testOrgId = generateUUID();

      for (let i = 0; i < 5; i++) {
        await createTestListEntry(testOrgId, {
          entityValue: `value-${i}`,
        });
      }

      const response = await request(app.getHttpServer())
        .get('/api/lists')
        .set('x-organization-id', testOrgId)
        .query({ page: 1, limit: 3 })
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.total).toBe(5);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(3);
      expect(response.body.totalPages).toBe(2);
    });

    it('should filter by listType', async () => {
      const testOrgId = generateUUID();

      await createTestListEntry(testOrgId, {
        listType: ListType.BLACKLIST,
        entityValue: 'value-1',
      });
      await createTestListEntry(testOrgId, {
        listType: ListType.WHITELIST,
        entityValue: 'value-2',
      });

      const response = await request(app.getHttpServer())
        .get('/api/lists')
        .set('x-organization-id', testOrgId)
        .query({ listType: 'BLACKLIST' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].listType).toBe('BLACKLIST');
    });

    it('should filter by entityType', async () => {
      const testOrgId = generateUUID();

      await createTestListEntry(testOrgId, {
        entityType: EntityType.COUNTRY,
        entityValue: 'value-1',
      });
      await createTestListEntry(testOrgId, {
        entityType: EntityType.IP,
        entityValue: '192.168.1.1',
      });

      const response = await request(app.getHttpServer())
        .get('/api/lists')
        .set('x-organization-id', testOrgId)
        .query({ entityType: 'COUNTRY' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].entityType).toBe('COUNTRY');
    });

    it('should filter by entityValue', async () => {
      const testOrgId = generateUUID();

      await createTestListEntry(testOrgId, { entityValue: 'AR' });
      await createTestListEntry(testOrgId, { entityValue: 'US' });

      const response = await request(app.getHttpServer())
        .get('/api/lists')
        .set('x-organization-id', testOrgId)
        .query({ entityValue: 'AR' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].entityValue).toBe('AR');
    });
  });

  describe('GET /api/lists/:id', () => {
    it('should return entry by id', async () => {
      const testOrgId = generateUUID();
      const entry = await createTestListEntry(testOrgId);

      const response = await request(app.getHttpServer())
        .get(`/api/lists/${entry.id}`)
        .set('x-organization-id', testOrgId)
        .expect(200);

      expect(response.body.id).toBe(entry.id);
      expect(response.body.idOrganization).toBe(testOrgId);
    });

    it('should return 404 for non-existent entry', async () => {
      const fakeId = generateUUID();

      await request(app.getHttpServer())
        .get(`/api/lists/${fakeId}`)
        .set('x-organization-id', organizationId)
        .expect(404);
    });

    it('should not return entry from different organization', async () => {
      const orgA = generateUUID();
      const orgB = generateUUID();

      const entry = await createTestListEntry(orgA);

      await request(app.getHttpServer())
        .get(`/api/lists/${entry.id}`)
        .set('x-organization-id', orgB)
        .expect(404);
    });
  });

  describe('DELETE /api/lists/:id', () => {
    it('should delete entry successfully', async () => {
      const testOrgId = generateUUID();
      const entry = await createTestListEntry(testOrgId);

      await request(app.getHttpServer())
        .delete(`/api/lists/${entry.id}`)
        .set('x-organization-id', testOrgId)
        .expect(204);

      // Verify deletion
      const deleted = await dataSource.getRepository(ListEntry).findOne({
        where: { id: entry.id },
      });
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent entry', async () => {
      const fakeId = generateUUID();

      await request(app.getHttpServer())
        .delete(`/api/lists/${fakeId}`)
        .set('x-organization-id', organizationId)
        .expect(404);
    });

    it('should not delete entry from different organization', async () => {
      const orgA = generateUUID();
      const orgB = generateUUID();

      const entry = await createTestListEntry(orgA);

      await request(app.getHttpServer())
        .delete(`/api/lists/${entry.id}`)
        .set('x-organization-id', orgB)
        .expect(404);

      // Verify entry still exists
      const stillExists = await dataSource.getRepository(ListEntry).findOne({
        where: { id: entry.id },
      });
      expect(stillExists).not.toBeNull();
    });
  });

  describe('Organization isolation', () => {
    it('should not return entries from other organizations', async () => {
      const orgA = generateUUID();
      const orgB = generateUUID();

      await createTestListEntry(orgA, { entityValue: 'AR' });
      await createTestListEntry(orgB, { entityValue: 'US' });

      const responseA = await request(app.getHttpServer())
        .get('/api/lists')
        .set('x-organization-id', orgA)
        .expect(200);

      expect(responseA.body.data).toHaveLength(1);
      expect(responseA.body.data[0].entityValue).toBe('AR');

      const responseB = await request(app.getHttpServer())
        .get('/api/lists')
        .set('x-organization-id', orgB)
        .expect(200);

      expect(responseB.body.data).toHaveLength(1);
      expect(responseB.body.data[0].entityValue).toBe('US');
    });

    it('should allow same entry in different organizations', async () => {
      const orgA = generateUUID();
      const orgB = generateUUID();

      // Same entry (BLACKLIST + COUNTRY + AR) in different orgs should work
      await request(app.getHttpServer())
        .post('/api/lists')
        .set('x-organization-id', orgA)
        .send({
          listType: 'BLACKLIST',
          entityType: 'COUNTRY',
          entityValue: 'AR',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/lists')
        .set('x-organization-id', orgB)
        .send({
          listType: 'BLACKLIST',
          entityType: 'COUNTRY',
          entityValue: 'AR',
        })
        .expect(201);
    });
  });

  describe('Entity types', () => {
    it('should support ACCOUNT entity type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/lists')
        .set('x-organization-id', organizationId)
        .send({
          listType: 'BLACKLIST',
          entityType: 'ACCOUNT',
          entityValue: 'acc-12345',
        })
        .expect(201);

      expect(response.body.entityType).toBe('ACCOUNT');
    });

    it('should support IP entity type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/lists')
        .set('x-organization-id', organizationId)
        .send({
          listType: 'BLACKLIST',
          entityType: 'IP',
          entityValue: '192.168.1.1',
        })
        .expect(201);

      expect(response.body.entityType).toBe('IP');
    });

    it('should support DEVICE entity type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/lists')
        .set('x-organization-id', organizationId)
        .send({
          listType: 'WHITELIST',
          entityType: 'DEVICE',
          entityValue: 'device-uuid-123',
        })
        .expect(201);

      expect(response.body.entityType).toBe('DEVICE');
    });

    it('should support EMAIL entity type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/lists')
        .set('x-organization-id', organizationId)
        .send({
          listType: 'BLACKLIST',
          entityType: 'EMAIL',
          entityValue: 'suspicious@example.com',
        })
        .expect(201);

      expect(response.body.entityType).toBe('EMAIL');
    });

    it('should support PHONE entity type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/lists')
        .set('x-organization-id', organizationId)
        .send({
          listType: 'BLACKLIST',
          entityType: 'PHONE',
          entityValue: '+1234567890',
        })
        .expect(201);

      expect(response.body.entityType).toBe('PHONE');
    });
  });
});
