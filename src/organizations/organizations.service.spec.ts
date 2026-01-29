/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { Organization } from './entities/organization.entity';
import { createMockOrganization } from '../../test/test-utils';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let repository: jest.Mocked<Repository<Organization>>;

  const mockOrganization = createMockOrganization();

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      remove: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        {
          provide: getRepositoryToken(Organization),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    repository = module.get(getRepositoryToken(Organization));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an organization', async () => {
      const createDto = { name: 'Test Org', settings: { timezone: 'UTC' } };
      const expectedOrg = { ...mockOrganization, ...createDto };

      repository.create.mockReturnValue(expectedOrg as Organization);
      repository.save.mockResolvedValue(expectedOrg as Organization);

      const result = await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith({
        name: createDto.name,
        settings: createDto.settings,
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(expectedOrg);
    });

    it('should use default empty settings if not provided', async () => {
      const createDto = { name: 'Test Org' };
      const expectedOrg = {
        ...mockOrganization,
        name: 'Test Org',
        settings: {},
      };

      repository.create.mockReturnValue(expectedOrg as Organization);
      repository.save.mockResolvedValue(expectedOrg as Organization);

      await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith({
        name: createDto.name,
        settings: {},
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated organizations with default values', async () => {
      const organizations = [mockOrganization];
      repository.findAndCount.mockResolvedValue([
        organizations as Organization[],
        1,
      ]);

      const result = await service.findAll({});

      expect(repository.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({
        data: organizations,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should return paginated organizations with custom page and limit', async () => {
      const organizations = [mockOrganization];
      repository.findAndCount.mockResolvedValue([
        organizations as Organization[],
        25,
      ]);

      const result = await service.findAll({ page: 2, limit: 5 });

      expect(repository.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        skip: 5,
        take: 5,
      });
      expect(result).toEqual({
        data: organizations,
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
    it('should return an organization by id', async () => {
      repository.findOne.mockResolvedValue(mockOrganization as Organization);

      const result = await service.findOne(mockOrganization.id);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockOrganization.id },
      });
      expect(result).toEqual(mockOrganization);
    });

    it('should throw NotFoundException if organization not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        'Organization with ID "non-existent-id" not found',
      );
    });
  });

  describe('update', () => {
    it('should update an organization', async () => {
      const updateDto = { name: 'Updated Org' };
      const existingOrg = { ...mockOrganization };
      const updatedOrg = { ...existingOrg, ...updateDto };

      repository.findOne.mockResolvedValue(existingOrg as Organization);
      repository.save.mockResolvedValue(updatedOrg as Organization);

      const result = await service.update(mockOrganization.id, updateDto);

      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedOrg);
    });

    it('should throw NotFoundException if organization to update not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an organization', async () => {
      repository.findOne.mockResolvedValue(mockOrganization as Organization);
      repository.remove.mockResolvedValue(mockOrganization as Organization);

      await service.remove(mockOrganization.id);

      expect(repository.remove).toHaveBeenCalledWith(mockOrganization);
    });

    it('should throw NotFoundException if organization to remove not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('exists', () => {
    it('should return true if organization exists', async () => {
      repository.count.mockResolvedValue(1);

      const result = await service.exists(mockOrganization.id);

      expect(repository.count).toHaveBeenCalledWith({
        where: { id: mockOrganization.id },
      });
      expect(result).toBe(true);
    });

    it('should return false if organization does not exist', async () => {
      repository.count.mockResolvedValue(0);

      const result = await service.exists('non-existent-id');

      expect(result).toBe(false);
    });
  });
});
