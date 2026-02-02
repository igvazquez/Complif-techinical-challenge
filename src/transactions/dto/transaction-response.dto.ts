import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transaction } from '../entities/transaction.entity';
import { EvaluationResult } from '../../engine/interfaces';

export class TransactionResponseDto {
  @ApiProperty({
    description: 'The stored transaction',
  })
  transaction: Transaction;

  @ApiPropertyOptional({
    description:
      'Rule evaluation result (only present when evaluation was performed)',
  })
  evaluation?: EvaluationResult;
}
