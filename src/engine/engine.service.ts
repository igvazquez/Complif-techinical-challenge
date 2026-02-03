import { Injectable, OnModuleInit } from '@nestjs/common';
import { Engine, RuleProperties, EngineResult } from 'json-rules-engine';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  makeHistogramProvider,
  makeCounterProvider,
  InjectMetric,
} from '@willsoto/nestjs-prometheus';
import { Histogram, Counter } from 'prom-client';
import { RulesService } from '../rules/rules.service';
import {
  RuleCacheService,
  CachedRule,
  CachedRules,
} from './rule-cache.service';
import { registerAllOperators } from './operators';
import { TransactionHistoryFact } from './facts/transaction-history.fact';
import { AccountFact } from './facts/account.fact';
import { ListLookupFact } from './facts/list-lookup.fact';
import {
  EvaluationContext,
  EvaluationResult,
  RuleEvent,
  FailedRule,
  TransactionHistoryParams,
  AccountParams,
  ListLookupParams,
} from './interfaces';

export const evaluationDurationHistogramProvider = makeHistogramProvider({
  name: 'rule_evaluation_duration_seconds',
  help: 'Duration of rule evaluation in seconds',
  labelNames: ['organization_id'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

export const evaluationTotalCounterProvider = makeCounterProvider({
  name: 'rule_evaluation_total',
  help: 'Total number of rule evaluations',
  labelNames: ['organization_id', 'status'],
});

export const rulesEvaluatedCounterProvider = makeCounterProvider({
  name: 'rules_evaluated_total',
  help: 'Total number of individual rules evaluated',
  labelNames: ['organization_id'],
});

@Injectable()
export class EngineService implements OnModuleInit {
  private engine: Engine;

  constructor(
    private readonly rulesService: RulesService,
    private readonly ruleCacheService: RuleCacheService,
    private readonly transactionHistoryFact: TransactionHistoryFact,
    private readonly accountFact: AccountFact,
    private readonly listLookupFact: ListLookupFact,
    @InjectPinoLogger(EngineService.name)
    private readonly logger: PinoLogger,
    @InjectMetric('rule_evaluation_duration_seconds')
    private readonly evaluationDuration: Histogram<string>,
    @InjectMetric('rule_evaluation_total')
    private readonly evaluationTotal: Counter<string>,
    @InjectMetric('rules_evaluated_total')
    private readonly rulesEvaluated: Counter<string>,
  ) {
    this.engine = new Engine([], { allowUndefinedFacts: true });
    registerAllOperators(this.engine);
  }

  onModuleInit(): void {
    this.registerFacts();
    this.logger.info(
      'Engine service initialized with custom operators and facts',
    );
  }

  private registerFacts(): void {
    // Register dynamic facts that use providers
    this.engine.addFact('transactionHistory', async (params, almanac) => {
      const organizationId = await almanac.factValue<string>('organizationId');
      return this.transactionHistoryFact.calculate(
        params as TransactionHistoryParams,
        almanac,
        organizationId,
      );
    });

    this.engine.addFact('account', async (params, almanac) => {
      const organizationId = await almanac.factValue<string>('organizationId');
      return this.accountFact.calculate(
        params as AccountParams,
        almanac,
        organizationId,
      );
    });

    this.engine.addFact('listLookup', async (params, almanac) => {
      const organizationId = await almanac.factValue<string>('organizationId');
      return this.listLookupFact.calculate(
        params as ListLookupParams,
        almanac,
        organizationId,
      );
    });
  }

  async evaluate(
    organizationId: string,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const startTime = process.hrtime.bigint();
    const failedRules: FailedRule[] = [];
    const events: RuleEvent[] = [];

    try {
      // Get rules (from cache or database)
      const cachedRules = await this.getCachedRules(organizationId);
      const rules = cachedRules.rules;

      if (rules.length === 0) {
        return this.buildResult(events, failedRules, 0, startTime);
      }

      // Evaluate each rule
      for (const rule of rules) {
        try {
          const result = await this.evaluateSingleRule(
            rule,
            context,
            organizationId,
          );

          if (result.events.length > 0) {
            for (const event of result.events) {
              events.push({
                type: event.type,
                params: {
                  ruleId: rule.id,
                  ruleName: rule.name,
                  ...(event.params as Record<string, unknown>),
                  ruleConfig: rule.config,
                },
              });
            }
          }
        } catch (error: unknown) {
          // Fail-open: log error but don't block evaluation
          const errorObj =
            error instanceof Error ? error : new Error('Unknown error');
          this.logger.warn(
            { err: errorObj, ruleId: rule.id, ruleName: rule.name },
            'Rule evaluation failed, continuing with next rule',
          );
          failedRules.push({
            ruleId: rule.id,
            ruleName: rule.name,
            error: errorObj.message,
          });
        }
      }

      this.rulesEvaluated.inc(
        { organization_id: organizationId },
        rules.length,
      );
      this.evaluationTotal.inc({
        organization_id: organizationId,
        status: 'success',
      });

      return this.buildResult(events, failedRules, rules.length, startTime);
    } catch (error: unknown) {
      const errorObj =
        error instanceof Error ? error : new Error('Unknown error');
      this.logger.error({ err: errorObj, organizationId }, 'Evaluation failed');
      this.evaluationTotal.inc({
        organization_id: organizationId,
        status: 'error',
      });

      // Fail-open: return empty result instead of throwing
      return this.buildResult(events, failedRules, 0, startTime);
    } finally {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      this.evaluationDuration.observe(
        { organization_id: organizationId },
        durationMs / 1000,
      );
    }
  }

  async evaluateRule(
    organizationId: string,
    ruleId: string,
    context: EvaluationContext,
  ): Promise<EvaluationResult> {
    const startTime = process.hrtime.bigint();
    const failedRules: FailedRule[] = [];
    const events: RuleEvent[] = [];

    try {
      const rule = await this.rulesService.findOne(organizationId, ruleId);
      const effectiveConfig = await this.rulesService.getEffectiveConfig(
        organizationId,
        rule,
      );

      const cachedRule: CachedRule = {
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
        config: effectiveConfig,
      };

      const result = await this.evaluateSingleRule(
        cachedRule,
        context,
        organizationId,
      );

      if (result.events.length > 0) {
        for (const event of result.events) {
          events.push({
            type: event.type,
            params: {
              ruleId: rule.id,
              ruleName: rule.name,
              ...(event.params as Record<string, unknown>),
              ruleConfig: effectiveConfig,
            },
          });
        }
      }

      this.rulesEvaluated.inc({ organization_id: organizationId }, 1);
      this.evaluationTotal.inc({
        organization_id: organizationId,
        status: 'success',
      });

      return this.buildResult(events, failedRules, 1, startTime);
    } catch (error: unknown) {
      const errorObj =
        error instanceof Error ? error : new Error('Unknown error');
      this.logger.error(
        { err: errorObj, organizationId, ruleId },
        'Single rule evaluation failed',
      );
      this.evaluationTotal.inc({
        organization_id: organizationId,
        status: 'error',
      });

      failedRules.push({
        ruleId,
        ruleName: 'Unknown',
        error: errorObj.message,
      });

      return this.buildResult(events, failedRules, 0, startTime);
    } finally {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      this.evaluationDuration.observe(
        { organization_id: organizationId },
        durationMs / 1000,
      );
    }
  }

  private async evaluateSingleRule(
    rule: CachedRule,
    context: EvaluationContext,
    organizationId: string,
  ): Promise<EngineResult> {
    const config = rule.config;

    // Build the rule for json-rules-engine
    const ruleDefinition: RuleProperties = {
      name: rule.name,
      conditions: config.conditions as RuleProperties['conditions'],
      event: config.event as RuleProperties['event'],
      priority: rule.priority,
    };

    // Create a temporary engine for this rule
    const tempEngine = new Engine([], { allowUndefinedFacts: true });
    registerAllOperators(tempEngine);

    // Register facts on temp engine
    tempEngine.addFact('transactionHistory', async (params, almanac) => {
      return this.transactionHistoryFact.calculate(
        params as TransactionHistoryParams,
        almanac,
        organizationId,
      );
    });

    tempEngine.addFact('account', async (params, almanac) => {
      return this.accountFact.calculate(
        params as AccountParams,
        almanac,
        organizationId,
      );
    });

    tempEngine.addFact('listLookup', async (params, almanac) => {
      return this.listLookupFact.calculate(
        params as ListLookupParams,
        almanac,
        organizationId,
      );
    });

    tempEngine.addRule(ruleDefinition);

    // Build facts from context
    const facts: Record<string, unknown> = {
      organizationId,
      context,
      transaction: context.transaction,
      'transaction.id': context.transaction.id,
      'transaction.idAccount': context.transaction.idAccount,
      'transaction.amount': context.transaction.amount,
      'transaction.amountNormalized': context.transaction.amountNormalized,
      'transaction.currency': context.transaction.currency,
      'transaction.type': context.transaction.type,
      'transaction.datetime': context.transaction.datetime,
      'transaction.date': context.transaction.date,
      'transaction.country': context.transaction.country,
      'transaction.counterpartyId': context.transaction.counterpartyId,
      'transaction.counterpartyCountry':
        context.transaction.counterpartyCountry,
      'transaction.data': context.transaction.data,
    };

    if (context.account) {
      facts.account = context.account;
      facts['account.id'] = context.account.id;
      facts['account.type'] = context.account.type;
      facts['account.status'] = context.account.status;
      facts['account.country'] = context.account.country;
      facts['account.riskScore'] = context.account.riskScore;
    }

    if (context.metadata) {
      facts.metadata = context.metadata;
    }

    return tempEngine.run(facts);
  }

  private async getCachedRules(organizationId: string): Promise<CachedRules> {
    // Try cache first
    const cached = await this.ruleCacheService.get(organizationId);
    if (cached) {
      return cached;
    }

    // Load from database
    const rules = await this.rulesService.findEnabledByPriority(organizationId);

    // Build cached rules with effective configs
    const cachedRules: CachedRule[] = [];
    for (const rule of rules) {
      const effectiveConfig = await this.rulesService.getEffectiveConfig(
        organizationId,
        rule,
      );
      cachedRules.push({
        id: rule.id,
        name: rule.name,
        priority: rule.priority,
        config: effectiveConfig,
      });
    }

    const cachedData: CachedRules = {
      rules: cachedRules,
      cachedAt: Date.now(),
    };

    // Store in cache
    await this.ruleCacheService.set(organizationId, cachedData);

    return cachedData;
  }

  private buildResult(
    events: RuleEvent[],
    failedRules: FailedRule[],
    evaluatedCount: number,
    startTime: bigint,
  ): EvaluationResult {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    return {
      success: failedRules.length === 0,
      events,
      failedRules,
      evaluatedRulesCount: evaluatedCount,
      evaluationTimeMs: Math.round(durationMs * 100) / 100,
    };
  }
}
