import {
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateOverrideDto {
  @ApiProperty({
    description: 'UUID of the rule template to override',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  idTemplate: string;

  @ApiPropertyOptional({
    description: 'Override configuration to merge with template config',
    example: {
      conditions: {
        all: [
          {
            fact: 'transaction.amount',
            operator: 'greaterThan',
            value: 50000,
          },
        ],
      },
    },
    default: {},
  })
  @IsOptional()
  @IsObject()
  overrides?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Whether this override is enabled',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
