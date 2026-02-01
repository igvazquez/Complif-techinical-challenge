import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplateOverridesModule } from '../src/template-overrides/template-overrides.module';
import { RuleTemplatesModule } from '../src/rule-templates/rule-templates.module';
import { TemplateOverride } from '../src/template-overrides/entities/template-override.entity';
import { RuleTemplate } from '../src/rule-templates/entities/rule-template.entity';
import { AllExceptionsFilter } from '../src/common/filters';
import { DataSource } from 'typeorm';
import configuration from '../src/config/configuration';
import { validationSchema } from '../src/config/validation.schema';
import { randomUUID } from 'crypto';

describe('TemplateOverridesController (e2e)', () => {
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
        TypeOrmModule.forRootAsync({
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get<string>('database.host'),
            port: configService.get<number>('database.port'),
            username: configService.get<string>('database.username'),
            password: configService.get<string>('database.password'),
            database: configService.get<string>('database.name'),
            entities: [RuleTemplate, TemplateOverride],
            synchronize: true,
            dropSchema: true,
          }),
          inject: [ConfigService],
        }),
        RuleTemplatesModule,
        TemplateOverridesModule,
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
    // Use raw query to truncate with CASCADE to handle foreign key constraints
    await dataSource.query('TRUNCATE TABLE "template_overrides" CASCADE');
    await dataSource.query('TRUNCATE TABLE "rule_templates" CASCADE');

    // Create a test template for use in tests
    testTemplate = await dataSource.getRepository(RuleTemplate).save({
      name: 'Test Template',
      config: {
        conditions: {
          all: [{ fact: 'amount', operator: 'greaterThan', value: 10000 }],
        },
        event: { type: 'alert', params: { severity: 'LOW' } },
      },
    });
  });

  describe('POST /api/template-overrides', () => {
    it('should create a template override', async () => {
      const createDto = {
        idTemplate: testTemplate.id,
        overrides: { threshold: 50000 },
        enabled: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/template-overrides')
        .set('x-organization-id', organizationId)
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        idTemplate: testTemplate.id,
        idOrganization: organizationId,
        enabled: true,
      });
      expect(response.body.id).toBeDefined();
    });

    it('should fail without organization header', async () => {
      await request(app.getHttpServer())
        .post('/api/template-overrides')
        .send({ idTemplate: testTemplate.id })
        .expect(400);
    });

    it('should fail with invalid organization header', async () => {
      await request(app.getHttpServer())
        .post('/api/template-overrides')
        .set('x-organization-id', 'invalid-uuid')
        .send({ idTemplate: testTemplate.id })
        .expect(400);
    });

    it('should fail when template does not exist', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .post('/api/template-overrides')
        .set('x-organization-id', organizationId)
        .send({ idTemplate: nonExistentId })
        .expect(404);
    });

    it('should fail on duplicate override for same template', async () => {
      await dataSource.getRepository(TemplateOverride).save({
        idOrganization: organizationId,
        idTemplate: testTemplate.id,
        overrides: {},
        enabled: true,
      });

      await request(app.getHttpServer())
        .post('/api/template-overrides')
        .set('x-organization-id', organizationId)
        .send({ idTemplate: testTemplate.id })
        .expect(409);
    });
  });

  describe('GET /api/template-overrides', () => {
    it('should return overrides for the organization', async () => {
      const repo = dataSource.getRepository(TemplateOverride);
      await repo.save({
        idOrganization: organizationId,
        idTemplate: testTemplate.id,
        overrides: {},
        enabled: true,
      });

      const response = await request(app.getHttpServer())
        .get('/api/template-overrides')
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].idOrganization).toBe(organizationId);
    });

    it('should not return overrides from other organizations', async () => {
      const otherOrgId = generateUUID();
      const repo = dataSource.getRepository(TemplateOverride);
      await repo.save({
        idOrganization: otherOrgId,
        idTemplate: testTemplate.id,
        overrides: {},
        enabled: true,
      });

      const response = await request(app.getHttpServer())
        .get('/api/template-overrides')
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/template-overrides/:id', () => {
    it('should return an override by id', async () => {
      const repo = dataSource.getRepository(TemplateOverride);
      const override = await repo.save({
        idOrganization: organizationId,
        idTemplate: testTemplate.id,
        overrides: { threshold: 5000 },
        enabled: true,
      });

      const response = await request(app.getHttpServer())
        .get(`/api/template-overrides/${override.id}`)
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.id).toBe(override.id);
      expect(response.body.overrides).toEqual({ threshold: 5000 });
    });

    it('should return 404 for override from different organization', async () => {
      const otherOrgId = generateUUID();
      const repo = dataSource.getRepository(TemplateOverride);
      const override = await repo.save({
        idOrganization: otherOrgId,
        idTemplate: testTemplate.id,
        overrides: {},
        enabled: true,
      });

      await request(app.getHttpServer())
        .get(`/api/template-overrides/${override.id}`)
        .set('x-organization-id', organizationId)
        .expect(404);
    });
  });

  describe('GET /api/template-overrides/template/:templateId/merged-config', () => {
    it('should return merged config with overrides', async () => {
      const repo = dataSource.getRepository(TemplateOverride);
      await repo.save({
        idOrganization: organizationId,
        idTemplate: testTemplate.id,
        overrides: {
          event: { params: { severity: 'HIGH' } },
        },
        enabled: true,
      });

      const response = await request(app.getHttpServer())
        .get(
          `/api/template-overrides/template/${testTemplate.id}/merged-config`,
        )
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.conditions).toBeDefined();
      expect(response.body.event.params.severity).toBe('HIGH');
      expect(response.body.event.type).toBe('alert');
    });

    it('should return template config when no override exists', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/api/template-overrides/template/${testTemplate.id}/merged-config`,
        )
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body).toEqual(testTemplate.config);
    });

    it('should return template config when override is disabled', async () => {
      const repo = dataSource.getRepository(TemplateOverride);
      await repo.save({
        idOrganization: organizationId,
        idTemplate: testTemplate.id,
        overrides: { event: { params: { severity: 'HIGH' } } },
        enabled: false,
      });

      const response = await request(app.getHttpServer())
        .get(
          `/api/template-overrides/template/${testTemplate.id}/merged-config`,
        )
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.event.params.severity).toBe('LOW');
    });
  });

  describe('PATCH /api/template-overrides/:id', () => {
    it('should update override', async () => {
      const repo = dataSource.getRepository(TemplateOverride);
      const override = await repo.save({
        idOrganization: organizationId,
        idTemplate: testTemplate.id,
        overrides: {},
        enabled: true,
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/template-overrides/${override.id}`)
        .set('x-organization-id', organizationId)
        .send({ enabled: false, overrides: { newKey: 'value' } })
        .expect(200);

      expect(response.body.enabled).toBe(false);
      expect(response.body.overrides).toEqual({ newKey: 'value' });
    });

    it('should not allow updating idTemplate', async () => {
      const repo = dataSource.getRepository(TemplateOverride);
      const override = await repo.save({
        idOrganization: organizationId,
        idTemplate: testTemplate.id,
        overrides: {},
        enabled: true,
      });

      const anotherTemplate = await dataSource
        .getRepository(RuleTemplate)
        .save({
          name: 'Another Template',
          config: {},
        });

      await request(app.getHttpServer())
        .patch(`/api/template-overrides/${override.id}`)
        .set('x-organization-id', organizationId)
        .send({ idTemplate: anotherTemplate.id })
        .expect(400);
    });
  });

  describe('DELETE /api/template-overrides/:id', () => {
    it('should delete an override', async () => {
      const repo = dataSource.getRepository(TemplateOverride);
      const override = await repo.save({
        idOrganization: organizationId,
        idTemplate: testTemplate.id,
        overrides: {},
        enabled: true,
      });

      await request(app.getHttpServer())
        .delete(`/api/template-overrides/${override.id}`)
        .set('x-organization-id', organizationId)
        .expect(204);

      const deleted = await repo.findOne({ where: { id: override.id } });
      expect(deleted).toBeNull();
    });

    it('should return 404 for override from different organization', async () => {
      const otherOrgId = generateUUID();
      const repo = dataSource.getRepository(TemplateOverride);
      const override = await repo.save({
        idOrganization: otherOrgId,
        idTemplate: testTemplate.id,
        overrides: {},
        enabled: true,
      });

      await request(app.getHttpServer())
        .delete(`/api/template-overrides/${override.id}`)
        .set('x-organization-id', organizationId)
        .expect(404);
    });
  });
});
