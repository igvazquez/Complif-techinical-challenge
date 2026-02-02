import { TransactionHistoryFact } from './transaction-history.fact';
import { Almanac } from 'json-rules-engine';
import { generateUUID } from '../../../test/test-utils';

describe('TransactionHistoryFact', () => {
  let fact: TransactionHistoryFact;
  let mockAlmanac: Almanac;

  beforeEach(() => {
    fact = new TransactionHistoryFact();
    mockAlmanac = {
      factValue: jest.fn(),
    } as unknown as Almanac;
  });

  it('should be defined', () => {
    expect(fact).toBeDefined();
  });

  it('should have correct factId', () => {
    expect(fact.factId).toBe('transactionHistory');
  });

  describe('calculate', () => {
    it('should return 0 as a stub implementation', async () => {
      const params = {
        aggregation: 'sum' as const,
        field: 'amount',
        timeWindowDays: 7,
        transactionType: 'CASH_IN',
        accountId: generateUUID(),
      };

      const result = await fact.calculate(
        params,
        mockAlmanac,
        generateUUID(),
      );

      expect(result).toBe(0);
    });

    it('should handle count aggregation', async () => {
      const params = {
        aggregation: 'count' as const,
        timeWindowDays: 30,
      };

      const result = await fact.calculate(
        params,
        mockAlmanac,
        generateUUID(),
      );

      expect(result).toBe(0);
    });

    it('should handle avg aggregation', async () => {
      const params = {
        aggregation: 'avg' as const,
        field: 'amountNormalized',
        timeWindowDays: 14,
      };

      const result = await fact.calculate(
        params,
        mockAlmanac,
        generateUUID(),
      );

      expect(result).toBe(0);
    });
  });
});
