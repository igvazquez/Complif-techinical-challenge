/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { RulesService } from './rules.service';
import { Rule } from './entities/rule.entity';
import { TemplateOverridesService } from '../template-overrides/template-overrides.service';
import { createMockRule, generateUUID } from '../../test/test-utils';

describe('RulesService', () => {
  let service: RulesService;
  let repository: jest.Mocked<Repository<Rule>>;
  let templateOverridesService: jest.Mocked<TemplateOverridesService>;

  const organizationId = generateUUID();
  const mockRule = createMockRule({ idOrganization: organizationId });

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      remove: jest.fn(),
    };

    const mockTemplateOverridesService = {
      getMergedConfig: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesService,
        {
          provide: getRepositoryToken(Rule),
          useValue: mockRepository,
        },
        {
          provide: TemplateOverridesService,
          useValue: mockTemplateOverridesService,
        },
      ],
    }).compile();

    service = module.get<RulesService>(RulesService);
    repository = module.get(getRepositoryToken(Rule));
    templateOverridesService = module.get(TemplateOverridesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a rule', async () => {
      const createDto = {
        name: 'Test Rule',
        description: 'Test description',
        enabled: true,
        priority: 1,
        config: { conditions: {} },
        createdBy: 'admin@test.com',
      };

      repository.create.mockReturnValue({
        ...mockRule,
        ...createDto,
        idOrganization: organizationId,
      } as Rule);
      repository.save.mockResolvedValue({
        ...mockRule,
        ...createDto,
        idOrganization: organizationId,
      } as Rule);

      const result = await service.create(organizationId, createDto);

      expect(repository.create).toHaveBeenCalledWith({
        idOrganization: organizationId,
        idTemplate: null,
        name: createDto.name,
        description: createDto.description,
        enabled: createDto.enabled,
        priority: createDto.priority,
        config: createDto.config,
        createdBy: createDto.createdBy,
      });
      expect(result.idOrganization).toBe(organizationId);
    });

    it('should use default values if not provided', async () => {
      const createDto = { name: 'Test Rule' };

      repository.create.mockReturnValue({
        ...mockRule,
        name: createDto.name,
        idOrganization: organizationId,
      } as Rule);
      repository.save.mockResolvedValue({
        ...mockRule,
        name: createDto.name,
        idOrganization: organizationId,
      } as Rule);

      await service.create(organizationId, createDto);

      expect(repository.create).toHaveBeenCalledWith({
        idOrganization: organizationId,
        idTemplate: null,
        name: createDto.name,
        description: null,
        enabled: true,
        priority: 0,
        config: {},
        createdBy: null,
      });
    });

    it('should create a rule with template reference', async () => {
      const templateId = generateUUID();
      const createDto = {
        name: 'Test Rule',
        idTemplate: templateId,
      };

      repository.create.mockReturnValue({
        ...mockRule,
        ...createDto,
        idOrganization: organizationId,
      } as Rule);
      repository.save.mockResolvedValue({
        ...mockRule,
        ...createDto,
        idOrganization: organizationId,
      } as Rule);

      await service.create(organizationId, createDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          idTemplate: templateId,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated rules', async () => {
      const rules = [mockRule];
      repository.findAndCount.mockResolvedValue([rules as Rule[], 1]);

      const result = await service.findAll(organizationId, {});

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { idOrganization: organizationId },
        relations: ['template'],
        order: { priority: 'ASC', createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({
        data: rules,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should return paginated rules with custom page and limit', async () => {
      const rules = [mockRule];
      repository.findAndCount.mockResolvedValue([rules as Rule[], 25]);

      const result = await service.findAll(organizationId, {
        page: 2,
        limit: 5,
      });

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { idOrganization: organizationId },
        relations: ['template'],
        order: { priority: 'ASC', createdAt: 'DESC' },
        skip: 5,
        take: 5,
      });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
    });
  });

  describe('findOne', () => {
    it('should return a rule by id', async () => {
      repository.findOne.mockResolvedValue(mockRule as Rule);

      const result = await service.findOne(organizationId, mockRule.id);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockRule.id, idOrganization: organizationId },
        relations: ['template'],
      });
      expect(result).toEqual(mockRule);
    });

    it('should throw NotFoundException if rule not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(organizationId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findEnabledByPriority', () => {
    it('should return enabled rules sorted by priority', async () => {
      const enabledRules = [
        { ...mockRule, priority: 0, enabled: true },
        { ...mockRule, id: 'rule-2', priority: 1, enabled: true },
      ];
      repository.find.mockResolvedValue(enabledRules as Rule[]);

      const result = await service.findEnabledByPriority(organizationId);

      expect(repository.find).toHaveBeenCalledWith({
        where: {
          idOrganization: organizationId,
          enabled: true,
        },
        relations: ['template'],
        order: { priority: 'ASC', createdAt: 'ASC' },
      });
      expect(result).toEqual(enabledRules);
    });
  });

  describe('getEffectiveConfig', () => {
    it('should return rule config when no template', async () => {
      const rule = {
        ...mockRule,
        idTemplate: null,
        config: { threshold: 5000 },
      };

      const result = await service.getEffectiveConfig(
        organizationId,
        rule as Rule,
      );

      expect(result).toEqual({ threshold: 5000 });
      expect(templateOverridesService.getMergedConfig).not.toHaveBeenCalled();
    });

    it('should merge template config with rule config', async () => {
      const templateId = generateUUID();
      const rule = {
        ...mockRule,
        idTemplate: templateId,
        config: { threshold: 5000 },
      };
      const templateConfig = { threshold: 10000, category: 'AML' };

      templateOverridesService.getMergedConfig.mockResolvedValue(
        templateConfig,
      );

      const result = await service.getEffectiveConfig(
        organizationId,
        rule as Rule,
      );

      expect(templateOverridesService.getMergedConfig).toHaveBeenCalledWith(
        organizationId,
        templateId,
      );
      expect(result).toEqual({ threshold: 5000, category: 'AML' });
    });

    it('should deep merge nested config objects', async () => {
      const templateId = generateUUID();
      const rule = {
        ...mockRule,
        idTemplate: templateId,
        config: {
          event: { params: { severity: 'HIGH' } },
        },
      };
      const templateConfig = {
        conditions: { all: [] },
        event: { type: 'alert', params: { severity: 'LOW', category: 'AML' } },
      };

      templateOverridesService.getMergedConfig.mockResolvedValue(
        templateConfig,
      );

      const result = await service.getEffectiveConfig(
        organizationId,
        rule as Rule,
      );

      expect(result).toEqual({
        conditions: { all: [] },
        event: { type: 'alert', params: { severity: 'HIGH', category: 'AML' } },
      });
    });
  });

  describe('getEffectiveConfigById', () => {
    it('should get rule and return effective config', async () => {
      const rule = {
        ...mockRule,
        idTemplate: null,
        config: { threshold: 5000 },
      };
      repository.findOne.mockResolvedValue(rule as Rule);

      const result = await service.getEffectiveConfigById(
        organizationId,
        mockRule.id,
      );

      expect(repository.findOne).toHaveBeenCalled();
      expect(result).toEqual({ threshold: 5000 });
    });
  });

  describe('update', () => {
    it('should update a rule', async () => {
      const updateDto = { name: 'Updated Rule', enabled: false };
      const existingRule = { ...mockRule };
      const updatedRule = { ...existingRule, ...updateDto };

      repository.findOne.mockResolvedValue(existingRule as Rule);
      repository.save.mockResolvedValue(updatedRule as Rule);

      const result = await service.update(
        organizationId,
        mockRule.id,
        updateDto,
      );

      expect(repository.save).toHaveBeenCalled();
      expect(result.name).toBe('Updated Rule');
      expect(result.enabled).toBe(false);
    });

    it('should throw NotFoundException if rule to update not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update(organizationId, 'non-existent-id', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a rule', async () => {
      repository.findOne.mockResolvedValue(mockRule as Rule);
      repository.remove.mockResolvedValue(mockRule as Rule);

      await service.remove(organizationId, mockRule.id);

      expect(repository.remove).toHaveBeenCalledWith(mockRule);
    });

    it('should throw NotFoundException if rule to remove not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.remove(organizationId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
