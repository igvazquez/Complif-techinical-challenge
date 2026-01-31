import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RulesModule } from '../src/rules/rules.module';
import { RuleTemplatesModule } from '../src/rule-templates/rule-templates.module';
import { TemplateOverridesModule } from '../src/template-overrides/template-overrides.module';
import { Rule } from '../src/rules/entities/rule.entity';
import { RuleTemplate } from '../src/rule-templates/entities/rule-template.entity';
import { TemplateOverride } from '../src/template-overrides/entities/template-override.entity';
import { AllExceptionsFilter } from '../src/common/filters';
import { DataSource } from 'typeorm';
import configuration from '../src/config/configuration';
import { validationSchema } from '../src/config/validation.schema';
import { randomUUID } from 'crypto';

describe('RulesController (e2e)', () => {
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
            entities: [RuleTemplate, TemplateOverride, Rule],
            synchronize: true,
            dropSchema: true,
          }),
          inject: [ConfigService],
        }),
        RuleTemplatesModule,
        TemplateOverridesModule,
        RulesModule,
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
    await dataSource.query('TRUNCATE TABLE "rules" CASCADE');
    await dataSource.query('TRUNCATE TABLE "template_overrides" CASCADE');
    await dataSource.query('TRUNCATE TABLE "rule_templates" CASCADE');

    testTemplate = await dataSource.getRepository(RuleTemplate).save({
      name: 'Test Template',
      config: {
        conditions: {
          all: [{ fact: 'amount', operator: 'greaterThan', value: 10000 }],
        },
        event: { type: 'alert', params: { severity: 'LOW', category: 'AML' } },
      },
    });
  });

  describe('POST /api/rules', () => {
    it('should create a rule with name only', async () => {
      const createDto = { name: 'Test Rule' };

      const response = await request(app.getHttpServer())
        .post('/api/rules')
        .set('x-organization-id', organizationId)
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Test Rule',
        idOrganization: organizationId,
        enabled: true,
        priority: 0,
        config: {},
      });
      expect(response.body.id).toBeDefined();
    });

    it('should create a rule with all fields', async () => {
      const createDto = {
        name: 'Full Rule',
        description: 'A complete rule',
        idTemplate: testTemplate.id,
        enabled: false,
        priority: 5,
        config: { threshold: 5000 },
        createdBy: 'admin@test.com',
      };

      const response = await request(app.getHttpServer())
        .post('/api/rules')
        .set('x-organization-id', organizationId)
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Full Rule',
        description: 'A complete rule',
        idTemplate: testTemplate.id,
        enabled: false,
        priority: 5,
        createdBy: 'admin@test.com',
      });
    });

    it('should fail without organization header', async () => {
      await request(app.getHttpServer())
        .post('/api/rules')
        .send({ name: 'Test Rule' })
        .expect(400);
    });

    it('should fail when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/rules')
        .set('x-organization-id', organizationId)
        .send({})
        .expect(400);
    });

    it('should fail with invalid priority', async () => {
      await request(app.getHttpServer())
        .post('/api/rules')
        .set('x-organization-id', organizationId)
        .send({ name: 'Test', priority: -1 })
        .expect(400);
    });
  });

  describe('GET /api/rules', () => {
    it('should return rules for the organization', async () => {
      const repo = dataSource.getRepository(Rule);
      await repo.save({
        idOrganization: organizationId,
        name: 'Test Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      const response = await request(app.getHttpServer())
        .get('/api/rules')
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].idOrganization).toBe(organizationId);
    });

    it('should not return rules from other organizations', async () => {
      const otherOrgId = generateUUID();
      const repo = dataSource.getRepository(Rule);
      await repo.save({
        idOrganization: otherOrgId,
        name: 'Other Org Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      const response = await request(app.getHttpServer())
        .get('/api/rules')
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });

    it('should order by priority ascending', async () => {
      const repo = dataSource.getRepository(Rule);
      await repo.save([
        {
          idOrganization: organizationId,
          name: 'Low Priority',
          priority: 10,
          config: {},
        },
        {
          idOrganization: organizationId,
          name: 'High Priority',
          priority: 1,
          config: {},
        },
        {
          idOrganization: organizationId,
          name: 'Medium Priority',
          priority: 5,
          config: {},
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/rules')
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.data[0].name).toBe('High Priority');
      expect(response.body.data[1].name).toBe('Medium Priority');
      expect(response.body.data[2].name).toBe('Low Priority');
    });
  });

  describe('GET /api/rules/enabled', () => {
    it('should return only enabled rules sorted by priority', async () => {
      const repo = dataSource.getRepository(Rule);
      await repo.save([
        {
          idOrganization: organizationId,
          name: 'Disabled',
          priority: 0,
          enabled: false,
          config: {},
        },
        {
          idOrganization: organizationId,
          name: 'Enabled Low',
          priority: 10,
          enabled: true,
          config: {},
        },
        {
          idOrganization: organizationId,
          name: 'Enabled High',
          priority: 1,
          enabled: true,
          config: {},
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/rules/enabled')
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Enabled High');
      expect(response.body[1].name).toBe('Enabled Low');
    });
  });

  describe('GET /api/rules/:id', () => {
    it('should return a rule by id', async () => {
      const repo = dataSource.getRepository(Rule);
      const rule = await repo.save({
        idOrganization: organizationId,
        name: 'Test Rule',
        description: 'Test description',
        enabled: true,
        priority: 0,
        config: { key: 'value' },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/rules/${rule.id}`)
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body).toMatchObject({
        id: rule.id,
        name: 'Test Rule',
        description: 'Test description',
      });
    });

    it('should return 404 for rule from different organization', async () => {
      const otherOrgId = generateUUID();
      const repo = dataSource.getRepository(Rule);
      const rule = await repo.save({
        idOrganization: otherOrgId,
        name: 'Other Org Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      await request(app.getHttpServer())
        .get(`/api/rules/${rule.id}`)
        .set('x-organization-id', organizationId)
        .expect(404);
    });
  });

  describe('GET /api/rules/:id/effective-config', () => {
    it('should return rule config when no template', async () => {
      const repo = dataSource.getRepository(Rule);
      const rule = await repo.save({
        idOrganization: organizationId,
        name: 'Standalone Rule',
        enabled: true,
        priority: 0,
        config: { threshold: 5000 },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/rules/${rule.id}/effective-config`)
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body).toEqual({ threshold: 5000 });
    });

    it('should return merged config with template', async () => {
      const repo = dataSource.getRepository(Rule);
      const rule = await repo.save({
        idOrganization: organizationId,
        name: 'Template Rule',
        idTemplate: testTemplate.id,
        enabled: true,
        priority: 0,
        config: { event: { params: { severity: 'HIGH' } } },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/rules/${rule.id}/effective-config`)
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.conditions).toBeDefined();
      expect(response.body.event.type).toBe('alert');
      expect(response.body.event.params.severity).toBe('HIGH');
      expect(response.body.event.params.category).toBe('AML');
    });

    it('should include template overrides in effective config', async () => {
      // Create template override
      await dataSource.getRepository(TemplateOverride).save({
        idOrganization: organizationId,
        idTemplate: testTemplate.id,
        overrides: {
          conditions: {
            all: [{ fact: 'amount', operator: 'greaterThan', value: 50000 }],
          },
        },
        enabled: true,
      });

      const repo = dataSource.getRepository(Rule);
      const rule = await repo.save({
        idOrganization: organizationId,
        name: 'Template Rule',
        idTemplate: testTemplate.id,
        enabled: true,
        priority: 0,
        config: {},
      });

      const response = await request(app.getHttpServer())
        .get(`/api/rules/${rule.id}/effective-config`)
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.conditions.all[0].value).toBe(50000);
    });
  });

  describe('PATCH /api/rules/:id', () => {
    it('should update rule', async () => {
      const repo = dataSource.getRepository(Rule);
      const rule = await repo.save({
        idOrganization: organizationId,
        name: 'Original',
        enabled: true,
        priority: 0,
        config: {},
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/rules/${rule.id}`)
        .set('x-organization-id', organizationId)
        .send({ name: 'Updated', enabled: false, priority: 5 })
        .expect(200);

      expect(response.body.name).toBe('Updated');
      expect(response.body.enabled).toBe(false);
      expect(response.body.priority).toBe(5);
    });

    it('should not update createdBy', async () => {
      const repo = dataSource.getRepository(Rule);
      const rule = await repo.save({
        idOrganization: organizationId,
        name: 'Test',
        enabled: true,
        priority: 0,
        config: {},
        createdBy: 'original@test.com',
      });

      await request(app.getHttpServer())
        .patch(`/api/rules/${rule.id}`)
        .set('x-organization-id', organizationId)
        .send({ createdBy: 'hacker@test.com' })
        .expect(400);
    });

    it('should return 404 for rule from different organization', async () => {
      const otherOrgId = generateUUID();
      const repo = dataSource.getRepository(Rule);
      const rule = await repo.save({
        idOrganization: otherOrgId,
        name: 'Other Org Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      await request(app.getHttpServer())
        .patch(`/api/rules/${rule.id}`)
        .set('x-organization-id', organizationId)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/rules/:id', () => {
    it('should delete a rule', async () => {
      const repo = dataSource.getRepository(Rule);
      const rule = await repo.save({
        idOrganization: organizationId,
        name: 'To Delete',
        enabled: true,
        priority: 0,
        config: {},
      });

      await request(app.getHttpServer())
        .delete(`/api/rules/${rule.id}`)
        .set('x-organization-id', organizationId)
        .expect(204);

      const deleted = await repo.findOne({ where: { id: rule.id } });
      expect(deleted).toBeNull();
    });

    it('should return 404 for rule from different organization', async () => {
      const otherOrgId = generateUUID();
      const repo = dataSource.getRepository(Rule);
      const rule = await repo.save({
        idOrganization: otherOrgId,
        name: 'Other Org Rule',
        enabled: true,
        priority: 0,
        config: {},
      });

      await request(app.getHttpServer())
        .delete(`/api/rules/${rule.id}`)
        .set('x-organization-id', organizationId)
        .expect(404);
    });
  });
});
