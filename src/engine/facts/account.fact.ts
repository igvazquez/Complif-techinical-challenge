import { Injectable } from '@nestjs/common';
import { Almanac } from 'json-rules-engine';
import {
  FactProvider,
  AccountParams,
} from '../interfaces/fact-provider.interface';

interface AccountData {
  id: string;
  type: string;
  status: string;
  country: string;
  riskScore: number;
  data: Record<string, unknown>;
}

type AccountFieldValue = string | number | Record<string, unknown>;

@Injectable()
export class AccountFact implements FactProvider<
  AccountParams,
  AccountData | AccountFieldValue | null
> {
  readonly factId = 'account';

  async calculate(
    params: AccountParams,
    almanac: Almanac,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _organizationId: string,
  ): Promise<AccountData | AccountFieldValue | null> {
    // Stub implementation - returns mock data until Accounts module is implemented
    // TODO: Implement actual account lookup
    //
    // Expected behavior:
    // - Query accounts table for the given accountId
    // - If field is specified, return only that field
    // - Otherwise, return full account data

    const { accountId, field } = params;

    // Try to get account from context first
    try {
      const context = await almanac.factValue<{ account?: AccountData }>(
        'context',
      );
      if (context?.account && context.account.id === accountId) {
        if (field) {
          return context.account[field as keyof AccountData];
        }
        return context.account;
      }
    } catch {
      // Context not available, use mock data
    }

    // Return mock data as stub
    const mockAccount: AccountData = {
      id: accountId,
      type: 'INDIVIDUAL',
      status: 'ACTIVE',
      country: 'US',
      riskScore: 50,
      data: {},
    };

    if (field) {
      return mockAccount[field as keyof AccountData];
    }

    return mockAccount;
  }
}
