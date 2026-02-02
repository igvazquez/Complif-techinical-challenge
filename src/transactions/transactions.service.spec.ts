/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { getLoggerToken } from 'nestjs-pino';
import { TransactionsService } from './transactions.service';
import { Transaction } from './entities/transaction.entity';
import { EngineService } from '../engine/engine.service';
import { createMockTransaction, generateUUID } from '../../test/test-utils';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let repository: jest.Mocked<Repository<Transaction>>;
  let engineService: jest.Mocked<EngineService>;

  const organizationId = generateUUID();
  const mockTransaction = createMockTransaction({
    idOrganization: organizationId,
  });

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };

    const mockEngineService = {
      evaluate: jest.fn(),
    };

    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const mockCounter = {
      inc: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockRepository,
        },
        {
          provide: EngineService,
          useValue: mockEngineService,
        },
        {
          provide: getLoggerToken(TransactionsService.name),
          useValue: mockLogger,
        },
        {
          provide: 'PROM_METRIC_TRANSACTIONS_PROCESSED_TOTAL',
          useValue: mockCounter,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    repository = module.get(getRepositoryToken(Transaction));
    engineService = module.get(EngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a transaction', async () => {
      const createDto = {
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
      };

      const savedTransaction = {
        ...mockTransaction,
        ...createDto,
        idOrganization: organizationId,
        datetime: new Date(createDto.datetime),
      };

      repository.create.mockReturnValue(savedTransaction as Transaction);
      repository.save.mockResolvedValue(savedTransaction as Transaction);

      const result = await service.create(organizationId, createDto);

      expect(repository.create).toHaveBeenCalledWith({
        idOrganization: organizationId,
        idAccount: createDto.idAccount,
        amount: createDto.amount,
        amountNormalized: createDto.amountNormalized,
        currency: createDto.currency,
        type: createDto.type,
        subType: null,
        datetime: expect.any(Date),
        date: createDto.date,
        isVoided: false,
        isBlocked: false,
        isDeleted: false,
        origin: null,
        deviceInfo: null,
        data: {},
        externalCode: null,
        country: null,
        counterpartyId: null,
        counterpartyCountry: null,
      });
      expect(result.idOrganization).toBe(organizationId);
    });

    it('should create a transaction with optional fields', async () => {
      const createDto = {
        idAccount: 'acc-123',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'USD',
        type: 'CASH_IN',
        datetime: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        subType: 'DEPOSIT',
        country: 'US',
        origin: 'API',
        data: { merchantId: 'merch-123' },
      };

      const savedTransaction = {
        ...mockTransaction,
        ...createDto,
        idOrganization: organizationId,
        datetime: new Date(createDto.datetime),
      };

      repository.create.mockReturnValue(savedTransaction as Transaction);
      repository.save.mockResolvedValue(savedTransaction as Transaction);

      const result = await service.create(organizationId, createDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subType: 'DEPOSIT',
          country: 'US',
          origin: 'API',
          data: { merchantId: 'merch-123' },
        }),
      );
      expect(result.subType).toBe('DEPOSIT');
    });
  });

  describe('createAndEvaluate', () => {
    const createDto = {
      idAccount: 'acc-123',
      amount: 1000,
      amountNormalized: 1000,
      currency: 'USD',
      type: 'CASH_IN',
      datetime: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
    };

    it('should create and evaluate a transaction', async () => {
      const savedTransaction = {
        ...mockTransaction,
        ...createDto,
        id: generateUUID(),
        idOrganization: organizationId,
        datetime: new Date(createDto.datetime),
      };

      const evaluationResult = {
        success: true,
        events: [
          {
            type: 'alert',
            params: {
              ruleId: 'rule-1',
              ruleName: 'Test Rule',
              severity: 'HIGH',
            },
          },
        ],
        failedRules: [],
        evaluatedRulesCount: 1,
        evaluationTimeMs: 10,
      };

      repository.create.mockReturnValue(savedTransaction as Transaction);
      repository.save.mockResolvedValue(savedTransaction as Transaction);
      engineService.evaluate.mockResolvedValue(evaluationResult);

      const result = await service.createAndEvaluate(
        organizationId,
        createDto,
        'api',
      );

      expect(repository.save).toHaveBeenCalled();
      expect(engineService.evaluate).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({
          transaction: expect.objectContaining({
            id: savedTransaction.id,
            idAccount: createDto.idAccount,
            amount: createDto.amount,
          }),
        }),
      );
      expect(result.transaction).toBeDefined();
      expect(result.evaluation).toEqual(evaluationResult);
    });

    it('should fail-open when evaluation fails', async () => {
      const savedTransaction = {
        ...mockTransaction,
        ...createDto,
        id: generateUUID(),
        idOrganization: organizationId,
        datetime: new Date(createDto.datetime),
      };

      repository.create.mockReturnValue(savedTransaction as Transaction);
      repository.save.mockResolvedValue(savedTransaction as Transaction);
      engineService.evaluate.mockRejectedValue(new Error('Evaluation failed'));

      const result = await service.createAndEvaluate(
        organizationId,
        createDto,
        'api',
      );

      // Transaction should still be saved
      expect(repository.save).toHaveBeenCalled();
      expect(result.transaction).toBeDefined();
      // Evaluation should have empty result
      expect(result.evaluation).toEqual({
        success: false,
        events: [],
        failedRules: [],
        evaluatedRulesCount: 0,
        evaluationTimeMs: 0,
      });
    });
  });

  describe('findOne', () => {
    it('should return a transaction by id', async () => {
      repository.findOne.mockResolvedValue(mockTransaction as Transaction);

      const result = await service.findOne(organizationId, mockTransaction.id);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockTransaction.id, idOrganization: organizationId },
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException if transaction not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(organizationId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByOrganization', () => {
    it('should return paginated transactions', async () => {
      const transactions = [mockTransaction];
      repository.findAndCount.mockResolvedValue([
        transactions as Transaction[],
        1,
      ]);

      const result = await service.findByOrganization(organizationId, {});

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { idOrganization: organizationId },
        order: { datetime: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({
        data: transactions,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should return paginated transactions with custom page and limit', async () => {
      const transactions = [mockTransaction];
      repository.findAndCount.mockResolvedValue([
        transactions as Transaction[],
        25,
      ]);

      const result = await service.findByOrganization(organizationId, {
        page: 2,
        limit: 5,
      });

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: { idOrganization: organizationId },
        order: { datetime: 'DESC' },
        skip: 5,
        take: 5,
      });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.totalPages).toBe(5);
    });
  });
});
