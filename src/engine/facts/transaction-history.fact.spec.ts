/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TransactionHistoryFact } from './transaction-history.fact';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Almanac } from 'json-rules-engine';
import { generateUUID } from '../../../test/test-utils';

interface MockQueryBuilder {
  where: jest.Mock;
  andWhere: jest.Mock;
  select: jest.Mock;
  getRawOne: jest.Mock;
}

describe('TransactionHistoryFact', () => {
  let fact: TransactionHistoryFact;
  let mockAlmanac: Almanac;
  let mockQueryBuilder: MockQueryBuilder;

  beforeEach(async () => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ result: '0' }),
    };

    const mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(30),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionHistoryFact,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    fact = module.get<TransactionHistoryFact>(TransactionHistoryFact);
    mockAlmanac = {
      factValue: jest.fn().mockResolvedValue('account-123'),
    } as unknown as Almanac;
  });

  it('should be defined', () => {
    expect(fact).toBeDefined();
  });

  it('should have correct factId', () => {
    expect(fact.factId).toBe('transactionHistory');
  });

  describe('calculate', () => {
    it('should query transactions with sum aggregation', async () => {
      const params = {
        aggregation: 'sum' as const,
        field: 'amountNormalized',
        timeWindowDays: 7,
        transactionType: 'CASH_IN',
        accountId: generateUUID(),
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ result: '5000' });

      const result = await fact.calculate(params, mockAlmanac, generateUUID());

      expect(result).toBe(5000);
      expect(mockQueryBuilder.select).toHaveBeenCalled();
    });

    it('should query transactions with count aggregation', async () => {
      const params = {
        aggregation: 'count' as const,
        timeWindowDays: 30,
        accountId: generateUUID(),
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ result: '10' });

      const result = await fact.calculate(params, mockAlmanac, generateUUID());

      expect(result).toBe(10);
    });

    it('should query transactions with avg aggregation', async () => {
      const params = {
        aggregation: 'avg' as const,
        field: 'amountNormalized',
        timeWindowDays: 14,
        accountId: generateUUID(),
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ result: '2500.50' });

      const result = await fact.calculate(params, mockAlmanac, generateUUID());

      expect(result).toBe(2500.5);
    });

    it('should get accountId from almanac if not in params', async () => {
      const params = {
        aggregation: 'count' as const,
        timeWindowDays: 7,
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ result: '5' });

      const result = await fact.calculate(params, mockAlmanac, generateUUID());

      expect(mockAlmanac.factValue).toHaveBeenCalledWith(
        'transaction.idAccount',
      );
      expect(result).toBe(5);
    });

    it('should return 0 if no accountId is available', async () => {
      const params = {
        aggregation: 'sum' as const,
        timeWindowDays: 7,
      };

      (mockAlmanac.factValue as jest.Mock).mockResolvedValue(undefined);

      const result = await fact.calculate(params, mockAlmanac, generateUUID());

      expect(result).toBe(0);
    });

    it('should filter by transaction type when provided', async () => {
      const params = {
        aggregation: 'sum' as const,
        timeWindowDays: 7,
        transactionType: 'CASH_OUT',
        accountId: generateUUID(),
      };

      mockQueryBuilder.getRawOne.mockResolvedValue({ result: '3000' });

      await fact.calculate(params, mockAlmanac, generateUUID());

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.type = :transactionType',
        { transactionType: 'CASH_OUT' },
      );
    });

    it('should return 0 for invalid aggregation type', async () => {
      const params = {
        aggregation: 'invalid' as 'sum',
        timeWindowDays: 7,
        accountId: generateUUID(),
      };

      const result = await fact.calculate(params, mockAlmanac, generateUUID());

      expect(result).toBe(0);
    });
  });
});
