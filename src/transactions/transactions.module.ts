import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsController } from './transactions.controller';
import {
  TransactionsService,
  transactionsProcessedCounterProvider,
} from './transactions.service';
import { TransactionsConsumer } from './transactions.consumer';
import { Transaction } from './entities/transaction.entity';
import { EngineModule } from '../engine/engine.module';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), EngineModule],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    TransactionsConsumer,
    transactionsProcessedCounterProvider,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
