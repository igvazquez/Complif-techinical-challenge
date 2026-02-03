import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TransactionsController } from './transactions.controller';
import {
  TransactionsService,
  transactionsProcessedCounterProvider,
  ALERTS_SERVICE,
} from './transactions.service';
import { TransactionsConsumer } from './transactions.consumer';
import { Transaction } from './entities/transaction.entity';
import { EngineModule } from '../engine/engine.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    EngineModule,
    ClientsModule.registerAsync([
      {
        name: ALERTS_SERVICE,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>('rabbitmq.url') ??
                'amqp://localhost:5672',
            ],
            queue: 'alerts',
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),
  ],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    TransactionsConsumer,
    transactionsProcessedCounterProvider,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
