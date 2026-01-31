/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TemplateOverridesService } from './template-overrides.service';
import { TemplateOverride } from './entities/template-override.entity';
import { RuleTemplatesService } from '../rule-templates/rule-templates.service';
import {
  createMockTemplateOverride,
  createMockRuleTemplate,
  generateUUID,
} from '../../test/test-utils';

describe('TemplateOverridesService', () => {
  let service: TemplateOverridesService;
  let repository: jest.Mocked<Repository<TemplateOverride>>;
  let ruleTemplatesService: jest.Mocked<RuleTemplatesService>;

  const organizationId = generateUUID();
  const mockTemplateOverride = createMockTemplateOverride({
    idOrganization: organizationId,
  });
  const mockRuleTemplate = createMockRuleTemplate();

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      remove: jest.fn(),
    };

    const mockRuleTemplatesService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateOverridesService,
        {
          provide: getRepositoryToken(TemplateOverride),
          useValue: mockRepository,
        },
        {
          provide: RuleTemplatesService,
          useValue: mockRuleTemplatesService,
        },
      ],
    }).compile();

    service = module.get<TemplateOverridesService>(TemplateOverridesService);
    repository = module.get(getRepositoryToken(TemplateOverride));
    ruleTemplatesService = module.get(RuleTemplatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a template override', async () => {
      const createDto = {
        idTemplate: mockRuleTemplate.id,
        overrides: { threshold: 5000 },
        enabled: true,
      };

      ruleTemplatesService.findOne.mockResolvedValue(mockRuleTemplate as any);
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue({
        ...mockTemplateOverride,
        ...createDto,
        idOrganization: organizationId,
      } as TemplateOverride);
      repository.save.mockResolvedValue({
        ...mockTemplateOverride,
        ...createDto,
        idOrganization: organizationId,
      } as TemplateOverride);

      const result = await service.create(organizationId, createDto);

      expect(ruleTemplatesService.findOne).toHaveBeenCalledWith(
        createDto.idTemplate,
      );
      expect(repository.create).toHaveBeenCalledWith({
        idOrganization: organizationId,
        idTemplate: createDto.idTemplate,
        overrides: createDto.overrides,
        enabled: createDto.enabled,
      });
      expect(result.idOrganization).toBe(organizationId);
    });

    it('should throw ConflictException if override already exists', async () => {
      const createDto = {
        idTemplate: mockRuleTemplate.id,
      };

      ruleTemplatesService.findOne.mockResolvedValue(mockRuleTemplate as any);
      repository.findOne.mockResolvedValue(
        mockTemplateOverride as TemplateOverride,
      );

      await expect(service.create(organizationId, createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if template does not exist', async () => {
      const createDto = {
        idTemplate: 'non-existent-template',
      };

      ruleTemplatesService.findOne.mockRejectedValue(
        new NotFoundException('Template not found'),
      );

      await expect(service.create(organizationId, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated template overrides', async () => {
      const overrides = [mockTemplateOverride];
      repository.findAndCount.mockResolvedValue([
        overrides as TemplateOverride[],
        1,
      ]);

      const result = await service.findAll(organizationId, {});

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { idOrganization: organizationId },
        relations: ['template'],
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({
        data: overrides,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe('findOne', () => {
    it('should return a template override by id', async () => {
      repository.findOne.mockResolvedValue(
        mockTemplateOverride as TemplateOverride,
      );

      const result = await service.findOne(
        organizationId,
        mockTemplateOverride.id,
      );

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockTemplateOverride.id, idOrganization: organizationId },
        relations: ['template'],
      });
      expect(result).toEqual(mockTemplateOverride);
    });

    it('should throw NotFoundException if override not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(organizationId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMergedConfig', () => {
    it('should return merged config when override exists and is enabled', async () => {
      const template = {
        ...mockRuleTemplate,
        config: { threshold: 10000, category: 'AML' },
      };
      const override = {
        ...mockTemplateOverride,
        overrides: { threshold: 5000 },
        enabled: true,
      };

      ruleTemplatesService.findOne.mockResolvedValue(template as any);
      repository.findOne.mockResolvedValue(override as TemplateOverride);

      const result = await service.getMergedConfig(organizationId, template.id);

      expect(result).toEqual({ threshold: 5000, category: 'AML' });
    });

    it('should return template config when override is disabled', async () => {
      const template = {
        ...mockRuleTemplate,
        config: { threshold: 10000, category: 'AML' },
      };
      const override = {
        ...mockTemplateOverride,
        overrides: { threshold: 5000 },
        enabled: false,
      };

      ruleTemplatesService.findOne.mockResolvedValue(template as any);
      repository.findOne.mockResolvedValue(override as TemplateOverride);

      const result = await service.getMergedConfig(organizationId, template.id);

      expect(result).toEqual({ threshold: 10000, category: 'AML' });
    });

    it('should return template config when no override exists', async () => {
      const template = {
        ...mockRuleTemplate,
        config: { threshold: 10000 },
      };

      ruleTemplatesService.findOne.mockResolvedValue(template as any);
      repository.findOne.mockResolvedValue(null);

      const result = await service.getMergedConfig(organizationId, template.id);

      expect(result).toEqual({ threshold: 10000 });
    });

    it('should deep merge nested objects', async () => {
      const template = {
        ...mockRuleTemplate,
        config: {
          conditions: { all: [{ fact: 'amount', value: 1000 }] },
          event: { type: 'alert', params: { severity: 'LOW' } },
        },
      };
      const override = {
        ...mockTemplateOverride,
        overrides: {
          conditions: { all: [{ fact: 'amount', value: 5000 }] },
          event: { params: { severity: 'HIGH' } },
        },
        enabled: true,
      };

      ruleTemplatesService.findOne.mockResolvedValue(template as any);
      repository.findOne.mockResolvedValue(override as TemplateOverride);

      const result = await service.getMergedConfig(organizationId, template.id);

      expect(result).toEqual({
        conditions: { all: [{ fact: 'amount', value: 5000 }] },
        event: { type: 'alert', params: { severity: 'HIGH' } },
      });
    });
  });

  describe('update', () => {
    it('should update a template override', async () => {
      const updateDto = { enabled: false };
      const existingOverride = { ...mockTemplateOverride };
      const updatedOverride = { ...existingOverride, ...updateDto };

      repository.findOne.mockResolvedValue(
        existingOverride as TemplateOverride,
      );
      repository.save.mockResolvedValue(updatedOverride as TemplateOverride);

      const result = await service.update(
        organizationId,
        mockTemplateOverride.id,
        updateDto,
      );

      expect(repository.save).toHaveBeenCalled();
      expect(result.enabled).toBe(false);
    });

    it('should throw NotFoundException if override to update not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update(organizationId, 'non-existent-id', { enabled: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a template override', async () => {
      repository.findOne.mockResolvedValue(
        mockTemplateOverride as TemplateOverride,
      );
      repository.remove.mockResolvedValue(
        mockTemplateOverride as TemplateOverride,
      );

      await service.remove(organizationId, mockTemplateOverride.id);

      expect(repository.remove).toHaveBeenCalledWith(mockTemplateOverride);
    });

    it('should throw NotFoundException if override to remove not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.remove(organizationId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
