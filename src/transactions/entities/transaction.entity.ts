import { Entity, Column, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('transactions')
@Index('idx_tx_org_account_datetime', [
  'idOrganization',
  'idAccount',
  'datetime',
])
@Index('idx_tx_org_datetime', ['idOrganization', 'datetime'])
@Index('idx_tx_org_account_type_datetime', [
  'idOrganization',
  'idAccount',
  'type',
  'datetime',
])
export class Transaction extends TenantBaseEntity {
  @ApiProperty({
    description: 'Account identifier',
    example: 'acc-12345',
  })
  @Column({ name: 'id_account', type: 'varchar', length: 255 })
  idAccount: string;

  @ApiProperty({
    description: 'Transaction amount in original currency',
    example: 1000.5,
  })
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  amount: number;

  @ApiProperty({
    description: 'Transaction amount normalized to base currency (e.g., USD)',
    example: 1000.5,
  })
  @Column({
    name: 'amount_normalized',
    type: 'numeric',
    precision: 18,
    scale: 4,
  })
  amountNormalized: number;

  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
  })
  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @ApiProperty({
    description: 'Transaction type',
    example: 'CASH_IN',
  })
  @Column({ type: 'varchar', length: 50 })
  type: string;

  @ApiPropertyOptional({
    description: 'Transaction sub-type',
    example: 'DEPOSIT',
  })
  @Column({ name: 'sub_type', type: 'varchar', length: 50, nullable: true })
  subType?: string;

  @ApiProperty({
    description: 'Transaction timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  @Column({ type: 'timestamp' })
  datetime: Date;

  @ApiProperty({
    description: 'Transaction date (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @Column({ type: 'date' })
  date: string;

  @ApiProperty({
    description: 'Whether the transaction has been voided',
    example: false,
  })
  @Column({ name: 'is_voided', type: 'boolean', default: false })
  isVoided: boolean;

  @ApiProperty({
    description: 'Whether the transaction has been blocked',
    example: false,
  })
  @Column({ name: 'is_blocked', type: 'boolean', default: false })
  isBlocked: boolean;

  @ApiProperty({
    description: 'Whether the transaction has been soft deleted',
    example: false,
  })
  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  @ApiPropertyOptional({
    description: 'Origin of the transaction (e.g., API, MOBILE, WEB)',
    example: 'API',
  })
  @Column({ type: 'varchar', length: 100, nullable: true })
  origin?: string;

  @ApiPropertyOptional({
    description: 'Device information for the transaction',
    example: { platform: 'iOS', version: '17.0' },
  })
  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo?: Record<string, unknown>;

  @ApiProperty({
    description: 'Additional transaction data',
    example: { merchantId: 'merch-123' },
  })
  @Column({ type: 'jsonb', default: {} })
  data: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'External code for deduplication',
    example: 'EXT-12345',
  })
  @Column({
    name: 'external_code',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  externalCode?: string;

  @ApiPropertyOptional({
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'US',
  })
  @Column({ type: 'varchar', length: 10, nullable: true })
  country?: string;

  @ApiPropertyOptional({
    description: 'Counterparty identifier',
    example: 'cpty-123',
  })
  @Column({
    name: 'counterparty_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  counterpartyId?: string;

  @ApiPropertyOptional({
    description: 'Counterparty country code (ISO 3166-1 alpha-2)',
    example: 'GB',
  })
  @Column({
    name: 'counterparty_country',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  counterpartyCountry?: string;
}
