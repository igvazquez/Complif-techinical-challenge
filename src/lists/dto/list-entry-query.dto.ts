import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListType, EntityType } from '../entities/list-entry.entity';

export class ListEntryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by list type',
    enum: ListType,
    example: ListType.BLACKLIST,
  })
  @IsOptional()
  @IsEnum(ListType)
  listType?: ListType;

  @ApiPropertyOptional({
    description: 'Filter by entity type',
    enum: EntityType,
    example: EntityType.COUNTRY,
  })
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @ApiPropertyOptional({
    description: 'Filter by entity value (partial match)',
    example: 'AR',
  })
  @IsOptional()
  @IsString()
  entityValue?: string;

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
