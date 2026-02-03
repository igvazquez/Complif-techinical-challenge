import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AlertActionHandler, ActionResult } from './action-handler.interface';
import { Alert } from '../entities/alert.entity';
import { AlertEventMessage } from '../dto';

@Injectable()
export class BlockActionHandler implements AlertActionHandler {
  readonly actionType = 'block';

  constructor(
    @InjectPinoLogger(BlockActionHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  shouldExecute(event: AlertEventMessage): boolean {
    const actions = event.ruleConfig?.actions as string[] | undefined;
    return actions?.includes('block') ?? false;
  }

  execute(
    alert: Alert,
    event: AlertEventMessage,
    isNewAlert: boolean,
  ): ActionResult {
    // Stub implementation - transaction blocking to be implemented
    this.logger.info(
      {
        alertId: alert.id,
        ruleId: event.ruleId,
        transactionId: event.transactionId,
        isNewAlert,
      },
      'Block action triggered (stub)',
    );

    return {
      success: true,
      actionType: this.actionType,
      metadata: {
        stub: true,
        message: 'Block action not yet implemented',
      },
    };
  }
}
