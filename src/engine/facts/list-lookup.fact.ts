import { Injectable } from '@nestjs/common';
import { Almanac } from 'json-rules-engine';
import {
  FactProvider,
  ListLookupParams,
} from '../interfaces/fact-provider.interface';
import { ListsService } from '../../lists/lists.service';
import { ListType, EntityType } from '../../lists/entities/list-entry.entity';

@Injectable()
export class ListLookupFact implements FactProvider<ListLookupParams, boolean> {
  readonly factId = 'listLookup';

  constructor(private readonly listsService: ListsService) {}

  async calculate(
    params: ListLookupParams,

    _almanac: Almanac,
    organizationId: string,
  ): Promise<boolean> {
    const listType = params.listType as ListType;
    const entityType = params.entityType as EntityType;
    const { value } = params;

    return this.listsService.isInList(
      organizationId,
      listType,
      entityType,
      value,
    );
  }
}
