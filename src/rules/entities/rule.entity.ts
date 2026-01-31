import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';
import { RuleTemplate } from '../../rule-templates/entities/rule-template.entity';

@Entity('rules')
@Index('idx_rules_id_organization_priority', ['idOrganization', 'priority'])
@Index('idx_rules_id_organization_enabled', ['idOrganization', 'enabled'])
export class Rule extends TenantBaseEntity {
  @Column({ name: 'id_template', type: 'uuid', nullable: true })
  @Index('idx_rules_id_template')
  idTemplate: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  createdBy: string | null;

  @ManyToOne(() => RuleTemplate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_template' })
  template: RuleTemplate;
}
