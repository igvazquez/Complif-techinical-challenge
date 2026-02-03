import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto';
import { Organization } from './entities/organization.entity';
import { PaginationQueryDto } from '../common/dto';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;

  const mockOrganization: Organization = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Organization',
    settings: { timezone: 'UTC' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockOrganizationsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        {
          provide: OrganizationsService,
          useValue: mockOrganizationsService,
        },
      ],
    }).compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an organization', async () => {
      const createDto: CreateOrganizationDto = {
        name: 'Test Organization',
        settings: { timezone: 'UTC' },
      };

      mockOrganizationsService.create.mockResolvedValue(mockOrganization);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockOrganization);
      expect(mockOrganizationsService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated organizations', async () => {
      const query: PaginationQueryDto = { page: 1, limit: 10 };
      const paginatedResult = {
        data: [mockOrganization],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockOrganizationsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(query);

      expect(result).toEqual(paginatedResult);
      expect(mockOrganizationsService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return an organization by id', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      mockOrganizationsService.findOne.mockResolvedValue(mockOrganization);

      const result = await controller.findOne(id);

      expect(result).toEqual(mockOrganization);
      expect(mockOrganizationsService.findOne).toHaveBeenCalledWith(id);
    });
  });

  describe('update', () => {
    it('should update an organization', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const updateDto: UpdateOrganizationDto = {
        name: 'Updated Organization',
      };
      const updatedOrganization = {
        ...mockOrganization,
        name: 'Updated Organization',
      };

      mockOrganizationsService.update.mockResolvedValue(updatedOrganization);

      const result = await controller.update(id, updateDto);

      expect(result).toEqual(updatedOrganization);
      expect(mockOrganizationsService.update).toHaveBeenCalledWith(
        id,
        updateDto,
      );
    });
  });

  describe('remove', () => {
    it('should delete an organization', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';

      mockOrganizationsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(id);

      expect(result).toBeUndefined();
      expect(mockOrganizationsService.remove).toHaveBeenCalledWith(id);
    });
  });
});
