import { Alert } from '../entities/alert.entity';
import { AlertEventMessage } from '../dto';

export interface ActionResult {
  success: boolean;
  actionType: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertActionHandler {
  readonly actionType: string;

  execute(
    alert: Alert,
    event: AlertEventMessage,
    isNewAlert: boolean,
  ): Promise<ActionResult> | ActionResult;

  shouldExecute(event: AlertEventMessage): boolean;
}
