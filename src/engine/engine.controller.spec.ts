import { Test, TestingModule } from '@nestjs/testing';
import { EngineController } from './engine.controller';
import { EngineService } from './engine.service';
import { EvaluateTransactionDto } from './dto';
import { EvaluationResult } from './interfaces';

describe('EngineController', () => {
  let controller: EngineController;

  const mockEvaluationResult: EvaluationResult = {
    triggered: false,
    events: [],
    failedRules: [],
  };

  const mockTriggeredResult: EvaluationResult = {
    triggered: true,
    events: [
      {
        type: 'HIGH_VALUE',
        params: { severity: 'high' },
      },
    ],
    failedRules: [],
  };

  const mockEngineService = {
    evaluate: jest.fn(),
    evaluateRule: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EngineController],
      providers: [
        {
          provide: EngineService,
          useValue: mockEngineService,
        },
      ],
    }).compile();

    controller = module.get<EngineController>(EngineController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('evaluate', () => {
    it('should evaluate transaction against all rules', async () => {
      const organizationId = 'org-123';
      const dto: EvaluateTransactionDto = {
        transaction: {
          type: 'TRANSFER',
          amount: 5000,
          currency: 'USD',
          originAccount: 'account-1',
          destinationAccount: 'account-2',
          datetime: '2024-01-15T10:30:00Z',
        },
        account: {
          id: 'account-1',
          balance: 10000,
          status: 'active',
        },
        metadata: {},
      };

      mockEngineService.evaluate.mockResolvedValue(mockEvaluationResult);

      const result = await controller.evaluate(organizationId, dto);

      expect(result).toEqual(mockEvaluationResult);
      expect(mockEngineService.evaluate).toHaveBeenCalledWith(organizationId, {
        transaction: {
          ...dto.transaction,
          datetime: expect.any(Date) as unknown,
        },
        account: dto.account,
        metadata: dto.metadata,
      });
    });

    it('should return triggered events when rules fire', async () => {
      const organizationId = 'org-123';
      const dto: EvaluateTransactionDto = {
        transaction: {
          type: 'TRANSFER',
          amount: 50000,
          currency: 'USD',
          originAccount: 'account-1',
          destinationAccount: 'account-2',
          datetime: '2024-01-15T10:30:00Z',
        },
        account: {
          id: 'account-1',
          balance: 100000,
          status: 'active',
        },
      };

      mockEngineService.evaluate.mockResolvedValue(mockTriggeredResult);

      const result = await controller.evaluate(organizationId, dto);

      expect(result).toEqual(mockTriggeredResult);
      expect(result.triggered).toBe(true);
      expect(result.events).toHaveLength(1);
    });

    it('should convert datetime string to Date object', async () => {
      const organizationId = 'org-123';
      const datetimeString = '2024-01-15T10:30:00Z';
      const dto: EvaluateTransactionDto = {
        transaction: {
          type: 'DEPOSIT',
          amount: 1000,
          currency: 'USD',
          destinationAccount: 'account-1',
          datetime: datetimeString,
        },
      };

      mockEngineService.evaluate.mockResolvedValue(mockEvaluationResult);

      await controller.evaluate(organizationId, dto);

      expect(mockEngineService.evaluate).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({
          transaction: expect.objectContaining({
            datetime: new Date(datetimeString),
          }) as unknown,
        }) as unknown,
      );
    });
  });

  describe('evaluateRule', () => {
    it('should evaluate transaction against a specific rule', async () => {
      const organizationId = 'org-123';
      const ruleId = 'rule-123';
      const dto: EvaluateTransactionDto = {
        transaction: {
          type: 'TRANSFER',
          amount: 5000,
          currency: 'USD',
          originAccount: 'account-1',
          destinationAccount: 'account-2',
          datetime: '2024-01-15T10:30:00Z',
        },
        account: {
          id: 'account-1',
          balance: 10000,
          status: 'active',
        },
      };

      mockEngineService.evaluateRule.mockResolvedValue(mockEvaluationResult);

      const result = await controller.evaluateRule(organizationId, ruleId, dto);

      expect(result).toEqual(mockEvaluationResult);
      expect(mockEngineService.evaluateRule).toHaveBeenCalledWith(
        organizationId,
        ruleId,
        {
          transaction: {
            ...dto.transaction,
            datetime: expect.any(Date) as unknown,
          },
          account: dto.account,
          metadata: dto.metadata,
        },
      );
    });

    it('should handle rule that triggers an event', async () => {
      const organizationId = 'org-123';
      const ruleId = 'high-value-rule';
      const dto: EvaluateTransactionDto = {
        transaction: {
          type: 'TRANSFER',
          amount: 100000,
          currency: 'USD',
          originAccount: 'account-1',
          destinationAccount: 'account-2',
          datetime: '2024-01-15T10:30:00Z',
        },
      };

      mockEngineService.evaluateRule.mockResolvedValue(mockTriggeredResult);

      const result = await controller.evaluateRule(organizationId, ruleId, dto);

      expect(result.triggered).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('HIGH_VALUE');
    });
  });
});
