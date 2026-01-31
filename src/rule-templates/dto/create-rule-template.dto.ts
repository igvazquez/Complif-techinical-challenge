import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRuleTemplateDto {
  @ApiProperty({
    description: 'Name of the rule template (must be unique)',
    example: 'High Value Transaction Alert',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Description of what this rule template does',
    example: 'Triggers an alert when transaction amount exceeds a threshold',
  })
  @IsOptional()
  @IsString()
  description?: string;

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
    description:
      'Whether this template is a default template for new organizations',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
