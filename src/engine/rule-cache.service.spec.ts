import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getLoggerToken } from 'nestjs-pino';
import { RuleCacheService, CachedRules } from './rule-cache.service';
import { generateUUID } from '../../test/test-utils';

// Helper to create the metric token string (matching @willsoto/nestjs-prometheus)
const getMetricToken = (name: string) => `PROM_METRIC_${name.toUpperCase()}`;

// Mock ioredis
jest.mock('ioredis', () => {
  const mockClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };

  return jest.fn(() => mockClient);
});

describe('RuleCacheService', () => {
  let service: RuleCacheService;
  let mockCounter: { inc: jest.Mock };

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        'redis.host': 'localhost',
        'redis.port': 6379,
        'ruleEngine.ruleCacheTtlSeconds': 300,
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    mockCounter = { inc: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleCacheService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getLoggerToken(RuleCacheService.name),
          useValue: mockLogger,
        },
        {
          provide: getMetricToken('rule_cache_total'),
          useValue: mockCounter,
        },
      ],
    }).compile();

    service = module.get<RuleCacheService>(RuleCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect to Redis and subscribe to invalidation channel', async () => {
      await service.onModuleInit();

      expect(service.isReady()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Redis connection established for rule caching',
      );
    });
  });

  describe('get', () => {
    const organizationId = generateUUID();

    it('should return null and increment miss counter when not connected', async () => {
      // Don't initialize, so isConnected is false
      const result = await service.get(organizationId);

      expect(result).toBeNull();
      expect(mockCounter.inc).toHaveBeenCalledWith({ result: 'miss' });
    });

    it('should return cached data and increment hit counter', async () => {
      await service.onModuleInit();

      const cachedData: CachedRules = {
        rules: [{ id: 'rule-1', name: 'Test Rule', priority: 0, config: {} }],
        cachedAt: Date.now(),
      };

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      const mockRedis = new Redis();
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.get(organizationId);

      expect(result).toEqual(cachedData);
      expect(mockCounter.inc).toHaveBeenCalledWith({ result: 'hit' });
    });

    it('should return null and increment miss counter when cache is empty', async () => {
      await service.onModuleInit();

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      const mockRedis = new Redis();
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get(organizationId);

      expect(result).toBeNull();
      expect(mockCounter.inc).toHaveBeenCalledWith({ result: 'miss' });
    });
  });

  describe('set', () => {
    const organizationId = generateUUID();
    const cachedData: CachedRules = {
      rules: [{ id: 'rule-1', name: 'Test Rule', priority: 0, config: {} }],
      cachedAt: Date.now(),
    };

    it('should not set cache when not connected', async () => {
      await service.set(organizationId, cachedData);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      const mockRedis = new Redis();
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should set cache with TTL when connected', async () => {
      await service.onModuleInit();

      await service.set(organizationId, cachedData);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      const mockRedis = new Redis();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `rules:engine:${organizationId}`,
        300,
        JSON.stringify(cachedData),
      );
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('invalidate', () => {
    const organizationId = generateUUID();

    it('should not invalidate when not connected', async () => {
      await service.invalidate(organizationId);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      const mockRedis = new Redis();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should delete cache and publish invalidation message', async () => {
      await service.onModuleInit();

      await service.invalidate(organizationId);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      const mockRedis = new Redis();
      expect(mockRedis.del).toHaveBeenCalledWith(
        `rules:engine:${organizationId}`,
      );
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'rules:invalidation',
        JSON.stringify({ organizationId }),
      );
    });
  });

  describe('handleCacheInvalidation', () => {
    const organizationId = generateUUID();

    it('should invalidate cache on event', async () => {
      await service.onModuleInit();

      await service.handleCacheInvalidation({ organizationId });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      const mockRedis = new Redis();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('isReady', () => {
    it('should return false before initialization', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      await service.onModuleInit();
      expect(service.isReady()).toBe(true);
    });
  });
});
