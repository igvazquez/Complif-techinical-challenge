import { Entity, Column, Index, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

export enum ListType {
  BLACKLIST = 'BLACKLIST',
  WHITELIST = 'WHITELIST',
}

export enum EntityType {
  ACCOUNT = 'ACCOUNT',
  IP = 'IP',
  COUNTRY = 'COUNTRY',
  DEVICE = 'DEVICE',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
}

@Entity('list_entries')
@Index('idx_list_entries_org_type', [
  'idOrganization',
  'listType',
  'entityType',
])
@Unique('uq_list_entries_org_list_entity', [
  'idOrganization',
  'listType',
  'entityType',
  'entityValue',
])
export class ListEntry extends TenantBaseEntity {
  @Column({
    name: 'list_type',
    type: 'enum',
    enum: ListType,
  })
  listType: ListType;

  @Column({
    name: 'entity_type',
    type: 'enum',
    enum: EntityType,
  })
  entityType: EntityType;

  @Column({ name: 'entity_value', type: 'varchar', length: 255 })
  entityValue: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  @Index('idx_list_entries_expires')
  expiresAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;
}
