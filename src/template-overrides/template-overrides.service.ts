import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplateOverride } from './entities/template-override.entity';
import { CreateTemplateOverrideDto, UpdateTemplateOverrideDto } from './dto';
import { RuleTemplatesService } from '../rule-templates/rule-templates.service';
import { PaginationQuery, PaginatedResult } from '../common/interfaces';

@Injectable()
export class TemplateOverridesService {
  constructor(
    @InjectRepository(TemplateOverride)
    private readonly templateOverrideRepository: Repository<TemplateOverride>,
    private readonly ruleTemplatesService: RuleTemplatesService,
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

    return this.templateOverrideRepository.save(templateOverride);
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
    return this.deepMerge(template.config, override.overrides);
  }

  async update(
    organizationId: string,
    id: string,
    updateDto: UpdateTemplateOverrideDto,
  ): Promise<TemplateOverride> {
    const templateOverride = await this.findOne(organizationId, id);

    Object.assign(templateOverride, updateDto);

    return this.templateOverrideRepository.save(templateOverride);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const templateOverride = await this.findOne(organizationId, id);
    await this.templateOverrideRepository.remove(templateOverride);
  }

  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] !== null &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        result[key] = this.deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>,
        );
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }
}
