import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { TemplateOverride } from './entities/template-override.entity';
import { CreateTemplateOverrideDto, UpdateTemplateOverrideDto } from './dto';
import { RuleTemplatesService } from '../rule-templates/rule-templates.service';
import { PaginationQuery, PaginatedResult } from '../common/interfaces';
import {
  RULE_CACHE_INVALIDATION_EVENT,
  RuleCacheInvalidationEvent,
} from '../common/events/rule-cache.events';
import { deepMerge } from '../common/utils/deep-merge.util';

@Injectable()
export class TemplateOverridesService {
  constructor(
    @InjectRepository(TemplateOverride)
    private readonly templateOverrideRepository: Repository<TemplateOverride>,
    private readonly ruleTemplatesService: RuleTemplatesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    organizationId: string,
    createDto: CreateTemplateOverrideDto,
  ): Promise<TemplateOverride> {
    // Verify template exists
    await this.ruleTemplatesService.findOne(createDto.idTemplate);

    // Check for existing override
    const existing = await this.templateOverrideRepository.findOne({
      where: {
        idOrganization: organizationId,
        idTemplate: createDto.idTemplate,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Override for template "${createDto.idTemplate}" already exists for this organization`,
      );
    }

    const templateOverride = this.templateOverrideRepository.create({
      idOrganization: organizationId,
      idTemplate: createDto.idTemplate,
      overrides: createDto.overrides ?? {},
      enabled: createDto.enabled ?? true,
    });

    const saved = await this.templateOverrideRepository.save(templateOverride);
    this.eventEmitter.emit(
      RULE_CACHE_INVALIDATION_EVENT,
      new RuleCacheInvalidationEvent(organizationId),
    );
    return saved;
  }

  async findAll(
    organizationId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<TemplateOverride>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.templateOverrideRepository.findAndCount({
      where: { idOrganization: organizationId },
      relations: ['template'],
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

  async findOne(organizationId: string, id: string): Promise<TemplateOverride> {
    const templateOverride = await this.templateOverrideRepository.findOne({
      where: { id, idOrganization: organizationId },
      relations: ['template'],
    });

    if (!templateOverride) {
      throw new NotFoundException(
        `Template override with ID "${id}" not found`,
      );
    }

    return templateOverride;
  }

  async findByTemplate(
    organizationId: string,
    templateId: string,
  ): Promise<TemplateOverride | null> {
    return this.templateOverrideRepository.findOne({
      where: {
        idOrganization: organizationId,
        idTemplate: templateId,
      },
      relations: ['template'],
    });
  }

  async getMergedConfig(
    organizationId: string,
    templateId: string,
  ): Promise<Record<string, unknown>> {
    const template = await this.ruleTemplatesService.findOne(templateId);
    const override = await this.findByTemplate(organizationId, templateId);

    if (!override || !override.enabled) {
      return template.config;
    }

    // Deep merge template config with overrides
    return deepMerge(template.config, override.overrides);
  }

  async update(
    organizationId: string,
    id: string,
    updateDto: UpdateTemplateOverrideDto,
  ): Promise<TemplateOverride> {
    const templateOverride = await this.findOne(organizationId, id);

    Object.assign(templateOverride, updateDto);

    const saved = await this.templateOverrideRepository.save(templateOverride);
    this.eventEmitter.emit(
      RULE_CACHE_INVALIDATION_EVENT,
      new RuleCacheInvalidationEvent(organizationId),
    );
    return saved;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const templateOverride = await this.findOne(organizationId, id);
    await this.templateOverrideRepository.remove(templateOverride);
    this.eventEmitter.emit(
      RULE_CACHE_INVALIDATION_EVENT,
      new RuleCacheInvalidationEvent(organizationId),
    );
  }
}
