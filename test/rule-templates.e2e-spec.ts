import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuleTemplatesModule } from '../src/rule-templates/rule-templates.module';
import { RuleTemplate } from '../src/rule-templates/entities/rule-template.entity';
import { AllExceptionsFilter } from '../src/common/filters';
import { DataSource } from 'typeorm';
import configuration from '../src/config/configuration';
import { validationSchema } from '../src/config/validation.schema';

describe('RuleTemplatesController (e2e)', () => {
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
            entities: [RuleTemplate],
            synchronize: true,
            dropSchema: true,
          }),
          inject: [ConfigService],
        }),
        RuleTemplatesModule,
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
    await dataSource.query('TRUNCATE TABLE "rule_templates" CASCADE');
  });

  describe('POST /api/rule-templates', () => {
    it('should create a rule template with name only', async () => {
      const createDto = { name: 'Test Template' };

      const response = await request(app.getHttpServer())
        .post('/api/rule-templates')
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Test Template',
        config: {},
        isDefault: false,
      });
      expect(response.body.id).toBeDefined();
    });

    it('should create a rule template with all fields', async () => {
      const createDto = {
        name: 'Full Template',
        description: 'A complete template',
        config: {
          conditions: {
            all: [{ fact: 'amount', operator: 'greaterThan', value: 1000 }],
          },
        },
        isDefault: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/rule-templates')
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Full Template',
        description: 'A complete template',
        isDefault: true,
      });
      expect(response.body.config.conditions).toBeDefined();
    });

    it('should fail when name is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/rule-templates')
        .send({})
        .expect(400);
    });

    it('should fail when name is empty', async () => {
      await request(app.getHttpServer())
        .post('/api/rule-templates')
        .send({ name: '' })
        .expect(400);
    });

    it('should fail on duplicate name', async () => {
      const repo = dataSource.getRepository(RuleTemplate);
      await repo.save({ name: 'Existing Template', config: {} });

      await request(app.getHttpServer())
        .post('/api/rule-templates')
        .send({ name: 'Existing Template' })
        .expect(500); // Unique constraint violation
    });
  });

  describe('GET /api/rule-templates', () => {
    it('should return empty array when no templates exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/rule-templates')
        .expect(200);

      expect(response.body).toMatchObject({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
    });

    it('should return templates with pagination', async () => {
      const repo = dataSource.getRepository(RuleTemplate);
      await repo.save([
        { name: 'Template 1', config: {} },
        { name: 'Template 2', config: {} },
        { name: 'Template 3', config: {} },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/rule-templates')
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.total).toBe(3);
    });

    it('should respect pagination parameters', async () => {
      const repo = dataSource.getRepository(RuleTemplate);
      for (let i = 1; i <= 5; i++) {
        await repo.save({ name: `Template ${i}`, config: {} });
      }

      const response = await request(app.getHttpServer())
        .get('/api/rule-templates?page=2&limit=2')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.page).toBe(2);
      expect(response.body.totalPages).toBe(3);
    });
  });

  describe('GET /api/rule-templates/defaults', () => {
    it('should return only default templates', async () => {
      const repo = dataSource.getRepository(RuleTemplate);
      await repo.save([
        { name: 'Default 1', config: {}, isDefault: true },
        { name: 'Non-default', config: {}, isDefault: false },
        { name: 'Default 2', config: {}, isDefault: true },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/rule-templates/defaults')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((t: any) => t.isDefault)).toBe(true);
    });

    it('should return empty array when no defaults exist', async () => {
      const repo = dataSource.getRepository(RuleTemplate);
      await repo.save({ name: 'Non-default', config: {}, isDefault: false });

      const response = await request(app.getHttpServer())
        .get('/api/rule-templates/defaults')
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });

  describe('GET /api/rule-templates/:id', () => {
    it('should return a template by id', async () => {
      const repo = dataSource.getRepository(RuleTemplate);
      const template = await repo.save({
        name: 'Test Template',
        description: 'Test description',
        config: { key: 'value' },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/rule-templates/${template.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: template.id,
        name: 'Test Template',
        description: 'Test description',
      });
    });

    it('should return 404 for non-existent template', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .get(`/api/rule-templates/${nonExistentId}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/rule-templates/invalid-uuid')
        .expect(400);
    });
  });

  describe('PATCH /api/rule-templates/:id', () => {
    it('should update template name', async () => {
      const repo = dataSource.getRepository(RuleTemplate);
      const template = await repo.save({ name: 'Original', config: {} });

      const response = await request(app.getHttpServer())
        .patch(`/api/rule-templates/${template.id}`)
        .send({ name: 'Updated' })
        .expect(200);

      expect(response.body.name).toBe('Updated');
    });

    it('should update template config', async () => {
      const repo = dataSource.getRepository(RuleTemplate);
      const template = await repo.save({ name: 'Test', config: { old: true } });

      const response = await request(app.getHttpServer())
        .patch(`/api/rule-templates/${template.id}`)
        .send({ config: { new: true } })
        .expect(200);

      expect(response.body.config).toEqual({ new: true });
    });

    it('should return 404 for non-existent template', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .patch(`/api/rule-templates/${nonExistentId}`)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/rule-templates/:id', () => {
    it('should delete a template', async () => {
      const repo = dataSource.getRepository(RuleTemplate);
      const template = await repo.save({ name: 'To Delete', config: {} });

      await request(app.getHttpServer())
        .delete(`/api/rule-templates/${template.id}`)
        .expect(204);

      const deleted = await repo.findOne({ where: { id: template.id } });
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent template', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .delete(`/api/rule-templates/${nonExistentId}`)
        .expect(404);
    });
  });
});
