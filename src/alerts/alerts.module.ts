import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsController } from './alerts.controller';
import {
  AlertsService,
  alertsCreatedCounterProvider,
  alertsDeduplicatedCounterProvider,
  alertActionDurationHistogramProvider,
} from './alerts.service';
import { AlertsConsumer } from './alerts.consumer';
import { Alert } from './entities/alert.entity';
import {
  DbActionHandler,
  WebhookActionHandler,
  QueueActionHandler,
  BlockActionHandler,
} from './actions';

@Module({
  imports: [TypeOrmModule.forFeature([Alert])],
  controllers: [AlertsController, AlertsConsumer],
  providers: [
    AlertsService,
    // Action handlers
    DbActionHandler,
    WebhookActionHandler,
    QueueActionHandler,
    BlockActionHandler,
    // Metrics
    alertsCreatedCounterProvider,
    alertsDeduplicatedCounterProvider,
    alertActionDurationHistogramProvider,
  ],
  exports: [AlertsService],
})
export class AlertsModule {}
