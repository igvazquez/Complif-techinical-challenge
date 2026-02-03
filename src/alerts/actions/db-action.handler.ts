import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AlertActionHandler, ActionResult } from './action-handler.interface';
import { Alert } from '../entities/alert.entity';
import { AlertEventMessage } from '../dto';

@Injectable()
export class DbActionHandler implements AlertActionHandler {
  readonly actionType = 'db';

  constructor(
    @InjectPinoLogger(DbActionHandler.name)
    private readonly logger: PinoLogger,
  ) {}

  shouldExecute(): boolean {
    // DB action always runs
    return true;
  }

  execute(
    alert: Alert,
    event: AlertEventMessage,
    isNewAlert: boolean,
  ): ActionResult {
    try {
      this.logger.debug(
        {
          alertId: alert.id,
          ruleId: event.ruleId,
          isNewAlert,
          hitCount: alert.hitCount,
        },
        'DB action executed - alert persisted',
      );

      return {
        success: true,
        actionType: this.actionType,
        metadata: {
          alertId: alert.id,
          isNewAlert,
          hitCount: alert.hitCount,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorObj = error instanceof Error ? error : new Error(errorMessage);

      this.logger.error(
        { err: errorObj, alertId: alert.id },
        'DB action failed',
      );

      return {
        success: false,
        actionType: this.actionType,
        error: errorMessage,
      };
    }
  }
}
