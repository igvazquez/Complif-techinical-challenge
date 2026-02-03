import { Test, TestingModule } from '@nestjs/testing';
import { RmqContext } from '@nestjs/microservices';
import { TransactionsConsumer } from './transactions.consumer';
import { TransactionsService } from './transactions.service';
import { getLoggerToken } from 'nestjs-pino';
import { CreateTransactionDto } from './dto';

describe('TransactionsConsumer', () => {
  let consumer: TransactionsConsumer;

  const mockTransactionsService = {
    createAndEvaluate: jest.fn(),
  };

  const mockLogger = {
    debug: jest.fn(),
    error: jest.fn(),
  };

  const mockChannel = {
    ack: jest.fn(),
  };

  const mockMessage = { content: 'test' };

  const mockContext = {
    getChannelRef: jest.fn().mockReturnValue(mockChannel),
    getMessage: jest.fn().mockReturnValue(mockMessage),
  } as unknown as RmqContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsConsumer],
      providers: [
        {
          provide: TransactionsService,
          useValue: mockTransactionsService,
        },
        {
          provide: getLoggerToken(TransactionsConsumer.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    consumer = module.get<TransactionsConsumer>(TransactionsConsumer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(consumer).toBeDefined();
  });

  describe('handleTransaction', () => {
    const transactionDto: CreateTransactionDto = {
      idAccount: 'acc-12345',
      type: 'CASH_IN',
      amount: 5000,
      amountNormalized: 5000,
      currency: 'USD',
      datetime: '2024-01-15T10:30:00Z',
      date: '2024-01-15',
    };

    const messageData = {
      organizationId: 'org-123',
      transaction: transactionDto,
    };

    it('should process transaction successfully', async () => {
      mockTransactionsService.createAndEvaluate.mockResolvedValue({});

      await consumer.handleTransaction(messageData, mockContext);

      expect(mockTransactionsService.createAndEvaluate).toHaveBeenCalledWith(
        'org-123',
        transactionDto,
        'queue',
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    it('should log error and acknowledge on failure', async () => {
      const error = new Error('Processing failed');
      mockTransactionsService.createAndEvaluate.mockRejectedValue(error);

      await consumer.handleTransaction(messageData, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: error,
          organizationId: 'org-123',
        }),
        expect.any(String),
      );
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    it('should always acknowledge message even on error', async () => {
      mockTransactionsService.createAndEvaluate.mockRejectedValue(
        new Error('Test error'),
      );

      await consumer.handleTransaction(messageData, mockContext);

      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });
  });
});
