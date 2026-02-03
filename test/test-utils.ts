import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Type,
  DynamicModule,
  ForwardReference,
  Provider,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

type ModuleImport =
  | Type
  | DynamicModule
  | Promise<DynamicModule>
  | ForwardReference;

export async function createTestingModule(
  imports: ModuleImport[] = [],
  providers: Provider[] = [],
): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test',
      }),
      ...imports,
    ],
    providers,
  }).compile();
}

export async function createTestApp(
  moduleFixture: TestingModule,
): Promise<INestApplication> {
  const app = moduleFixture.createNestApplication();

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

  await app.init();
  return app;
}

export function generateUUID(): string {
  return uuidv4();
}

export function createMockOrganization(overrides: Partial<any> = {}) {
  return {
    id: generateUUID(),
    name: 'Test Organization',
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockRule(overrides: Partial<any> = {}) {
  return {
    id: generateUUID(),
    idOrganization: generateUUID(),
    name: 'Test Rule',
    description: 'Test rule description',
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
      event: {
        type: 'alert',
        params: {
          severity: 'HIGH',
          category: 'AML',
        },
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockTransaction(overrides: Partial<any> = {}) {
  return {
    id: generateUUID(),
    idOrganization: generateUUID(),
    idAccount: generateUUID(),
    amount: 1000,
    amountNormalized: 1000,
    currency: 'USD',
    type: 'CASH_IN',
    datetime: new Date(),
    date: new Date().toISOString().split('T')[0],
    isVoided: false,
    isBlocked: false,
    isDeleted: false,
    data: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockAlert(overrides: Partial<any> = {}) {
  return {
    id: generateUUID(),
    idOrganization: generateUUID(),
    idRule: generateUUID(),
    idTransaction: generateUUID(),
    severity: 'HIGH',
    category: 'AML',
    status: 'OPEN',
    hitCount: 1,
    firstTriggeredAt: new Date(),
    lastTriggeredAt: new Date(),
    dedupKey: `rule:account:window`,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockRuleTemplate(overrides: Partial<any> = {}) {
  return {
    id: generateUUID(),
    name: 'Test Rule Template',
    description: 'Test template description',
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
        type: 'alert',
        params: {
          severity: 'HIGH',
          category: 'AML',
        },
      },
    },
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockTemplateOverride(overrides: Partial<any> = {}) {
  return {
    id: generateUUID(),
    idOrganization: generateUUID(),
    idTemplate: generateUUID(),
    overrides: {
      conditions: {
        all: [
          {
            fact: 'transaction.amount',
            operator: 'greaterThan',
            value: 50000,
          },
        ],
      },
    },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
