import { Injectable } from '@nestjs/common';
import { Almanac } from 'json-rules-engine';
import {
  FactProvider,
  ListLookupParams,
  FactReference,
} from '../interfaces/fact-provider.interface';
import { ListsService } from '../../lists/lists.service';
import { ListType, EntityType } from '../../lists/entities/list-entry.entity';

@Injectable()
export class ListLookupFact implements FactProvider<ListLookupParams, boolean> {
  readonly factId = 'listLookup';

  constructor(private readonly listsService: ListsService) {}

  async calculate(
    params: ListLookupParams,
    almanac: Almanac,
    organizationId: string,
  ): Promise<boolean> {
    const listType = params.listType as ListType;
    const entityType = params.entityType as EntityType;

    // Resolve value - it can be a static string or a dynamic fact reference
    let resolvedValue: string;
    if (this.isFactReference(params.value)) {
      // Dynamic fact reference - resolve it from the almanac
      const factValue = await almanac.factValue<string | undefined>(
        params.value.fact,
      );
      if (!factValue) {
        return false;
      }
      resolvedValue = factValue;
    } else {
      // Static string value
      resolvedValue = params.value;
    }

    return this.listsService.isInList(
      organizationId,
      listType,
      entityType,
      resolvedValue,
    );
  }

  private isFactReference(value: string | FactReference): value is FactReference {
    return (
      typeof value === 'object' &&
      value !== null &&
      'fact' in value &&
      typeof value.fact === 'string'
    );
  }
}
