import { Test, TestingModule } from '@nestjs/testing';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { CreateRuleDto, UpdateRuleDto } from './dto';
import { Rule } from './entities/rule.entity';
import { PaginationQueryDto } from '../common/dto';

describe('RulesController', () => {
  let controller: RulesController;

  const mockRule: Rule = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    idOrganization: 'org-123',
    idTemplate: null,
    name: 'High Value Transaction Rule',
    description: 'Alerts on transactions over 10000',
    conditions: {
      all: [{ fact: 'amount', operator: 'greaterThan', value: 10000 }],
    },
    event: { type: 'HIGH_VALUE', params: {} },
    priority: 1,
    isEnabled: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as Rule;

  const mockRulesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findEnabledByPriority: jest.fn(),
    findOne: jest.fn(),
    getEffectiveConfigById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RulesController],
      providers: [
        {
          provide: RulesService,
          useValue: mockRulesService,
        },
      ],
    }).compile();

    controller = module.get<RulesController>(RulesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a rule', async () => {
      const organizationId = 'org-123';
      const createDto: CreateRuleDto = {
        name: 'High Value Transaction Rule',
        conditions: {
          all: [{ fact: 'amount', operator: 'greaterThan', value: 10000 }],
        },
        event: { type: 'HIGH_VALUE', params: {} },
        priority: 1,
        isEnabled: true,
      };

      mockRulesService.create.mockResolvedValue(mockRule);

      const result = await controller.create(organizationId, createDto);

      expect(result).toEqual(mockRule);
      expect(mockRulesService.create).toHaveBeenCalledWith(
        organizationId,
        createDto,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated rules', async () => {
      const organizationId = 'org-123';
      const query: PaginationQueryDto = { page: 1, limit: 10 };
      const paginatedResult = {
        data: [mockRule],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockRulesService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(organizationId, query);

      expect(result).toEqual(paginatedResult);
      expect(mockRulesService.findAll).toHaveBeenCalledWith(
        organizationId,
        query,
      );
    });
  });

  describe('findEnabledByPriority', () => {
    it('should return enabled rules sorted by priority', async () => {
      const organizationId = 'org-123';
      const enabledRules = [mockRule];

      mockRulesService.findEnabledByPriority.mockResolvedValue(enabledRules);

      const result = await controller.findEnabledByPriority(organizationId);

      expect(result).toEqual(enabledRules);
      expect(mockRulesService.findEnabledByPriority).toHaveBeenCalledWith(
        organizationId,
      );
    });
  });

  describe('findOne', () => {
    it('should return a rule by id', async () => {
      const organizationId = 'org-123';
      const id = '123e4567-e89b-12d3-a456-426614174000';

      mockRulesService.findOne.mockResolvedValue(mockRule);

      const result = await controller.findOne(organizationId, id);

      expect(result).toEqual(mockRule);
      expect(mockRulesService.findOne).toHaveBeenCalledWith(organizationId, id);
    });
  });

  describe('getEffectiveConfig', () => {
    it('should return effective config for a rule', async () => {
      const organizationId = 'org-123';
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const effectiveConfig = {
        conditions: {
          all: [{ fact: 'amount', operator: 'greaterThan', value: 15000 }],
        },
        event: { type: 'HIGH_VALUE', params: {} },
        priority: 1,
      };

      mockRulesService.getEffectiveConfigById.mockResolvedValue(
        effectiveConfig,
      );

      const result = await controller.getEffectiveConfig(organizationId, id);

      expect(result).toEqual(effectiveConfig);
      expect(mockRulesService.getEffectiveConfigById).toHaveBeenCalledWith(
        organizationId,
        id,
      );
    });
  });

  describe('update', () => {
    it('should update a rule', async () => {
      const organizationId = 'org-123';
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const updateDto: UpdateRuleDto = {
        name: 'Updated Rule Name',
        priority: 2,
      };
      const updatedRule = {
        ...mockRule,
        name: 'Updated Rule Name',
        priority: 2,
      };

      mockRulesService.update.mockResolvedValue(updatedRule);

      const result = await controller.update(organizationId, id, updateDto);

      expect(result).toEqual(updatedRule);
      expect(mockRulesService.update).toHaveBeenCalledWith(
        organizationId,
        id,
        updateDto,
      );
    });
  });

  describe('remove', () => {
    it('should delete a rule', async () => {
      const organizationId = 'org-123';
      const id = '123e4567-e89b-12d3-a456-426614174000';

      mockRulesService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(organizationId, id);

      expect(result).toBeUndefined();
      expect(mockRulesService.remove).toHaveBeenCalledWith(organizationId, id);
    });
  });
});
