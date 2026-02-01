import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsObject,
  IsBoolean,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRuleDto {
  @ApiProperty({
    description: 'Name of the rule',
    example: 'High Value Transaction Alert',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Description of what this rule does',
    example: 'Triggers an alert when transaction amount exceeds threshold',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'UUID of the rule template this rule is based on',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  idTemplate?: string;

  @ApiPropertyOptional({
    description: 'Whether this rule is enabled',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Priority of the rule (lower numbers = higher priority)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Rule configuration including conditions and event',
    example: {
      conditions: {
        all: [
          {
            fact: 'transaction.amount',
            operator: 'greaterThan',
            value: 10000,
          },
        ],
      },
      event: {
        type: 'alert',
        params: {
          severity: 'HIGH',
          category: 'AML',
        },
      },
    },
    default: {},
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'User or system that created this rule',
    example: 'admin@example.com',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  createdBy?: string;
}
