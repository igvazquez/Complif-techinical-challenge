import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Rule } from './entities/rule.entity';
import { CreateRuleDto, UpdateRuleDto } from './dto';
import { TemplateOverridesService } from '../template-overrides/template-overrides.service';
import { PaginationQuery, PaginatedResult } from '../common/interfaces';
import {
  RULE_CACHE_INVALIDATION_EVENT,
  RuleCacheInvalidationEvent,
} from '../common/events/rule-cache.events';
import { deepMerge } from '../common/utils/deep-merge.util';

@Injectable()
export class RulesService {
  constructor(
    @InjectRepository(Rule)
    private readonly ruleRepository: Repository<Rule>,
    private readonly templateOverridesService: TemplateOverridesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    organizationId: string,
    createDto: CreateRuleDto,
  ): Promise<Rule> {
    const rule = this.ruleRepository.create({
      idOrganization: organizationId,
      idTemplate: createDto.idTemplate ?? null,
      name: createDto.name,
      description: createDto.description ?? null,
      enabled: createDto.enabled ?? true,
      priority: createDto.priority ?? 0,
      config: createDto.config ?? {},
      createdBy: createDto.createdBy ?? null,
    });

    const savedRule = await this.ruleRepository.save(rule);
    this.eventEmitter.emit(
      RULE_CACHE_INVALIDATION_EVENT,
      new RuleCacheInvalidationEvent(organizationId),
    );
    return savedRule;
  }

  async findAll(
    organizationId: string,
    query: PaginationQuery,
  ): Promise<PaginatedResult<Rule>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.ruleRepository.findAndCount({
      where: { idOrganization: organizationId },
      relations: ['template'],
      order: { priority: 'ASC', createdAt: 'DESC' },
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

  async findOne(organizationId: string, id: string): Promise<Rule> {
    const rule = await this.ruleRepository.findOne({
      where: { id, idOrganization: organizationId },
      relations: ['template'],
    });

    if (!rule) {
      throw new NotFoundException(`Rule with ID "${id}" not found`);
    }

    return rule;
  }

  async findEnabledByPriority(organizationId: string): Promise<Rule[]> {
    return this.ruleRepository.find({
      where: {
        idOrganization: organizationId,
        enabled: true,
      },
      relations: ['template'],
      order: { priority: 'ASC', createdAt: 'ASC' },
    });
  }

  async getEffectiveConfig(
    organizationId: string,
    rule: Rule,
  ): Promise<Record<string, unknown>> {
    // If rule has no template, just return its own config
    if (!rule.idTemplate) {
      return rule.config;
    }

    // Get merged template config (with any org-specific overrides)
    const templateConfig = await this.templateOverridesService.getMergedConfig(
      organizationId,
      rule.idTemplate,
    );

    // Merge rule's own config on top of template config
    return deepMerge(templateConfig, rule.config);
  }

  async getEffectiveConfigById(
    organizationId: string,
    ruleId: string,
  ): Promise<Record<string, unknown>> {
    const rule = await this.findOne(organizationId, ruleId);
    return this.getEffectiveConfig(organizationId, rule);
  }

  async update(
    organizationId: string,
    id: string,
    updateDto: UpdateRuleDto,
  ): Promise<Rule> {
    const rule = await this.findOne(organizationId, id);

    Object.assign(rule, updateDto);

    const savedRule = await this.ruleRepository.save(rule);
    this.eventEmitter.emit(
      RULE_CACHE_INVALIDATION_EVENT,
      new RuleCacheInvalidationEvent(organizationId),
    );
    return savedRule;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const rule = await this.findOne(organizationId, id);
    await this.ruleRepository.remove(rule);
    this.eventEmitter.emit(
      RULE_CACHE_INVALIDATION_EVENT,
      new RuleCacheInvalidationEvent(organizationId),
    );
  }
}
