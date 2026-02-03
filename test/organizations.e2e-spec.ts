/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsModule } from '../src/organizations/organizations.module';
import { Organization } from '../src/organizations/entities/organization.entity';
import { AllExceptionsFilter } from '../src/common/filters';
import { DataSource } from 'typeorm';
import configuration from '../src/config/configuration';
import { validationSchema } from '../src/config/validation.schema';

describe('OrganizationsController (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
          load: [configuration],
          validationSchema,
        }),
        TypeOrmModule.forRootAsync({
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get<string>('database.host'),
            port: configService.get<number>('database.port'),
            username: configService.get<string>('database.username'),
            password: configService.get<string>('database.password'),
            database: configService.get<string>('database.name'),
            entities: [Organization],
            synchronize: true, // Use synchronize for test database
            dropSchema: true, // Drop schema before each test run
          }),
          inject: [ConfigService],
        }),
        OrganizationsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
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
    // Clean up organizations table before each test
    await dataSource.getRepository(Organization).clear();
  });

  describe('POST /api/organizations', () => {
    it('should create an organization with name only', async () => {
      const createDto = { name: 'Test Organization' };

      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Test Organization',
        settings: {},
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });

    it('should create an organization with name and settings', async () => {
      const createDto = {
        name: 'Test Organization',
        settings: { timezone: 'America/New_York', currency: 'USD' },
      };

      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Test Organization',
        settings: { timezone: 'America/New_York', currency: 'USD' },
      });
    });

    it('should fail when name is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .send({})
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should fail when name is empty', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .send({ name: '' })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should fail when name exceeds max length', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .send({ name: 'a'.repeat(256) })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should fail when settings is not an object', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .send({ name: 'Test', settings: 'invalid' })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should reject unknown properties', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .send({ name: 'Test', unknownField: 'value' })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });
  });

  describe('GET /api/organizations', () => {
    it('should return empty array when no organizations exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/organizations')
        .expect(200);

      expect(response.body).toMatchObject({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
    });

    it('should return organizations with default pagination', async () => {
      // Create test organizations
      const repo = dataSource.getRepository(Organization);
      await repo.save([
        { name: 'Org 1', settings: {} },
        { name: 'Org 2', settings: {} },
        { name: 'Org 3', settings: {} },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/organizations')
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.total).toBe(3);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.totalPages).toBe(1);
    });

    it('should respect pagination parameters', async () => {
      // Create 5 organizations
      const repo = dataSource.getRepository(Organization);
      for (let i = 1; i <= 5; i++) {
        await repo.save({ name: `Org ${i}`, settings: {} });
      }

      const response = await request(app.getHttpServer())
        .get('/api/organizations?page=2&limit=2')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(5);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(2);
      expect(response.body.totalPages).toBe(3);
    });
  });

  describe('GET /api/organizations/:id', () => {
    it('should return an organization by id', async () => {
      const repo = dataSource.getRepository(Organization);
      const org = await repo.save({
        name: 'Test Org',
        settings: { key: 'value' },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${org.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: org.id,
        name: 'Test Org',
        settings: { key: 'value' },
      });
    });

    it('should return 404 for non-existent organization', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${nonExistentId}`)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/organizations/invalid-uuid')
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/organizations/:id', () => {
    it('should update organization name', async () => {
      const repo = dataSource.getRepository(Organization);
      const org = await repo.save({ name: 'Original Name', settings: {} });

      const response = await request(app.getHttpServer())
        .patch(`/api/organizations/${org.id}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
    });

    it('should update organization settings', async () => {
      const repo = dataSource.getRepository(Organization);
      const org = await repo.save({
        name: 'Test Org',
        settings: { old: 'value' },
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/organizations/${org.id}`)
        .send({ settings: { new: 'value' } })
        .expect(200);

      expect(response.body.settings).toEqual({ new: 'value' });
    });

    it('should update both name and settings', async () => {
      const repo = dataSource.getRepository(Organization);
      const org = await repo.save({ name: 'Original', settings: {} });

      const response = await request(app.getHttpServer())
        .patch(`/api/organizations/${org.id}`)
        .send({ name: 'New Name', settings: { updated: true } })
        .expect(200);

      expect(response.body.name).toBe('New Name');
      expect(response.body.settings).toEqual({ updated: true });
    });

    it('should return 404 for non-existent organization', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app.getHttpServer())
        .patch(`/api/organizations/${nonExistentId}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/organizations/invalid-uuid')
        .send({ name: 'Updated' })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should reject invalid update data', async () => {
      const repo = dataSource.getRepository(Organization);
      const org = await repo.save({ name: 'Test', settings: {} });

      const response = await request(app.getHttpServer())
        .patch(`/api/organizations/${org.id}`)
        .send({ settings: 'not-an-object' })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/organizations/:id', () => {
    it('should delete an organization', async () => {
      const repo = dataSource.getRepository(Organization);
      const org = await repo.save({ name: 'To Delete', settings: {} });

      await request(app.getHttpServer())
        .delete(`/api/organizations/${org.id}`)
        .expect(204);

      // Verify deletion
      const deleted = await repo.findOne({ where: { id: org.id } });
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent organization', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app.getHttpServer())
        .delete(`/api/organizations/${nonExistentId}`)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/organizations/invalid-uuid')
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });
  });
});
