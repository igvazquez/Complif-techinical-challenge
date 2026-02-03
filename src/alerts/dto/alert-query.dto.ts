import { IsOptional, IsEnum, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AlertSeverity,
  AlertCategory,
  AlertStatus,
} from '../entities/alert.entity';

export class AlertQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by alert status',
    enum: AlertStatus,
    example: AlertStatus.OPEN,
  })
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @ApiPropertyOptional({
    description: 'Filter by alert severity',
    enum: AlertSeverity,
    example: AlertSeverity.HIGH,
  })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @ApiPropertyOptional({
    description: 'Filter by alert category',
    enum: AlertCategory,
    example: AlertCategory.FRAUD,
  })
  @IsOptional()
  @IsEnum(AlertCategory)
  category?: AlertCategory;

  @ApiPropertyOptional({
    description: 'Filter by rule ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  ruleId?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
