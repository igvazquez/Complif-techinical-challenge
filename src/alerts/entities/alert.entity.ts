import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';
import { Rule } from '../../rules/entities/rule.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertCategory {
  AML = 'AML',
  FRAUD = 'FRAUD',
  COMPLIANCE = 'COMPLIANCE',
  UNKNOWN = 'UNKNOWN',
}

export enum AlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  FALSE_POSITIVE = 'FALSE_POSITIVE',
}

@Entity('alerts')
@Index('idx_alerts_org_status', ['idOrganization', 'status'])
@Index('idx_alerts_org_severity', ['idOrganization', 'severity'])
@Index('idx_alerts_org_category', ['idOrganization', 'category'])
@Index('idx_alerts_org_rule', ['idOrganization', 'idRule'])
@Index('idx_alerts_dedup_key', ['dedupKey'])
export class Alert extends TenantBaseEntity {
  @Column({ name: 'id_rule', type: 'uuid' })
  @Index('idx_alerts_id_rule')
  idRule: string;

  @Column({ name: 'id_transaction', type: 'uuid' })
  idTransaction: string;

  @Column({ name: 'id_account', type: 'varchar', length: 255, nullable: true })
  idAccount: string | null;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
    default: AlertSeverity.MEDIUM,
  })
  severity: AlertSeverity;

  @Column({
    type: 'enum',
    enum: AlertCategory,
    default: AlertCategory.UNKNOWN,
  })
  category: AlertCategory;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.OPEN,
  })
  status: AlertStatus;

  @Column({ name: 'hit_count', type: 'int', default: 1 })
  hitCount: number;

  @Column({ name: 'first_triggered_at', type: 'timestamp' })
  firstTriggeredAt: Date;

  @Column({ name: 'last_triggered_at', type: 'timestamp' })
  lastTriggeredAt: Date;

  @Column({ name: 'dedup_key', type: 'varchar', length: 512 })
  dedupKey: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @ManyToOne(() => Rule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_rule' })
  rule: Rule;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_transaction' })
  transaction: Transaction;
}
