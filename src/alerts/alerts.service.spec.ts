/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getLoggerToken } from 'nestjs-pino';
import { AlertsService } from './alerts.service';
import {
  Alert,
  AlertSeverity,
  AlertCategory,
  AlertStatus,
} from './entities/alert.entity';
import { AlertEventMessage } from './dto';
import {
  DbActionHandler,
  WebhookActionHandler,
  QueueActionHandler,
  BlockActionHandler,
} from './actions';

describe('AlertsService', () => {
  let service: AlertsService;
  let repository: jest.Mocked<Repository<Alert>>;

  const mockLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockCounter = {
    inc: jest.fn(),
  };

  const mockHistogram = {
    observe: jest.fn(),
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        {
          provide: getRepositoryToken(Alert),
          useValue: mockRepository,
        },
        {
          provide: getLoggerToken(AlertsService.name),
          useValue: mockLogger,
        },
        {
          provide: 'PROM_METRIC_ALERTS_CREATED_TOTAL',
          useValue: mockCounter,
        },
        {
          provide: 'PROM_METRIC_ALERTS_DEDUPLICATED_TOTAL',
          useValue: mockCounter,
        },
        {
          provide: 'PROM_METRIC_ALERT_ACTION_DURATION_SECONDS',
          useValue: mockHistogram,
        },
        DbActionHandler,
        WebhookActionHandler,
        QueueActionHandler,
        BlockActionHandler,
        {
          provide: getLoggerToken(DbActionHandler.name),
          useValue: mockLogger,
        },
        {
          provide: getLoggerToken(WebhookActionHandler.name),
          useValue: mockLogger,
        },
        {
          provide: getLoggerToken(QueueActionHandler.name),
          useValue: mockLogger,
        },
        {
          provide: getLoggerToken(BlockActionHandler.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    repository = module.get(getRepositoryToken(Alert));

    jest.clearAllMocks();
  });

  describe('processAlertEvent', () => {
    const baseEvent: AlertEventMessage = {
      organizationId: 'org-123',
      transactionId: 'tx-456',
      accountId: 'acc-789',
      ruleId: 'rule-001',
      ruleName: 'High Value Transaction',
      severity: 'HIGH',
      category: 'FRAUD',
      eventType: 'high-value-alert',
      eventParams: { threshold: 10000 },
      transactionDatetime: '2024-01-15T10:30:00.000Z',
      ruleConfig: { timeWindow: '24h' },
    };

    it('should create a new alert when no existing alert found', async () => {
      const mockAlert: Partial<Alert> = {
        id: 'alert-001',
        idOrganization: 'org-123',
        idRule: 'rule-001',
        idTransaction: 'tx-456',
        idAccount: 'acc-789',
        severity: AlertSeverity.HIGH,
        category: AlertCategory.FRAUD,
        status: AlertStatus.OPEN,
        hitCount: 1,
        firstTriggeredAt: new Date(),
        lastTriggeredAt: new Date(),
        dedupKey: 'rule-001:acc-789:2024-01-15',
        metadata: {},
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockAlert as Alert);
      repository.save.mockResolvedValue(mockAlert as Alert);

      const result = await service.processAlertEvent(baseEvent);

      expect(repository.findOne).toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(mockCounter.inc).toHaveBeenCalledWith({
        organization_id: 'org-123',
        severity: 'HIGH',
        category: 'FRAUD',
      });
    });

    it('should deduplicate when existing alert found', async () => {
      const existingAlert: Partial<Alert> = {
        id: 'alert-001',
        idOrganization: 'org-123',
        idRule: 'rule-001',
        idTransaction: 'tx-456',
        idAccount: 'acc-789',
        severity: AlertSeverity.HIGH,
        category: AlertCategory.FRAUD,
        status: AlertStatus.OPEN,
        hitCount: 1,
        firstTriggeredAt: new Date('2024-01-15T09:00:00.000Z'),
        lastTriggeredAt: new Date('2024-01-15T09:00:00.000Z'),
        dedupKey: 'rule-001:acc-789:2024-01-15',
        metadata: {},
      };

      repository.findOne.mockResolvedValue(existingAlert as Alert);
      repository.save.mockImplementation((alert) =>
        Promise.resolve(alert as Alert),
      );

      const result = await service.processAlertEvent(baseEvent);

      expect(repository.findOne).toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
      expect(result.hitCount).toBe(2);
      expect(mockCounter.inc).toHaveBeenCalledWith({
        organization_id: 'org-123',
      });
    });

    it('should parse severity correctly', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockImplementation((data) => data as Alert);
      repository.save.mockImplementation((alert) =>
        Promise.resolve({ ...alert, id: 'alert-001' } as Alert),
      );

      await service.processAlertEvent({
        ...baseEvent,
        severity: 'CRITICAL',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: AlertSeverity.CRITICAL,
        }),
      );
    });

    it('should default to MEDIUM severity for invalid values', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockImplementation((data) => data as Alert);
      repository.save.mockImplementation((alert) =>
        Promise.resolve({ ...alert, id: 'alert-001' } as Alert),
      );

      await service.processAlertEvent({
        ...baseEvent,
        severity: 'INVALID',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: AlertSeverity.MEDIUM,
        }),
      );
    });

    it('should parse category correctly', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockImplementation((data) => data as Alert);
      repository.save.mockImplementation((alert) =>
        Promise.resolve({ ...alert, id: 'alert-001' } as Alert),
      );

      await service.processAlertEvent({
        ...baseEvent,
        category: 'AML',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: AlertCategory.AML,
        }),
      );
    });

    it('should default to UNKNOWN category for invalid values', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockImplementation((data) => data as Alert);
      repository.save.mockImplementation((alert) =>
        Promise.resolve({ ...alert, id: 'alert-001' } as Alert),
      );

      await service.processAlertEvent({
        ...baseEvent,
        category: 'INVALID',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: AlertCategory.UNKNOWN,
        }),
      );
    });

    it('should execute action handlers', async () => {
      const mockAlert: Partial<Alert> = {
        id: 'alert-001',
        idOrganization: 'org-123',
        idRule: 'rule-001',
        hitCount: 1,
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockAlert as Alert);
      repository.save.mockResolvedValue(mockAlert as Alert);

      // Should not throw when processing with real action handlers
      await expect(service.processAlertEvent(baseEvent)).resolves.toBeDefined();
    });
  });

  describe('findByOrganization', () => {
    it('should return paginated alerts', async () => {
      const mockAlerts = [
        { id: 'alert-1' } as Alert,
        { id: 'alert-2' } as Alert,
      ];

      repository.findAndCount.mockResolvedValue([mockAlerts, 2]);

      const result = await service.findByOrganization('org-123', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should apply filters', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByOrganization('org-123', {
        status: AlertStatus.OPEN,
        severity: AlertSeverity.HIGH,
        category: AlertCategory.FRAUD,
        ruleId: 'rule-001',
        page: 1,
        limit: 10,
      });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            idOrganization: 'org-123',
            status: AlertStatus.OPEN,
            severity: AlertSeverity.HIGH,
            category: AlertCategory.FRAUD,
            idRule: 'rule-001',
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return alert by id', async () => {
      const mockAlert = {
        id: 'alert-001',
        idOrganization: 'org-123',
      } as Alert;

      repository.findOne.mockResolvedValue(mockAlert);

      const result = await service.findOne('org-123', 'alert-001');

      expect(result).toBe(mockAlert);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'alert-001', idOrganization: 'org-123' },
        relations: ['rule', 'transaction'],
      });
    });

    it('should throw NotFoundException when alert not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('org-123', 'alert-001')).rejects.toThrow(
        'Alert with ID "alert-001" not found',
      );
    });
  });

  describe('updateStatus', () => {
    it('should update alert status', async () => {
      const mockAlert = {
        id: 'alert-001',
        idOrganization: 'org-123',
        status: AlertStatus.OPEN,
      } as Alert;

      repository.findOne.mockResolvedValue(mockAlert);
      repository.save.mockImplementation((alert) =>
        Promise.resolve(alert as Alert),
      );

      const result = await service.updateStatus('org-123', 'alert-001', {
        status: AlertStatus.ACKNOWLEDGED,
      });

      expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('deduplication window calculation', () => {
    it('should handle 24h time window', async () => {
      const event: AlertEventMessage = {
        organizationId: 'org-123',
        transactionId: 'tx-456',
        accountId: 'acc-789',
        ruleId: 'rule-001',
        ruleName: 'Test Rule',
        severity: 'MEDIUM',
        category: 'FRAUD',
        eventType: 'test',
        eventParams: {},
        transactionDatetime: '2024-01-15T10:30:00.000Z',
        ruleConfig: { timeWindow: '24h' },
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockImplementation((data) => data as Alert);
      repository.save.mockImplementation((alert) =>
        Promise.resolve({ ...alert, id: 'alert-001' } as Alert),
      );

      await service.processAlertEvent(event);

      // Verify the dedup key includes a time-based component
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dedupKey: expect.stringContaining('rule-001:acc-789:'),
        }),
      );
    });

    it('should handle null accountId', async () => {
      const event: AlertEventMessage = {
        organizationId: 'org-123',
        transactionId: 'tx-456',
        accountId: null,
        ruleId: 'rule-001',
        ruleName: 'Test Rule',
        severity: 'MEDIUM',
        category: 'FRAUD',
        eventType: 'test',
        eventParams: {},
        transactionDatetime: '2024-01-15T10:30:00.000Z',
        ruleConfig: { timeWindow: '24h' },
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockImplementation((data) => data as Alert);
      repository.save.mockImplementation((alert) =>
        Promise.resolve({ ...alert, id: 'alert-001' } as Alert),
      );

      await service.processAlertEvent(event);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dedupKey: expect.stringContaining('rule-001:no-account:'),
        }),
      );
    });
  });
});
