import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsObject,
  IsDateString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionDataDto {
  @ApiProperty({ description: 'Transaction ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Account ID' })
  @IsString()
  @IsNotEmpty()
  idAccount: string;

  @ApiProperty({ description: 'Transaction amount in original currency' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Transaction amount normalized to base currency',
  })
  @IsNumber()
  @Min(0)
  amountNormalized: number;

  @ApiProperty({ description: 'Currency code (ISO 4217)' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    description: 'Transaction type (e.g., CASH_IN, CASH_OUT, TRANSFER)',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Transaction datetime (ISO 8601)' })
  @IsDateString()
  datetime: string;

  @ApiProperty({ description: 'Transaction date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({
    description: 'Country code where transaction occurred',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Counterparty ID' })
  @IsOptional()
  @IsString()
  counterpartyId?: string;

  @ApiPropertyOptional({ description: 'Counterparty country code' })
  @IsOptional()
  @IsString()
  counterpartyCountry?: string;

  @ApiPropertyOptional({ description: 'Additional transaction data' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class AccountDataDto {
  @ApiProperty({ description: 'Account ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiPropertyOptional({ description: 'Account type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Account status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Account country' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Account risk score' })
  @IsOptional()
  @IsNumber()
  riskScore?: number;

  @ApiPropertyOptional({ description: 'Additional account data' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class EvaluateTransactionDto {
  @ApiProperty({
    description: 'Transaction data to evaluate',
    type: TransactionDataDto,
  })
  @ValidateNested()
  @Type(() => TransactionDataDto)
  @IsNotEmpty()
  transaction: TransactionDataDto;

  @ApiPropertyOptional({ description: 'Account data', type: AccountDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AccountDataDto)
  account?: AccountDataDto;

  @ApiPropertyOptional({ description: 'Additional metadata for evaluation' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
