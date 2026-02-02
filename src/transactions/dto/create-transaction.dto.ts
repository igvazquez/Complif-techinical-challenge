import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsObject,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiProperty({
    description: 'Account identifier',
    example: 'acc-12345',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  idAccount: string;

  @ApiProperty({
    description: 'Transaction amount in original currency',
    example: 1000.5,
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Transaction amount normalized to base currency (e.g., USD)',
    example: 1000.5,
  })
  @IsNumber()
  amountNormalized: number;

  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  currency: string;

  @ApiProperty({
    description: 'Transaction type',
    example: 'CASH_IN',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @ApiPropertyOptional({
    description: 'Transaction sub-type',
    example: 'DEPOSIT',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  subType?: string;

  @ApiProperty({
    description: 'Transaction timestamp (ISO 8601)',
    example: '2024-01-15T10:30:00Z',
  })
  @IsDateString()
  datetime: string;

  @ApiProperty({
    description: 'Transaction date (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiPropertyOptional({
    description: 'Whether the transaction has been voided',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isVoided?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the transaction has been blocked',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the transaction has been soft deleted',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean;

  @ApiPropertyOptional({
    description: 'Origin of the transaction (e.g., API, MOBILE, WEB)',
    example: 'API',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  origin?: string;

  @ApiPropertyOptional({
    description: 'Device information for the transaction',
    example: { platform: 'iOS', version: '17.0' },
  })
  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Additional transaction data',
    example: { merchantId: 'merch-123' },
    default: {},
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'External code for deduplication',
    example: 'EXT-12345',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalCode?: string;

  @ApiPropertyOptional({
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'US',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  country?: string;

  @ApiPropertyOptional({
    description: 'Counterparty identifier',
    example: 'cpty-123',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  counterpartyId?: string;

  @ApiPropertyOptional({
    description: 'Counterparty country code (ISO 3166-1 alpha-2)',
    example: 'GB',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  counterpartyCountry?: string;
}
