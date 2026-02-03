import { Test, TestingModule } from '@nestjs/testing';
import { TemplateOverridesController } from './template-overrides.controller';
import { TemplateOverridesService } from './template-overrides.service';
import { CreateTemplateOverrideDto, UpdateTemplateOverrideDto } from './dto';
import { TemplateOverride } from './entities/template-override.entity';
import { PaginationQueryDto } from '../common/dto';

describe('TemplateOverridesController', () => {
  let controller: TemplateOverridesController;

  const mockTemplateOverride: TemplateOverride = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    idOrganization: 'org-123',
    idTemplate: 'template-123',
    conditionsOverride: {
      all: [{ fact: 'amount', operator: 'greaterThan', value: 15000 }],
    },
    eventOverride: { type: 'HIGH_VALUE', params: { severity: 'critical' } },
    priorityOverride: 2,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as TemplateOverride;

  const mockTemplateOverridesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    getMergedConfig: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplateOverridesController],
      providers: [
        {
          provide: TemplateOverridesService,
          useValue: mockTemplateOverridesService,
        },
      ],
    }).compile();

    controller = module.get<TemplateOverridesController>(
      TemplateOverridesController,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a template override', async () => {
      const organizationId = 'org-123';
      const createDto: CreateTemplateOverrideDto = {
        idTemplate: 'template-123',
        conditionsOverride: {
          all: [{ fact: 'amount', operator: 'greaterThan', value: 15000 }],
        },
        eventOverride: { type: 'HIGH_VALUE', params: { severity: 'critical' } },
        priorityOverride: 2,
      };

      mockTemplateOverridesService.create.mockResolvedValue(
        mockTemplateOverride,
      );

      const result = await controller.create(organizationId, createDto);

      expect(result).toEqual(mockTemplateOverride);
      expect(mockTemplateOverridesService.create).toHaveBeenCalledWith(
        organizationId,
        createDto,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated template overrides', async () => {
      const organizationId = 'org-123';
      const query: PaginationQueryDto = { page: 1, limit: 10 };
      const paginatedResult = {
        data: [mockTemplateOverride],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockTemplateOverridesService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(organizationId, query);

      expect(result).toEqual(paginatedResult);
      expect(mockTemplateOverridesService.findAll).toHaveBeenCalledWith(
        organizationId,
        query,
      );
    });
  });

  describe('findOne', () => {
    it('should return a template override by id', async () => {
      const organizationId = 'org-123';
      const id = '123e4567-e89b-12d3-a456-426614174000';

      mockTemplateOverridesService.findOne.mockResolvedValue(
        mockTemplateOverride,
      );

      const result = await controller.findOne(organizationId, id);

      expect(result).toEqual(mockTemplateOverride);
      expect(mockTemplateOverridesService.findOne).toHaveBeenCalledWith(
        organizationId,
        id,
      );
    });
  });

  describe('getMergedConfig', () => {
    it('should return merged config for a template', async () => {
      const organizationId = 'org-123';
      const templateId = 'template-123';
      const mergedConfig = {
        conditions: {
          all: [{ fact: 'amount', operator: 'greaterThan', value: 15000 }],
        },
        event: { type: 'HIGH_VALUE', params: { severity: 'critical' } },
        priority: 2,
      };

      mockTemplateOverridesService.getMergedConfig.mockResolvedValue(
        mergedConfig,
      );

      const result = await controller.getMergedConfig(
        organizationId,
        templateId,
      );

      expect(result).toEqual(mergedConfig);
      expect(mockTemplateOverridesService.getMergedConfig).toHaveBeenCalledWith(
        organizationId,
        templateId,
      );
    });
  });

  describe('update', () => {
    it('should update a template override', async () => {
      const organizationId = 'org-123';
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const updateDto: UpdateTemplateOverrideDto = {
        priorityOverride: 3,
      };
      const updatedOverride = { ...mockTemplateOverride, priorityOverride: 3 };

      mockTemplateOverridesService.update.mockResolvedValue(updatedOverride);

      const result = await controller.update(organizationId, id, updateDto);

      expect(result).toEqual(updatedOverride);
      expect(mockTemplateOverridesService.update).toHaveBeenCalledWith(
        organizationId,
        id,
        updateDto,
      );
    });
  });

  describe('remove', () => {
    it('should delete a template override', async () => {
      const organizationId = 'org-123';
      const id = '123e4567-e89b-12d3-a456-426614174000';

      mockTemplateOverridesService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(organizationId, id);

      expect(result).toBeUndefined();
      expect(mockTemplateOverridesService.remove).toHaveBeenCalledWith(
        organizationId,
        id,
      );
    });
  });
});
