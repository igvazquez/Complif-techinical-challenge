import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AlertActionHandler, ActionResult } from './action-handler.interface';
import { Alert } from '../entities/alert.entity';
import { AlertEventMessage } from '../dto';

@Injectable()
export class QueueActionHandler implements AlertActionHandler {
  readonly actionType = 'queue';

  constructor(
    @InjectPinoLogger(QueueActionHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  shouldExecute(event: AlertEventMessage): boolean {
    const actions = event.ruleConfig?.actions as string[] | undefined;
    return actions?.includes('queue') ?? false;
  }

  execute(
    alert: Alert,
    event: AlertEventMessage,
    isNewAlert: boolean,
  ): ActionResult {
    // Stub implementation - queue publishing to be implemented
    this.logger.info(
      {
        alertId: alert.id,
        ruleId: event.ruleId,
        isNewAlert,
      },
      'Queue action triggered (stub)',
    );

    return {
      success: true,
      actionType: this.actionType,
      metadata: {
        stub: true,
        message: 'Queue action not yet implemented',
      },
    };
  }
}
