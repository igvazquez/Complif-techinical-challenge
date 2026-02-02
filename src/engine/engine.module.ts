import { Module } from '@nestjs/common';
import {
  EngineService,
  evaluationDurationHistogramProvider,
  evaluationTotalCounterProvider,
  rulesEvaluatedCounterProvider,
} from './engine.service';
import { EngineController } from './engine.controller';
import {
  RuleCacheService,
  ruleCacheHitCounterProvider,
} from './rule-cache.service';
import { TransactionHistoryFact } from './facts/transaction-history.fact';
import { AccountFact } from './facts/account.fact';
import { ListLookupFact } from './facts/list-lookup.fact';
import { RulesModule } from '../rules/rules.module';

@Module({
  imports: [RulesModule],
  controllers: [EngineController],
  providers: [
    EngineService,
    RuleCacheService,
    TransactionHistoryFact,
    AccountFact,
    ListLookupFact,
    // Prometheus metrics
    ruleCacheHitCounterProvider,
    evaluationDurationHistogramProvider,
    evaluationTotalCounterProvider,
    rulesEvaluatedCounterProvider,
  ],
  exports: [EngineService, RuleCacheService],
})
export class EngineModule {}
