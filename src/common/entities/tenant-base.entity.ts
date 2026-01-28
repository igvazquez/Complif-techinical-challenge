import { Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export abstract class TenantBaseEntity extends BaseEntity {
  @Column({ name: 'id_organization', type: 'uuid' })
  @Index()
  idOrganization: string;
}
