import { Controller } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  RmqContext,
} from '@nestjs/microservices';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto';

interface TransactionMessage {
  organizationId: string;
  transaction: CreateTransactionDto;
}

@Controller()
export class TransactionsConsumer {
  constructor(
    private readonly transactionsService: TransactionsService,
    @InjectPinoLogger(TransactionsConsumer.name)
    private readonly logger: PinoLogger,
  ) {}

  @MessagePattern('transactions')
  async handleTransaction(
    @Payload() data: TransactionMessage,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      this.logger.debug(
        { organizationId: data.organizationId },
        'Processing transaction from queue',
      );

      await this.transactionsService.createAndEvaluate(
        data.organizationId,
        data.transaction,
        'queue',
      );

      this.logger.debug(
        { organizationId: data.organizationId },
        'Transaction processed successfully',
      );
    } catch (err: unknown) {
      // Fail-open: log error but acknowledge the message to prevent requeuing
      // The transaction storage might have succeeded even if evaluation failed
      this.logger.error(
        {
          err,
          organizationId: data.organizationId,
          transaction: data.transaction,
        },
        'Failed to process transaction from queue, acknowledging to prevent requeue',
      );
    } finally {
      // Always acknowledge the message
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      channel.ack(originalMsg);
    }
  }
}
