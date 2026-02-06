import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTransactionDto {
  @ApiPropertyOptional({
    description: 'Whether the transaction has been blocked',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the transaction has been voided',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isVoided?: boolean;
}
