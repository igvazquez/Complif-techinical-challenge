import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListType, EntityType } from '../entities/list-entry.entity';

export class CreateListEntryDto {
  @ApiProperty({
    description: 'Type of list (BLACKLIST or WHITELIST)',
    enum: ListType,
    example: ListType.BLACKLIST,
  })
  @IsEnum(ListType)
  listType: ListType;

  @ApiProperty({
    description: 'Type of entity being listed',
    enum: EntityType,
    example: EntityType.COUNTRY,
  })
  @IsEnum(EntityType)
  entityType: EntityType;

  @ApiProperty({
    description: 'The value to add to the list',
    example: 'AR',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  entityValue: string;

  @ApiPropertyOptional({
    description: 'Reason for adding this entry to the list',
    example: 'High-risk jurisdiction',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'When this entry should expire (ISO 8601 format)',
    example: '2025-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'UUID of the user who created this entry',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}
