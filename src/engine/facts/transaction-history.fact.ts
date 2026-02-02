import { Injectable } from '@nestjs/common';
import { Almanac } from 'json-rules-engine';
import {
  FactProvider,
  TransactionHistoryParams,
} from '../interfaces/fact-provider.interface';

@Injectable()
export class TransactionHistoryFact implements FactProvider<
  TransactionHistoryParams,
  number
> {
  readonly factId = 'transactionHistory';

  calculate(
    params: TransactionHistoryParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _almanac: Almanac,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _organizationId: string,
  ): Promise<number> {
    // Stub implementation - returns 0 until Transactions module is implemented in Phase 5
    // TODO: Implement actual transaction history aggregation
    //
    // Expected behavior:
    // - Query transactions table for the given account within timeWindowDays
    // - Filter by transactionType if provided
    // - Apply aggregation (sum, count, avg) on the specified field
    //
    // Example params:
    // {
    //   aggregation: 'sum',
    //   field: 'amountNormalized',
    //   timeWindowDays: 7,
    //   transactionType: 'CASH_IN',
    //   accountId: 'acc-123'
    // }

    const { aggregation, field, timeWindowDays, transactionType, accountId } =
      params;

    // Log stub usage for debugging
    void aggregation;
    void field;
    void timeWindowDays;
    void transactionType;
    void accountId;

    return Promise.resolve(0);
  }
}
