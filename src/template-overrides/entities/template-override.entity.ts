import { Entity, Column, Index, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';
import { RuleTemplate } from '../../rule-templates/entities/rule-template.entity';

@Entity('template_overrides')
@Unique('UQ_template_overrides_org_template', ['idOrganization', 'idTemplate'])
@Index('idx_template_overrides_id_template', ['idTemplate'])
export class TemplateOverride extends TenantBaseEntity {
  @Column({ name: 'id_template', type: 'uuid' })
  idTemplate: string;

  @Column({ type: 'jsonb', default: {} })
  overrides: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @ManyToOne(() => RuleTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_template' })
  template: RuleTemplate;
}
