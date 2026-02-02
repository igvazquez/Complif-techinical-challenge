import { Almanac } from 'json-rules-engine';

export interface FactProvider<TParams = unknown, TResult = unknown> {
  readonly factId: string;

  calculate(
    params: TParams,
    almanac: Almanac,
    organizationId: string,
  ): Promise<TResult>;
}

export interface TransactionHistoryParams {
  aggregation: 'sum' | 'count' | 'avg';
  field?: string;
  timeWindowDays: number;
  transactionType?: string;
  accountId?: string;
}

export interface ListLookupParams {
  listName: string;
  value: string;
}

export interface AccountParams {
  accountId: string;
  field?: string;
}
