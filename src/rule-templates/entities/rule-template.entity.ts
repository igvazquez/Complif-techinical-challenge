import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('rule_templates')
export class RuleTemplate extends BaseEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  @Index('idx_rule_templates_name')
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  @Index('idx_rule_templates_is_default')
  isDefault: boolean;
}
