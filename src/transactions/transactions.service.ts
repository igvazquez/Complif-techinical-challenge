import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Repository, DeepPartial } from 'typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { makeCounterProvider, InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { Transaction } from './entities/transaction.entity';
import { CreateTransactionDto, TransactionResponseDto } from './dto';
import { EngineService } from '../engine/engine.service';
import { EvaluationContext, RuleEvent } from '../engine/interfaces';
import { PaginationQuery, PaginatedResult } from '../common/interfaces';
import type { AlertEventMessage } from '../alerts/dto';

export const transactionsProcessedCounterProvider = makeCounterProvider({
  name: 'transactions_processed_total',
  help: 'Total number of transactions processed',
  labelNames: ['organization_id', 'source', 'status'],
});

export const ALERTS_SERVICE = 'ALERTS_SERVICE';

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
    @Inject(ALERTS_SERVICE)
    private readonly alertClient: ClientProxy,
  ) {}

  async create(
    organizationId: string,
    createDto: CreateTransactionDto,
  ): Promise<Transaction> {
    const transactionData: DeepPartial<Transaction> = {
      idOrganization: organizationId,
      idAccount: createDto.idAccount,
      amount: createDto.amount,
      amountNormalized: createDto.amountNormalized,
      currency: createDto.currency,
      type: createDto.type,
      subType: createDto.subType,
      datetime: new Date(createDto.datetime),
      date: createDto.date,
      isVoided: createDto.isVoided ?? false,
      isBlocked: createDto.isBlocked ?? false,
      isDeleted: createDto.isDeleted ?? false,
      origin: createDto.origin,
      deviceInfo: createDto.deviceInfo,
      data: createDto.data ?? {},
      externalCode: createDto.externalCode,
      country: createDto.country,
      counterpartyId: createDto.counterpartyId,
      counterpartyCountry: createDto.counterpartyCountry,
    };
    const transaction = this.transactionRepository.create(transactionData);

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

      // Publish alert events for each triggered rule
      if (evaluationResult.events.length > 0) {
        this.publishAlertEvents(
          organizationId,
          transaction,
          evaluationResult.events,
        );
      }

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

  private publishAlertEvents(
    organizationId: string,
    transaction: Transaction,
    events: RuleEvent[],
  ): void {
    for (const event of events) {
      const alertMessage: AlertEventMessage = {
        organizationId,
        transactionId: transaction.id,
        accountId: transaction.idAccount,
        ruleId: event.params.ruleId,
        ruleName: event.params.ruleName,
        severity: (event.params.severity as string) || 'MEDIUM',
        category: (event.params.category as string) || 'UNKNOWN',
        eventType: event.type,
        eventParams: event.params,
        transactionDatetime: transaction.datetime.toISOString(),
        ruleConfig: event.params.ruleConfig as Record<string, unknown>,
      };

      this.alertClient.emit('alerts', alertMessage);

      this.logger.debug(
        {
          organizationId,
          transactionId: transaction.id,
          ruleId: event.params.ruleId,
        },
        'Alert event published',
      );
    }
  }
}
