/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { RuleTemplatesService } from './rule-templates.service';
import { RuleTemplate } from './entities/rule-template.entity';
import { createMockRuleTemplate } from '../../test/test-utils';

describe('RuleTemplatesService', () => {
  let service: RuleTemplatesService;
  let repository: jest.Mocked<Repository<RuleTemplate>>;

  const mockRuleTemplate = createMockRuleTemplate();

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      remove: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleTemplatesService,
        {
          provide: getRepositoryToken(RuleTemplate),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<RuleTemplatesService>(RuleTemplatesService);
    repository = module.get(getRepositoryToken(RuleTemplate));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a rule template', async () => {
      const createDto = {
        name: 'Test Template',
        description: 'Test description',
        config: { conditions: {} },
        isDefault: true,
      };
      const expectedTemplate = { ...mockRuleTemplate, ...createDto };

      repository.create.mockReturnValue(expectedTemplate as RuleTemplate);
      repository.save.mockResolvedValue(expectedTemplate as RuleTemplate);

      const result = await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith({
        name: createDto.name,
        description: createDto.description,
        config: createDto.config,
        isDefault: createDto.isDefault,
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(expectedTemplate);
    });

    it('should use default values if not provided', async () => {
      const createDto = { name: 'Test Template' };
      const expectedTemplate = {
        ...mockRuleTemplate,
        name: 'Test Template',
        description: null,
        config: {},
        isDefault: false,
      };

      repository.create.mockReturnValue(expectedTemplate as RuleTemplate);
      repository.save.mockResolvedValue(expectedTemplate as RuleTemplate);

      await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith({
        name: createDto.name,
        description: null,
        config: {},
        isDefault: false,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated rule templates with default values', async () => {
      const templates = [mockRuleTemplate];
      repository.findAndCount.mockResolvedValue([
        templates as RuleTemplate[],
        1,
      ]);

      const result = await service.findAll({});

      expect(repository.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({
        data: templates,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should return paginated rule templates with custom page and limit', async () => {
      const templates = [mockRuleTemplate];
      repository.findAndCount.mockResolvedValue([
        templates as RuleTemplate[],
        25,
      ]);

      const result = await service.findAll({ page: 2, limit: 5 });

      expect(repository.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        skip: 5,
        take: 5,
      });
      expect(result).toEqual({
        data: templates,
        total: 25,
        page: 2,
        limit: 5,
        totalPages: 5,
      });
    });

    it('should calculate totalPages correctly', async () => {
      repository.findAndCount.mockResolvedValue([[], 23]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.totalPages).toBe(3);
    });
  });

  describe('findOne', () => {
    it('should return a rule template by id', async () => {
      repository.findOne.mockResolvedValue(mockRuleTemplate as RuleTemplate);

      const result = await service.findOne(mockRuleTemplate.id);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockRuleTemplate.id },
      });
      expect(result).toEqual(mockRuleTemplate);
    });

    it('should throw NotFoundException if rule template not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        'Rule template with ID "non-existent-id" not found',
      );
    });
  });

  describe('findDefaults', () => {
    it('should return all default rule templates', async () => {
      const defaultTemplates = [
        { ...mockRuleTemplate, isDefault: true },
        { ...mockRuleTemplate, id: 'another-id', isDefault: true },
      ];
      repository.find.mockResolvedValue(defaultTemplates as RuleTemplate[]);

      const result = await service.findDefaults();

      expect(repository.find).toHaveBeenCalledWith({
        where: { isDefault: true },
        order: { name: 'ASC' },
      });
      expect(result).toEqual(defaultTemplates);
    });

    it('should return empty array if no default templates', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.findDefaults();

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update a rule template', async () => {
      const updateDto = { name: 'Updated Template' };
      const existingTemplate = { ...mockRuleTemplate };
      const updatedTemplate = { ...existingTemplate, ...updateDto };

      repository.findOne.mockResolvedValue(existingTemplate as RuleTemplate);
      repository.save.mockResolvedValue(updatedTemplate as RuleTemplate);

      const result = await service.update(mockRuleTemplate.id, updateDto);

      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedTemplate);
    });

    it('should throw NotFoundException if rule template to update not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a rule template', async () => {
      repository.findOne.mockResolvedValue(mockRuleTemplate as RuleTemplate);
      repository.remove.mockResolvedValue(mockRuleTemplate as RuleTemplate);

      await service.remove(mockRuleTemplate.id);

      expect(repository.remove).toHaveBeenCalledWith(mockRuleTemplate);
    });

    it('should throw NotFoundException if rule template to remove not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('exists', () => {
    it('should return true if rule template exists', async () => {
      repository.count.mockResolvedValue(1);

      const result = await service.exists(mockRuleTemplate.id);

      expect(repository.count).toHaveBeenCalledWith({
        where: { id: mockRuleTemplate.id },
      });
      expect(result).toBe(true);
    });

    it('should return false if rule template does not exist', async () => {
      repository.count.mockResolvedValue(0);

      const result = await service.exists('non-existent-id');

      expect(result).toBe(false);
    });
  });
});
