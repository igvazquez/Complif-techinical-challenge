import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AlertsService } from './alerts.service';
import type { AlertEventMessage } from './dto';

@Controller()
export class AlertsConsumer {
  constructor(
    private readonly alertsService: AlertsService,
    @InjectPinoLogger(AlertsConsumer.name)
    private readonly logger: PinoLogger,
  ) {}

  @EventPattern('alerts')
  async handleAlertEvent(
    @Payload() data: AlertEventMessage,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      this.logger.debug(
        {
          organizationId: data.organizationId,
          ruleId: data.ruleId,
          transactionId: data.transactionId,
        },
        'Processing alert event',
      );

      await this.alertsService.processAlertEvent(data);

      this.logger.debug(
        {
          organizationId: data.organizationId,
          ruleId: data.ruleId,
        },
        'Alert event processed successfully',
      );
    } catch (err: unknown) {
      // Fail-open: log error but acknowledge to prevent requeuing
      this.logger.error(
        {
          err,
          organizationId: data.organizationId,
          ruleId: data.ruleId,
          transactionId: data.transactionId,
        },
        'Failed to process alert event',
      );
    } finally {
      // Always acknowledge the message
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      channel.ack(originalMsg);
    }
  }
}
