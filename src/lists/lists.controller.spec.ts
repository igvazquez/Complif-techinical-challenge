import { Test, TestingModule } from '@nestjs/testing';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { CreateListEntryDto, ListEntryQueryDto } from './dto';
import { ListEntry, ListType, EntityType } from './entities/list-entry.entity';

describe('ListsController', () => {
  let controller: ListsController;

  const mockListEntry: ListEntry = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    idOrganization: 'org-123',
    listType: ListType.BLACKLIST,
    entityType: EntityType.ACCOUNT,
    entityValue: 'blocked-account-123',
    reason: 'Suspicious activity',
    expiresAt: null,
    createdBy: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as ListEntry;

  const mockListsService = {
    create: jest.fn(),
    findByOrganization: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListsController],
      providers: [
        {
          provide: ListsService,
          useValue: mockListsService,
        },
      ],
    }).compile();

    controller = module.get<ListsController>(ListsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a list entry', async () => {
      const organizationId = 'org-123';
      const createDto: CreateListEntryDto = {
        listType: ListType.BLACKLIST,
        entityType: EntityType.ACCOUNT,
        entityValue: 'blocked-account-123',
        reason: 'Suspicious activity',
      };

      mockListsService.create.mockResolvedValue(mockListEntry);

      const result = await controller.create(organizationId, createDto);

      expect(result).toEqual(mockListEntry);
      expect(mockListsService.create).toHaveBeenCalledWith(
        organizationId,
        createDto,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated list entries', async () => {
      const organizationId = 'org-123';
      const query: ListEntryQueryDto = { page: 1, limit: 10 };
      const paginatedResult = {
        data: [mockListEntry],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockListsService.findByOrganization.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(organizationId, query);

      expect(result).toEqual(paginatedResult);
      expect(mockListsService.findByOrganization).toHaveBeenCalledWith(
        organizationId,
        query,
      );
    });

    it('should filter by listType', async () => {
      const organizationId = 'org-123';
      const query: ListEntryQueryDto = {
        page: 1,
        limit: 10,
        listType: ListType.BLACKLIST,
      };
      const paginatedResult = {
        data: [mockListEntry],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockListsService.findByOrganization.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(organizationId, query);

      expect(result).toEqual(paginatedResult);
      expect(mockListsService.findByOrganization).toHaveBeenCalledWith(
        organizationId,
        query,
      );
    });
  });

  describe('findOne', () => {
    it('should return a list entry by id', async () => {
      const organizationId = 'org-123';
      const id = '123e4567-e89b-12d3-a456-426614174000';

      mockListsService.findOne.mockResolvedValue(mockListEntry);

      const result = await controller.findOne(organizationId, id);

      expect(result).toEqual(mockListEntry);
      expect(mockListsService.findOne).toHaveBeenCalledWith(organizationId, id);
    });
  });

  describe('remove', () => {
    it('should delete a list entry', async () => {
      const organizationId = 'org-123';
      const id = '123e4567-e89b-12d3-a456-426614174000';

      mockListsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(organizationId, id);

      expect(result).toBeUndefined();
      expect(mockListsService.remove).toHaveBeenCalledWith(organizationId, id);
    });
  });
});
