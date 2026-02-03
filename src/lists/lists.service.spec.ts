/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getLoggerToken } from 'nestjs-pino';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ListsService } from './lists.service';
import { ListEntry, ListType, EntityType } from './entities/list-entry.entity';

describe('ListsService', () => {
  let service: ListsService;
  let repository: jest.Mocked<Repository<ListEntry>>;

  const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockOrganizationId = 'org-123';

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      remove: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListsService,
        {
          provide: getRepositoryToken(ListEntry),
          useValue: mockRepository,
        },
        {
          provide: getLoggerToken(ListsService.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<ListsService>(ListsService);
    repository = module.get(getRepositoryToken(ListEntry));

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      listType: ListType.BLACKLIST,
      entityType: EntityType.COUNTRY,
      entityValue: 'AR',
      reason: 'Test reason',
    };

    it('should create a new list entry successfully', async () => {
      const mockEntry: Partial<ListEntry> = {
        id: 'entry-001',
        idOrganization: mockOrganizationId,
        listType: ListType.BLACKLIST,
        entityType: EntityType.COUNTRY,
        entityValue: 'AR',
        reason: 'Test reason',
        expiresAt: null,
        createdBy: null,
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockEntry as ListEntry);
      repository.save.mockResolvedValue(mockEntry as ListEntry);

      const result = await service.create(mockOrganizationId, createDto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          idOrganization: mockOrganizationId,
          listType: ListType.BLACKLIST,
          entityType: EntityType.COUNTRY,
          entityValue: 'AR',
        },
      });
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe('entry-001');
    });

    it('should throw ConflictException when duplicate entry exists', async () => {
      const existingEntry: Partial<ListEntry> = {
        id: 'entry-001',
        idOrganization: mockOrganizationId,
        listType: ListType.BLACKLIST,
        entityType: EntityType.COUNTRY,
        entityValue: 'AR',
      };

      repository.findOne.mockResolvedValue(existingEntry as ListEntry);

      await expect(
        service.create(mockOrganizationId, createDto),
      ).rejects.toThrow(ConflictException);

      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should handle expiresAt date correctly', async () => {
      const dtoWithExpiry = {
        ...createDto,
        expiresAt: '2025-12-31T23:59:59.000Z',
      };

      const mockEntry: Partial<ListEntry> = {
        id: 'entry-001',
        expiresAt: new Date('2025-12-31T23:59:59.000Z'),
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockEntry as ListEntry);
      repository.save.mockResolvedValue(mockEntry as ListEntry);

      await service.create(mockOrganizationId, dtoWithExpiry);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: new Date('2025-12-31T23:59:59.000Z'),
        }),
      );
    });
  });

  describe('findByOrganization', () => {
    it('should return paginated list entries', async () => {
      const mockEntries = [
        { id: 'entry-1' } as ListEntry,
        { id: 'entry-2' } as ListEntry,
      ];

      repository.findAndCount.mockResolvedValue([mockEntries, 2]);

      const result = await service.findByOrganization(mockOrganizationId, {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should apply filters correctly', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByOrganization(mockOrganizationId, {
        listType: ListType.BLACKLIST,
        entityType: EntityType.COUNTRY,
        entityValue: 'AR',
        page: 1,
        limit: 10,
      });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            idOrganization: mockOrganizationId,
            listType: ListType.BLACKLIST,
            entityType: EntityType.COUNTRY,
            entityValue: 'AR',
          },
        }),
      );
    });

    it('should use default pagination values', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByOrganization(mockOrganizationId, {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return entry by id', async () => {
      const mockEntry = {
        id: 'entry-001',
        idOrganization: mockOrganizationId,
      } as ListEntry;

      repository.findOne.mockResolvedValue(mockEntry);

      const result = await service.findOne(mockOrganizationId, 'entry-001');

      expect(result).toBe(mockEntry);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'entry-001', idOrganization: mockOrganizationId },
      });
    });

    it('should throw NotFoundException when entry not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(mockOrganizationId, 'entry-001'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove entry successfully', async () => {
      const mockEntry = {
        id: 'entry-001',
        idOrganization: mockOrganizationId,
        listType: ListType.BLACKLIST,
        entityType: EntityType.COUNTRY,
      } as ListEntry;

      repository.findOne.mockResolvedValue(mockEntry);
      repository.remove.mockResolvedValue(mockEntry);

      await service.remove(mockOrganizationId, 'entry-001');

      expect(repository.remove).toHaveBeenCalledWith(mockEntry);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          listEntryId: 'entry-001',
          organizationId: mockOrganizationId,
        }),
        'List entry removed',
      );
    });

    it('should throw NotFoundException when entry not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.remove(mockOrganizationId, 'entry-001'),
      ).rejects.toThrow(NotFoundException);

      expect(repository.remove).not.toHaveBeenCalled();
    });
  });

  describe('isInList', () => {
    it('should return true when entry exists without expiration', async () => {
      const mockEntry = {
        id: 'entry-001',
        expiresAt: null,
      } as ListEntry;

      repository.findOne.mockResolvedValue(mockEntry);

      const result = await service.isInList(
        mockOrganizationId,
        ListType.BLACKLIST,
        EntityType.COUNTRY,
        'AR',
      );

      expect(result).toBe(true);
    });

    it('should return true when entry exists with future expiration', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const mockEntry = {
        id: 'entry-001',
        expiresAt: futureDate,
      } as ListEntry;

      repository.findOne.mockResolvedValue(mockEntry);

      const result = await service.isInList(
        mockOrganizationId,
        ListType.BLACKLIST,
        EntityType.COUNTRY,
        'AR',
      );

      expect(result).toBe(true);
    });

    it('should return false when entry not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.isInList(
        mockOrganizationId,
        ListType.BLACKLIST,
        EntityType.COUNTRY,
        'AR',
      );

      expect(result).toBe(false);
    });

    it('should query with correct parameters including expiration check', async () => {
      repository.findOne.mockResolvedValue(null);

      await service.isInList(
        mockOrganizationId,
        ListType.WHITELIST,
        EntityType.ACCOUNT,
        'acc-123',
      );

      expect(repository.findOne).toHaveBeenCalledWith({
        where: expect.arrayContaining([
          expect.objectContaining({
            idOrganization: mockOrganizationId,
            listType: ListType.WHITELIST,
            entityType: EntityType.ACCOUNT,
            entityValue: 'acc-123',
            expiresAt: null,
          }),
          expect.objectContaining({
            idOrganization: mockOrganizationId,
            listType: ListType.WHITELIST,
            entityType: EntityType.ACCOUNT,
            entityValue: 'acc-123',
            expiresAt: expect.any(Object), // MoreThan(now)
          }),
        ]),
      });
    });
  });

  describe('removeExpired', () => {
    it('should remove expired entries for all organizations', async () => {
      repository.delete.mockResolvedValue({ affected: 5, raw: [] });

      const result = await service.removeExpired();

      expect(result).toBe(5);
      expect(repository.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.any(Object), // LessThan(now)
        }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedCount: 5,
          organizationId: 'all',
        }),
        'Expired list entries removed',
      );
    });

    it('should remove expired entries for specific organization', async () => {
      repository.delete.mockResolvedValue({ affected: 2, raw: [] });

      const result = await service.removeExpired(mockOrganizationId);

      expect(result).toBe(2);
      expect(repository.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          idOrganization: mockOrganizationId,
        }),
      );
    });

    it('should not log when no entries deleted', async () => {
      repository.delete.mockResolvedValue({ affected: 0, raw: [] });

      const result = await service.removeExpired();

      expect(result).toBe(0);
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });
});
