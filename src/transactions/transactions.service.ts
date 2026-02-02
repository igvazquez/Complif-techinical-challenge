import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { makeCounterProvider, InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { Transaction } from './entities/transaction.entity';
import { CreateTransactionDto, TransactionResponseDto } from './dto';
import { EngineService } from '../engine/engine.service';
import { EvaluationContext } from '../engine/interfaces';
import { PaginationQuery, PaginatedResult } from '../common/interfaces';

export const transactionsProcessedCounterProvider = makeCounterProvider({
  name: 'transactions_processed_total',
  help: 'Total number of transactions processed',
  labelNames: ['organization_id', 'source', 'status'],
});

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly engineService: EngineService,
    @InjectPinoLogger(TransactionsService.name)
    private readonly logger: PinoLogger,
    @InjectMetric('transactions_processed_total')
    private readonly transactionsProcessed: Counter<string>,
  ) {}

  async create(
    organizationId: string,
    createDto: CreateTransactionDto,
  ): Promise<Transaction> {
    const transaction = this.transactionRepository.create({
      idOrganization: organizationId,
      idAccount: createDto.idAccount,
      amount: createDto.amount,
      amountNormalized: createDto.amountNormalized,
      currency: createDto.currency,
      type: createDto.type,
      subType: createDto.subType ?? null,
      datetime: new Date(createDto.datetime),
      date: createDto.date,
      isVoided: createDto.isVoided ?? false,
      isBlocked: createDto.isBlocked ?? false,
      isDeleted: createDto.isDeleted ?? false,
      origin: createDto.origin ?? null,
      deviceInfo: createDto.deviceInfo ?? null,
      data: createDto.data ?? {},
      externalCode: createDto.externalCode ?? null,
      country: createDto.country ?? null,
      counterpartyId: createDto.counterpartyId ?? null,
      counterpartyCountry: createDto.counterpartyCountry ?? null,
    });

    return this.transactionRepository.save(transaction);
  }

  async createAndEvaluate(
    organizationId: string,
    createDto: CreateTransactionDto,
    source: 'api' | 'queue' = 'api',
  ): Promise<TransactionResponseDto> {
    const transaction = await this.create(organizationId, createDto);

    let evaluationResult;
    try {
      const context: EvaluationContext = {
        transaction: {
          id: transaction.id,
          idAccount: transaction.idAccount,
          amount: Number(transaction.amount),
          amountNormalized: Number(transaction.amountNormalized),
          currency: transaction.currency,
          type: transaction.type,
          datetime: transaction.datetime,
          date: transaction.date,
          country: transaction.country,
          counterpartyId: transaction.counterpartyId,
          counterpartyCountry: transaction.counterpartyCountry,
          data: transaction.data,
        },
      };

      evaluationResult = await this.engineService.evaluate(
        organizationId,
        context,
      );

      this.transactionsProcessed.inc({
        organization_id: organizationId,
        source,
        status: 'success',
      });
    } catch (err: unknown) {
      // Fail-open: log error but don't fail the transaction storage
      this.logger.error(
        { err, transactionId: transaction.id, organizationId },
        'Failed to evaluate transaction rules, continuing with stored transaction',
      );

      this.transactionsProcessed.inc({
        organization_id: organizationId,
        source,
        status: 'evaluation_error',
      });

      evaluationResult = {
        success: false,
        events: [],
        failedRules: [],
        evaluatedRulesCount: 0,
        evaluationTimeMs: 0,
      };
    }

    return {
      transaction,
      evaluation: evaluationResult,
    };
  }

  async findOne(organizationId: string, id: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, idOrganization: organizationId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID "${id}" not found`);
    }

    return transaction;
  }

  async findByOrganization(
    organizationId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<Transaction>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.transactionRepository.findAndCount({
      where: { idOrganization: organizationId },
      order: { datetime: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
