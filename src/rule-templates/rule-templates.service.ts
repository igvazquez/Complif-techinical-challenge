import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RuleTemplate } from './entities/rule-template.entity';
import { CreateRuleTemplateDto, UpdateRuleTemplateDto } from './dto';
import { PaginationQuery, PaginatedResult } from '../common/interfaces';

@Injectable()
export class RuleTemplatesService {
  constructor(
    @InjectRepository(RuleTemplate)
    private readonly ruleTemplateRepository: Repository<RuleTemplate>,
  ) {}

  async create(createDto: CreateRuleTemplateDto): Promise<RuleTemplate> {
    const ruleTemplate = this.ruleTemplateRepository.create({
      name: createDto.name,
      description: createDto.description ?? null,
      config: createDto.config ?? {},
      isDefault: createDto.isDefault ?? false,
    });
    return this.ruleTemplateRepository.save(ruleTemplate);
  }

  async findAll(
    query: PaginationQuery,
  ): Promise<PaginatedResult<RuleTemplate>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.ruleTemplateRepository.findAndCount({
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

  async findOne(id: string): Promise<RuleTemplate> {
    const ruleTemplate = await this.ruleTemplateRepository.findOne({
      where: { id },
    });

    if (!ruleTemplate) {
      throw new NotFoundException(`Rule template with ID "${id}" not found`);
    }

    return ruleTemplate;
  }

  async findDefaults(): Promise<RuleTemplate[]> {
    return this.ruleTemplateRepository.find({
      where: { isDefault: true },
      order: { name: 'ASC' },
    });
  }

  async update(
    id: string,
    updateDto: UpdateRuleTemplateDto,
  ): Promise<RuleTemplate> {
    const ruleTemplate = await this.findOne(id);

    Object.assign(ruleTemplate, updateDto);

    return this.ruleTemplateRepository.save(ruleTemplate);
  }

  async remove(id: string): Promise<void> {
    const ruleTemplate = await this.findOne(id);
    await this.ruleTemplateRepository.remove(ruleTemplate);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.ruleTemplateRepository.count({
      where: { id },
    });
    return count > 0;
  }
}
