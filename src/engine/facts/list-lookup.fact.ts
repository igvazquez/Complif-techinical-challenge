import { Injectable } from '@nestjs/common';
import { Almanac } from 'json-rules-engine';
import {
  FactProvider,
  ListLookupParams,
} from '../interfaces/fact-provider.interface';

@Injectable()
export class ListLookupFact implements FactProvider<ListLookupParams, boolean> {
  readonly factId = 'listLookup';

  calculate(
    params: ListLookupParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _almanac: Almanac,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _organizationId: string,
  ): Promise<boolean> {
    // Stub implementation - returns false until Lists module is implemented in Phase 7
    // TODO: Implement actual list lookup
    //
    // Expected behavior:
    // - Query the specified list (blacklist, whitelist, etc.) for the organization
    // - Return true if value is found in the list, false otherwise
    //
    // Example params:
    // {
    //   listName: 'sanctioned_countries',
    //   value: 'IR'
    // }
    // or
    // {
    //   listName: 'blocked_accounts',
    //   value: 'acc-123'
    // }

    const { listName, value } = params;

    // Log stub usage for debugging
    void listName;
    void value;

    return Promise.resolve(false);
  }
}
