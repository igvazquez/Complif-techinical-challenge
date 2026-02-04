/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { EngineService } from './engine.service';
import { RuleCacheService, CachedRules } from './rule-cache.service';
import { RulesService } from '../rules/rules.service';
import { TransactionHistoryFact } from './facts/transaction-history.fact';
import { AccountFact } from './facts/account.fact';
import { ListLookupFact } from './facts/list-lookup.fact';
import { ListsService } from '../lists/lists.service';
import { EvaluationContext } from './interfaces';
import { generateUUID } from '../../test/test-utils';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { ConfigService } from '@nestjs/config';

// Helper to create the metric token string (matching @willsoto/nestjs-prometheus)
const getMetricToken = (name: string) => `PROM_METRIC_${name.toUpperCase()}`;

describe('EngineService', () => {
  let service: EngineService;
  let rulesService: jest.Mocked<RulesService>;
  let ruleCacheService: jest.Mocked<RuleCacheService>;

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };

  const mockHistogram = {
    observe: jest.fn(),
  };

  const mockCounter = {
    inc: jest.fn(),
  };

  const organizationId = generateUUID();

  const createMockContext = (): EvaluationContext => ({
    transaction: {
      id: generateUUID(),
      idAccount: generateUUID(),
      amount: 5000,
      amountNormalized: 5000,
      currency: 'USD',
      type: 'CASH_IN',
      datetime: new Date(),
      date: '2024-01-15',
      country: 'US',
    },
  });

  beforeEach(async () => {
    const mockRulesService = {
      findEnabledByPriority: jest.fn(),
      findOne: jest.fn(),
      getEffectiveConfig: jest.fn(),
    };

    const mockRuleCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn(),
    };

    const mockTransactionRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ result: '0' }),
      }),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(30),
    };

    const mockListsService = {
      isInList: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EngineService,
        TransactionHistoryFact,
        AccountFact,
        ListLookupFact,
        {
          provide: RulesService,
          useValue: mockRulesService,
        },
        {
          provide: RuleCacheService,
          useValue: mockRuleCacheService,
        },
        {
          provide: getLoggerToken(EngineService.name),
          useValue: mockLogger,
        },
        {
          provide: getMetricToken('rule_evaluation_duration_seconds'),
          useValue: mockHistogram,
        },
        {
          provide: getMetricToken('rule_evaluation_total'),
          useValue: mockCounter,
        },
        {
          provide: getMetricToken('rules_evaluated_total'),
          useValue: mockCounter,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ListsService,
          useValue: mockListsService,
        },
      ],
    }).compile();

    service = module.get<EngineService>(EngineService);
    rulesService = module.get(RulesService);
    ruleCacheService = module.get(RuleCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluate', () => {
    it('should return empty result when no rules exist', async () => {
      ruleCacheService.get.mockResolvedValue(null);
      rulesService.findEnabledByPriority.mockResolvedValue([]);

      const result = await service.evaluate(
        organizationId,
        createMockContext(),
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(0);
      expect(result.failedRules).toHaveLength(0);
      expect(result.evaluatedRulesCount).toBe(0);
      expect(result.evaluationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should evaluate rules from cache when available', async () => {
      const cachedRules: CachedRules = {
        rules: [
          {
            id: 'rule-1',
            name: 'Test Rule',
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
              event: { type: 'alert', params: { severity: 'HIGH' } },
            },
          },
        ],
        cachedAt: Date.now(),
      };

      ruleCacheService.get.mockResolvedValue(cachedRules);

      const result = await service.evaluate(
        organizationId,
        createMockContext(),
      );

      expect(ruleCacheService.get).toHaveBeenCalledWith(organizationId);
      expect(rulesService.findEnabledByPriority).not.toHaveBeenCalled();
      expect(result.evaluatedRulesCount).toBe(1);
      // Rule won't trigger because amount (5000) is not > 10000
      expect(result.events).toHaveLength(0);
    });

    it('should trigger event when rule conditions are met', async () => {
      const cachedRules: CachedRules = {
        rules: [
          {
            id: 'rule-1',
            name: 'High Amount Rule',
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
                type: 'alert',
                params: { severity: 'HIGH', category: 'AML' },
              },
            },
          },
        ],
        cachedAt: Date.now(),
      };

      ruleCacheService.get.mockResolvedValue(cachedRules);

      const result = await service.evaluate(
        organizationId,
        createMockContext(),
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('alert');
      expect(result.events[0].params.ruleId).toBe('rule-1');
      expect(result.events[0].params.ruleName).toBe('High Amount Rule');
      expect(result.events[0].params.severity).toBe('HIGH');
    });

    it('should handle multiple rules with different priorities', async () => {
      const cachedRules: CachedRules = {
        rules: [
          {
            id: 'rule-1',
            name: 'Low Threshold',
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
              event: { type: 'low-alert', params: {} },
            },
          },
          {
            id: 'rule-2',
            name: 'High Threshold',
            priority: 1,
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
              event: { type: 'high-alert', params: {} },
            },
          },
        ],
        cachedAt: Date.now(),
      };

      ruleCacheService.get.mockResolvedValue(cachedRules);

      const result = await service.evaluate(
        organizationId,
        createMockContext(),
      );

      expect(result.evaluatedRulesCount).toBe(2);
      // Only the low threshold rule should trigger
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('low-alert');
    });

    it('should continue evaluation when a rule fails (fail-open)', async () => {
      const cachedRules: CachedRules = {
        rules: [
          {
            id: 'bad-rule',
            name: 'Bad Config Rule',
            priority: 0,
            config: {
              // Invalid config that will cause an error
              conditions: null as unknown as object,
              event: { type: 'alert', params: {} },
            },
          },
          {
            id: 'good-rule',
            name: 'Good Rule',
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
              event: { type: 'success-alert', params: {} },
            },
          },
        ],
        cachedAt: Date.now(),
      };

      ruleCacheService.get.mockResolvedValue(cachedRules);

      const result = await service.evaluate(
        organizationId,
        createMockContext(),
      );

      // Should have 1 failed rule but still evaluate the good rule
      expect(result.failedRules.length).toBeGreaterThanOrEqual(1);
      expect(result.events.some((e) => e.type === 'success-alert')).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should load rules from database when cache is empty', async () => {
      ruleCacheService.get.mockResolvedValue(null);
      rulesService.findEnabledByPriority.mockResolvedValue([
        {
          id: 'rule-1',
          idOrganization: organizationId,
          name: 'DB Rule',
          priority: 0,
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
            event: { type: 'db-alert', params: {} },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as never);

      rulesService.getEffectiveConfig.mockResolvedValue({
        conditions: {
          all: [
            { fact: 'transaction.amount', operator: 'greaterThan', value: 100 },
          ],
        },
        event: { type: 'db-alert', params: {} },
      });

      const result = await service.evaluate(
        organizationId,
        createMockContext(),
      );

      expect(rulesService.findEnabledByPriority).toHaveBeenCalledWith(
        organizationId,
      );
      expect(rulesService.getEffectiveConfig).toHaveBeenCalled();
      expect(ruleCacheService.set).toHaveBeenCalled();
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('db-alert');
    });

    it('should increment metrics on evaluation', async () => {
      ruleCacheService.get.mockResolvedValue({
        rules: [
          {
            id: 'rule-1',
            name: 'Test',
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
          },
        ],
        cachedAt: Date.now(),
      });

      await service.evaluate(organizationId, createMockContext());

      expect(mockCounter.inc).toHaveBeenCalledWith({
        organization_id: organizationId,
        status: 'success',
      });
      expect(mockHistogram.observe).toHaveBeenCalled();
    });
  });

  describe('evaluateRule', () => {
    it('should evaluate a single rule by ID', async () => {
      const ruleId = generateUUID();
      const rule = {
        id: ruleId,
        idOrganization: organizationId,
        name: 'Single Rule',
        priority: 0,
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
          event: { type: 'single-alert', params: {} },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      rulesService.findOne.mockResolvedValue(rule as never);
      rulesService.getEffectiveConfig.mockResolvedValue(rule.config);

      const result = await service.evaluateRule(
        organizationId,
        ruleId,
        createMockContext(),
      );

      expect(rulesService.findOne).toHaveBeenCalledWith(organizationId, ruleId);
      expect(result.evaluatedRulesCount).toBe(1);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('single-alert');
      expect(result.events[0].params.ruleId).toBe(ruleId);
    });

    it('should return error result when rule not found', async () => {
      const ruleId = generateUUID();
      rulesService.findOne.mockRejectedValue(new Error('Rule not found'));

      const result = await service.evaluateRule(
        organizationId,
        ruleId,
        createMockContext(),
      );

      expect(result.success).toBe(false);
      expect(result.failedRules).toHaveLength(1);
      expect(result.failedRules[0].ruleId).toBe(ruleId);
    });
  });

  describe('custom operators', () => {
    it('should support country operators', async () => {
      const cachedRules: CachedRules = {
        rules: [
          {
            id: 'rule-1',
            name: 'Country Rule',
            priority: 0,
            config: {
              conditions: {
                all: [
                  {
                    fact: 'transaction.country',
                    operator: 'inCountry',
                    value: ['US', 'CA'],
                  },
                ],
              },
              event: { type: 'country-match', params: {} },
            },
          },
        ],
        cachedAt: Date.now(),
      };

      ruleCacheService.get.mockResolvedValue(cachedRules);

      const result = await service.evaluate(
        organizationId,
        createMockContext(),
      );

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('country-match');
    });

    it('should support aggregation operators', async () => {
      const cachedRules: CachedRules = {
        rules: [
          {
            id: 'rule-1',
            name: 'Sum Rule',
            priority: 0,
            config: {
              conditions: {
                all: [
                  {
                    // This will use the stubbed fact that returns 0
                    fact: 'transactionHistory',
                    operator: 'sumGreaterThan',
                    value: -1, // -1 so that 0 > -1 is true
                    params: {
                      aggregation: 'sum',
                      field: 'amount',
                      timeWindowDays: 7,
                    },
                  },
                ],
              },
              event: { type: 'sum-exceeded', params: {} },
            },
          },
        ],
        cachedAt: Date.now(),
      };

      ruleCacheService.get.mockResolvedValue(cachedRules);

      const result = await service.evaluate(
        organizationId,
        createMockContext(),
      );

      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('sum-exceeded');
    });
  });
});
