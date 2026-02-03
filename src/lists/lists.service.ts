import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ListEntry, ListType, EntityType } from './entities/list-entry.entity';
import { CreateListEntryDto, ListEntryQueryDto } from './dto';
import { PaginatedResult } from '../common/interfaces';

@Injectable()
export class ListsService {
  constructor(
    @InjectRepository(ListEntry)
    private readonly listEntryRepository: Repository<ListEntry>,
    @InjectPinoLogger(ListsService.name)
    private readonly logger: PinoLogger,
  ) {}

  async create(
    organizationId: string,
    dto: CreateListEntryDto,
  ): Promise<ListEntry> {
    // Check for existing entry with same combination
    const existing = await this.listEntryRepository.findOne({
      where: {
        idOrganization: organizationId,
        listType: dto.listType,
        entityType: dto.entityType,
        entityValue: dto.entityValue,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Entry already exists for ${dto.listType}/${dto.entityType}/${dto.entityValue}`,
      );
    }

    const entry = this.listEntryRepository.create({
      idOrganization: organizationId,
      listType: dto.listType,
      entityType: dto.entityType,
      entityValue: dto.entityValue,
      reason: dto.reason || null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      createdBy: dto.createdBy || null,
    });

    const saved = await this.listEntryRepository.save(entry);

    this.logger.info(
      {
        listEntryId: saved.id,
        organizationId,
        listType: dto.listType,
        entityType: dto.entityType,
      },
      'List entry created',
    );

    return saved;
  }

  async findByOrganization(
    organizationId: string,
    query: ListEntryQueryDto,
  ): Promise<PaginatedResult<ListEntry>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { idOrganization: organizationId };

    if (query.listType) {
      where.listType = query.listType;
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.entityValue) {
      where.entityValue = query.entityValue;
    }

    const [data, total] = await this.listEntryRepository.findAndCount({
      where,
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

  async findOne(organizationId: string, id: string): Promise<ListEntry> {
    const entry = await this.listEntryRepository.findOne({
      where: { id, idOrganization: organizationId },
    });

    if (!entry) {
      throw new NotFoundException(`List entry with ID "${id}" not found`);
    }

    return entry;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const entry = await this.findOne(organizationId, id);

    await this.listEntryRepository.remove(entry);

    this.logger.info(
      {
        listEntryId: id,
        organizationId,
        listType: entry.listType,
        entityType: entry.entityType,
      },
      'List entry removed',
    );
  }

  async isInList(
    organizationId: string,
    listType: ListType,
    entityType: EntityType,
    entityValue: string,
  ): Promise<boolean> {
    const now = new Date();

    const entry = await this.listEntryRepository.findOne({
      where: [
        // Entry with no expiration
        {
          idOrganization: organizationId,
          listType,
          entityType,
          entityValue,
          expiresAt: null as unknown as Date,
        },
        // Entry with expiration in the future
        {
          idOrganization: organizationId,
          listType,
          entityType,
          entityValue,
          expiresAt: MoreThan(now),
        },
      ],
    });

    return entry !== null;
  }

  async removeExpired(organizationId?: string): Promise<number> {
    const now = new Date();

    const where: Record<string, unknown> = {
      expiresAt: LessThan(now),
    };

    if (organizationId) {
      where.idOrganization = organizationId;
    }

    const result = await this.listEntryRepository.delete(where);

    const deletedCount = result.affected ?? 0;

    if (deletedCount > 0) {
      this.logger.info(
        {
          deletedCount,
          organizationId: organizationId || 'all',
        },
        'Expired list entries removed',
      );
    }

    return deletedCount;
  }
}
