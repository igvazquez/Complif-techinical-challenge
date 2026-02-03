import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, TransactionResponseDto } from './dto';
import { Transaction } from './entities/transaction.entity';
import { PaginationQueryDto } from '../common/dto';

describe('TransactionsController', () => {
  let controller: TransactionsController;

  const mockTransaction: Transaction = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    idOrganization: 'org-123',
    idAccount: 'acc-12345',
    type: 'CASH_IN',
    subType: 'DEPOSIT',
    amount: 5000,
    amountNormalized: 5000,
    currency: 'USD',
    datetime: new Date('2024-01-15T10:30:00Z'),
    date: '2024-01-15',
    isVoided: false,
    isBlocked: false,
    isDeleted: false,
    data: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as Transaction;

  const mockTransactionResponse: TransactionResponseDto = {
    transaction: mockTransaction,
    evaluation: {
      triggered: false,
      events: [],
      failedRules: [],
    },
  };

  const mockTransactionsService = {
    createAndEvaluate: jest.fn(),
    findByOrganization: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionsService,
          useValue: mockTransactionsService,
        },
      ],
    }).compile();

    controller = module.get<TransactionsController>(TransactionsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create and evaluate a transaction', async () => {
      const organizationId = 'org-123';
      const createDto: CreateTransactionDto = {
        idAccount: 'acc-12345',
        type: 'CASH_IN',
        amount: 5000,
        amountNormalized: 5000,
        currency: 'USD',
        datetime: '2024-01-15T10:30:00Z',
        date: '2024-01-15',
      };

      mockTransactionsService.createAndEvaluate.mockResolvedValue(
        mockTransactionResponse,
      );

      const result = await controller.create(organizationId, createDto);

      expect(result).toEqual(mockTransactionResponse);
      expect(mockTransactionsService.createAndEvaluate).toHaveBeenCalledWith(
        organizationId,
        createDto,
        'api',
      );
    });

    it('should handle transaction with optional fields', async () => {
      const organizationId = 'org-123';
      const createDto: CreateTransactionDto = {
        idAccount: 'acc-12345',
        type: 'CASH_OUT',
        subType: 'WITHDRAWAL',
        amount: 1000,
        amountNormalized: 1000,
        currency: 'EUR',
        datetime: '2024-01-15T11:00:00Z',
        date: '2024-01-15',
        origin: 'MOBILE',
        deviceInfo: { platform: 'iOS', version: '17.0' },
        data: { channel: 'mobile' },
        country: 'US',
      };

      const responseWithOptionals = {
        ...mockTransactionResponse,
        transaction: { ...mockTransaction, ...createDto },
      };

      mockTransactionsService.createAndEvaluate.mockResolvedValue(
        responseWithOptionals,
      );

      const result = await controller.create(organizationId, createDto);

      expect(result).toEqual(responseWithOptionals);
      expect(mockTransactionsService.createAndEvaluate).toHaveBeenCalledWith(
        organizationId,
        createDto,
        'api',
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated transactions', async () => {
      const organizationId = 'org-123';
      const query: PaginationQueryDto = { page: 1, limit: 10 };
      const paginatedResult = {
        data: [mockTransaction],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockTransactionsService.findByOrganization.mockResolvedValue(
        paginatedResult,
      );

      const result = await controller.findAll(organizationId, query);

      expect(result).toEqual(paginatedResult);
      expect(mockTransactionsService.findByOrganization).toHaveBeenCalledWith(
        organizationId,
        query,
      );
    });
  });

  describe('findOne', () => {
    it('should return a transaction by id', async () => {
      const organizationId = 'org-123';
      const id = '123e4567-e89b-12d3-a456-426614174000';

      mockTransactionsService.findOne.mockResolvedValue(mockTransaction);

      const result = await controller.findOne(organizationId, id);

      expect(result).toEqual(mockTransaction);
      expect(mockTransactionsService.findOne).toHaveBeenCalledWith(
        organizationId,
        id,
      );
    });
  });
});
