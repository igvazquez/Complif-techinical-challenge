import { Test, TestingModule } from '@nestjs/testing';
import { RuleTemplatesController } from './rule-templates.controller';
import { RuleTemplatesService } from './rule-templates.service';
import { CreateRuleTemplateDto, UpdateRuleTemplateDto } from './dto';
import { RuleTemplate } from './entities/rule-template.entity';
import { PaginationQueryDto } from '../common/dto';

describe('RuleTemplatesController', () => {
  let controller: RuleTemplatesController;

  const mockRuleTemplate: RuleTemplate = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'High Value Transaction Template',
    description: 'Template for high value transaction detection',
    conditions: {
      all: [{ fact: 'amount', operator: 'greaterThan', value: 10000 }],
    },
    event: { type: 'HIGH_VALUE', params: {} },
    priority: 1,
    isDefault: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as RuleTemplate;

  const mockRuleTemplatesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findDefaults: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RuleTemplatesController],
      providers: [
        {
          provide: RuleTemplatesService,
          useValue: mockRuleTemplatesService,
        },
      ],
    }).compile();

    controller = module.get<RuleTemplatesController>(RuleTemplatesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a rule template', async () => {
      const createDto: CreateRuleTemplateDto = {
        name: 'High Value Transaction Template',
        conditions: {
          all: [{ fact: 'amount', operator: 'greaterThan', value: 10000 }],
        },
        event: { type: 'HIGH_VALUE', params: {} },
        priority: 1,
      };

      mockRuleTemplatesService.create.mockResolvedValue(mockRuleTemplate);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockRuleTemplate);
      expect(mockRuleTemplatesService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated rule templates', async () => {
      const query: PaginationQueryDto = { page: 1, limit: 10 };
      const paginatedResult = {
        data: [mockRuleTemplate],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockRuleTemplatesService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(query);

      expect(result).toEqual(paginatedResult);
      expect(mockRuleTemplatesService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findDefaults', () => {
    it('should return default rule templates', async () => {
      const defaultTemplate = { ...mockRuleTemplate, isDefault: true };

      mockRuleTemplatesService.findDefaults.mockResolvedValue([
        defaultTemplate,
      ]);

      const result = await controller.findDefaults();

      expect(result).toEqual([defaultTemplate]);
      expect(mockRuleTemplatesService.findDefaults).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a rule template by id', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      mockRuleTemplatesService.findOne.mockResolvedValue(mockRuleTemplate);

      const result = await controller.findOne(id);

      expect(result).toEqual(mockRuleTemplate);
      expect(mockRuleTemplatesService.findOne).toHaveBeenCalledWith(id);
    });
  });

  describe('update', () => {
    it('should update a rule template', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const updateDto: UpdateRuleTemplateDto = {
        name: 'Updated Template Name',
        priority: 2,
      };
      const updatedTemplate = {
        ...mockRuleTemplate,
        name: 'Updated Template Name',
        priority: 2,
      };

      mockRuleTemplatesService.update.mockResolvedValue(updatedTemplate);

      const result = await controller.update(id, updateDto);

      expect(result).toEqual(updatedTemplate);
      expect(mockRuleTemplatesService.update).toHaveBeenCalledWith(
        id,
        updateDto,
      );
    });
  });

  describe('remove', () => {
    it('should delete a rule template', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      mockRuleTemplatesService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(id);

      expect(result).toBeUndefined();
      expect(mockRuleTemplatesService.remove).toHaveBeenCalledWith(id);
    });
  });
});
