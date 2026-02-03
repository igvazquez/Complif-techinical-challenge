import { Test, TestingModule } from '@nestjs/testing';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertQueryDto, UpdateAlertStatusDto } from './dto';
import { Alert, AlertStatus } from './entities/alert.entity';

describe('AlertsController', () => {
  let controller: AlertsController;

  const mockAlert: Alert = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    idOrganization: 'org-123',
    idRule: 'rule-123',
    idTransaction: 'tx-123',
    alertType: 'VELOCITY_LIMIT',
    severity: 'HIGH',
    status: AlertStatus.OPEN,
    message: 'Velocity limit exceeded',
    metadata: {},
    dedupKey: 'dedup-key-123',
    hitCount: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as Alert;

  const mockAlertsService = {
    findByOrganization: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        {
          provide: AlertsService,
          useValue: mockAlertsService,
        },
      ],
    }).compile();

    controller = module.get<AlertsController>(AlertsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated alerts', async () => {
      const organizationId = 'org-123';
      const query: AlertQueryDto = { page: 1, limit: 10 };
      const paginatedResult = {
        data: [mockAlert],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockAlertsService.findByOrganization.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(organizationId, query);

      expect(result).toEqual(paginatedResult);
      expect(mockAlertsService.findByOrganization).toHaveBeenCalledWith(
        organizationId,
        query,
      );
    });

    it('should filter by status', async () => {
      const organizationId = 'org-123';
      const query: AlertQueryDto = {
        page: 1,
        limit: 10,
        status: AlertStatus.OPEN,
      };
      const paginatedResult = {
        data: [mockAlert],
        total: 1,
        page: 1,
        limit: 10,
      };

      mockAlertsService.findByOrganization.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(organizationId, query);

      expect(result).toEqual(paginatedResult);
      expect(mockAlertsService.findByOrganization).toHaveBeenCalledWith(
        organizationId,
        query,
      );
    });
  });

  describe('findOne', () => {
    it('should return an alert by id', async () => {
      const organizationId = 'org-123';
      const id = '123e4567-e89b-12d3-a456-426614174000';

      mockAlertsService.findOne.mockResolvedValue(mockAlert);

      const result = await controller.findOne(organizationId, id);

      expect(result).toEqual(mockAlert);
      expect(mockAlertsService.findOne).toHaveBeenCalledWith(
        organizationId,
        id,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update alert status', async () => {
      const organizationId = 'org-123';
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const updateDto: UpdateAlertStatusDto = {
        status: AlertStatus.ACKNOWLEDGED,
      };
      const updatedAlert = { ...mockAlert, status: AlertStatus.ACKNOWLEDGED };

      mockAlertsService.updateStatus.mockResolvedValue(updatedAlert);

      const result = await controller.updateStatus(
        organizationId,
        id,
        updateDto,
      );

      expect(result).toEqual(updatedAlert);
      expect(mockAlertsService.updateStatus).toHaveBeenCalledWith(
        organizationId,
        id,
        updateDto,
      );
    });
  });
});
