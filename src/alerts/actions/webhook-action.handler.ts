import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AlertActionHandler, ActionResult } from './action-handler.interface';
import { Alert } from '../entities/alert.entity';
import { AlertEventMessage } from '../dto';

@Injectable()
export class WebhookActionHandler implements AlertActionHandler {
  readonly actionType = 'webhook';

  constructor(
    @InjectPinoLogger(WebhookActionHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  shouldExecute(event: AlertEventMessage): boolean {
    const actions = event.ruleConfig?.actions as string[] | undefined;
    return actions?.includes('webhook') ?? false;
  }

  execute(
    alert: Alert,
    event: AlertEventMessage,
    isNewAlert: boolean,
  ): ActionResult {
    // Stub implementation - webhook delivery to be implemented
    this.logger.info(
      {
        alertId: alert.id,
        ruleId: event.ruleId,
        isNewAlert,
      },
      'Webhook action triggered (stub)',
    );

    return {
      success: true,
      actionType: this.actionType,
      metadata: {
        stub: true,
        message: 'Webhook action not yet implemented',
      },
    };
  }
}
