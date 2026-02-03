import { Test, TestingModule } from '@nestjs/testing';
import { RmqContext } from '@nestjs/microservices';
import { AlertsConsumer } from './alerts.consumer';
import { AlertsService } from './alerts.service';
import { getLoggerToken } from 'nestjs-pino';
import type { AlertEventMessage } from './dto';

describe('AlertsConsumer', () => {
  let consumer: AlertsConsumer;

  const mockAlertsService = {
    processAlertEvent: jest.fn(),
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
      controllers: [AlertsConsumer],
      providers: [
        {
          provide: AlertsService,
          useValue: mockAlertsService,
        },
        {
          provide: getLoggerToken(AlertsConsumer.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    consumer = module.get<AlertsConsumer>(AlertsConsumer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(consumer).toBeDefined();
  });

  describe('handleAlertEvent', () => {
    const alertEventMessage: AlertEventMessage = {
      organizationId: 'org-123',
      ruleId: 'rule-123',
      transactionId: 'tx-123',
      alertType: 'HIGH_VALUE',
      severity: 'HIGH',
      message: 'High value transaction detected',
      params: {},
    };

    it('should process alert event successfully', async () => {
      mockAlertsService.processAlertEvent.mockResolvedValue({});

      await consumer.handleAlertEvent(alertEventMessage, mockContext);

      expect(mockAlertsService.processAlertEvent).toHaveBeenCalledWith(
        alertEventMessage,
      );
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    it('should log error and acknowledge on failure', async () => {
      const error = new Error('Processing failed');
      mockAlertsService.processAlertEvent.mockRejectedValue(error);

      await consumer.handleAlertEvent(alertEventMessage, mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: error,
          organizationId: 'org-123',
          ruleId: 'rule-123',
          transactionId: 'tx-123',
        }),
        expect.any(String),
      );
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    it('should always acknowledge message even on error', async () => {
      mockAlertsService.processAlertEvent.mockRejectedValue(
        new Error('Test error'),
      );

      await consumer.handleAlertEvent(alertEventMessage, mockContext);

      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });
  });
});
