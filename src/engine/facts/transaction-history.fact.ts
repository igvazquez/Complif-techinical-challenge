import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Almanac } from 'json-rules-engine';
import {
  FactProvider,
  TransactionHistoryParams,
} from '../interfaces/fact-provider.interface';
import { Transaction } from '../../transactions/entities/transaction.entity';

@Injectable()
export class TransactionHistoryFact implements FactProvider<
  TransactionHistoryParams,
  number
> {
  readonly factId = 'transactionHistory';
  private readonly maxTimeWindowDays: number;

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly configService: ConfigService,
  ) {
    this.maxTimeWindowDays = this.configService.get<number>(
      'ruleEngine.maxTimeWindowDays',
      30,
    );
  }

  async calculate(
    params: TransactionHistoryParams,
    almanac: Almanac,
    organizationId: string,
  ): Promise<number> {
    const {
      aggregation,
      field = 'amountNormalized',
      timeWindowDays,
      transactionType,
    } = params;

    // Get accountId from params or from the current transaction context
    let accountId = params.accountId;
    if (!accountId) {
      // Try to get from almanac - the transaction.idAccount fact should be set
      const txIdAccount = await almanac.factValue<string | undefined>(
        'transaction.idAccount',
      );
      if (txIdAccount) {
        accountId = txIdAccount;
      }
    }

    if (!accountId) {
      return 0;
    }

    // Enforce max time window
    const effectiveTimeWindow = Math.min(
      timeWindowDays,
      this.maxTimeWindowDays,
    );
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - effectiveTimeWindow);

    // Build query using property names (TypeORM queryBuilder)
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('tx')
      .where('tx.idOrganization = :organizationId', { organizationId })
      .andWhere('tx.idAccount = :accountId', { accountId })
      .andWhere('tx.datetime > :startDate', { startDate })
      .andWhere('tx.isVoided = false')
      .andWhere('tx.isDeleted = false');

    // Filter by transaction type if provided
    if (transactionType) {
      queryBuilder.andWhere('tx.type = :transactionType', { transactionType });
    }

    // Apply aggregation using property names
    switch (aggregation) {
      case 'sum':
        queryBuilder.select(
          `COALESCE(SUM(tx.${this.getPropertyName(field)}), 0)`,
          'result',
        );
        break;
      case 'count':
        queryBuilder.select('COUNT(*)', 'result');
        break;
      case 'avg':
        queryBuilder.select(
          `COALESCE(AVG(tx.${this.getPropertyName(field)}), 0)`,
          'result',
        );
        break;
      default:
        return 0;
    }

    const result = await queryBuilder.getRawOne<{ result: string }>();
    return result ? parseFloat(result.result) : 0;
  }

  private getPropertyName(field: string): string {
    // Map field names to TypeORM property names
    const fieldMap: Record<string, string> = {
      amount: 'amount',
      amountNormalized: 'amountNormalized',
    };
    return fieldMap[field] || 'amountNormalized';
  }
}
