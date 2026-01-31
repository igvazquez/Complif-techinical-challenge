import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto';
import { PaginationQuery, PaginatedResult } from '../common/interfaces';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  async create(createDto: CreateOrganizationDto): Promise<Organization> {
    const organization = this.organizationRepository.create({
      name: createDto.name,
      settings: createDto.settings ?? {},
    });
    return this.organizationRepository.save(organization);
  }

  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResult<Organization>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.organizationRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }

    return organization;
  }

  async update(
    id: string,
    updateDto: UpdateOrganizationDto,
  ): Promise<Organization> {
    const organization = await this.findOne(id);

    Object.assign(organization, updateDto);

    return this.organizationRepository.save(organization);
  }

  async remove(id: string): Promise<void> {
    const organization = await this.findOne(id);
    await this.organizationRepository.remove(organization);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.organizationRepository.count({
      where: { id },
    });
    return count > 0;
  }
}
