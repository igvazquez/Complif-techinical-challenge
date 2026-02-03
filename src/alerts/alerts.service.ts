import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  makeCounterProvider,
  makeHistogramProvider,
  InjectMetric,
} from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import {
  Alert,
  AlertSeverity,
  AlertCategory,
  AlertStatus,
} from './entities/alert.entity';
import { AlertEventMessage, AlertQueryDto, UpdateAlertStatusDto } from './dto';
import { PaginatedResult } from '../common/interfaces';
import {
  DbActionHandler,
  WebhookActionHandler,
  QueueActionHandler,
  BlockActionHandler,
  AlertActionHandler,
} from './actions';

export const alertsCreatedCounterProvider = makeCounterProvider({
  name: 'alerts_created_total',
  help: 'Total number of alerts created',
  labelNames: ['organization_id', 'severity', 'category'],
});

export const alertsDeduplicatedCounterProvider = makeCounterProvider({
  name: 'alerts_deduplicated_total',
  help: 'Total number of deduplicated alerts (hit count incremented)',
  labelNames: ['organization_id'],
});

export const alertActionDurationHistogramProvider = makeHistogramProvider({
  name: 'alert_action_duration_seconds',
  help: 'Duration of alert action execution in seconds',
  labelNames: ['action_type', 'status'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

@Injectable()
export class AlertsService {
  private readonly actionHandlers: AlertActionHandler[];

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    @InjectPinoLogger(AlertsService.name)
    private readonly logger: PinoLogger,
    @InjectMetric('alerts_created_total')
    private readonly alertsCreated: Counter<string>,
    @InjectMetric('alerts_deduplicated_total')
    private readonly alertsDeduplicated: Counter<string>,
    @InjectMetric('alert_action_duration_seconds')
    private readonly actionDuration: Histogram<string>,
    private readonly dbActionHandler: DbActionHandler,
    private readonly webhookActionHandler: WebhookActionHandler,
    private readonly queueActionHandler: QueueActionHandler,
    private readonly blockActionHandler: BlockActionHandler,
  ) {
    this.actionHandlers = [
      this.dbActionHandler,
      this.webhookActionHandler,
      this.queueActionHandler,
      this.blockActionHandler,
    ];
  }

  async processAlertEvent(event: AlertEventMessage): Promise<Alert> {
    const dedupKey = this.calculateDedupKey(event);
    const severity = this.parseSeverity(event.severity);
    const category = this.parseCategory(event.category);

    // Find existing open/acknowledged alert with same dedup key
    const existingAlert = await this.alertRepository.findOne({
      where: {
        dedupKey,
        status: In([AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED]),
      },
    });

    let alert: Alert;
    let isNewAlert: boolean;

    if (existingAlert) {
      // Deduplicate: increment hit count and update last triggered
      existingAlert.hitCount += 1;
      existingAlert.lastTriggeredAt = new Date();
      alert = await this.alertRepository.save(existingAlert);
      isNewAlert = false;

      this.alertsDeduplicated.inc({
        organization_id: event.organizationId,
      });

      this.logger.debug(
        {
          alertId: alert.id,
          dedupKey,
          hitCount: alert.hitCount,
        },
        'Alert deduplicated',
      );
    } else {
      // Create new alert
      const now = new Date();
      const newAlert = this.alertRepository.create({
        idOrganization: event.organizationId,
        idRule: event.ruleId,
        idTransaction: event.transactionId,
        idAccount: event.accountId,
        severity,
        category,
        status: AlertStatus.OPEN,
        hitCount: 1,
        firstTriggeredAt: now,
        lastTriggeredAt: now,
        dedupKey,
        metadata: {
          ruleName: event.ruleName,
          eventType: event.eventType,
          eventParams: event.eventParams,
        },
      });

      alert = await this.alertRepository.save(newAlert);
      isNewAlert = true;

      this.alertsCreated.inc({
        organization_id: event.organizationId,
        severity: severity,
        category: category,
      });

      this.logger.info(
        {
          alertId: alert.id,
          ruleId: event.ruleId,
          severity,
          category,
          dedupKey,
        },
        'Alert created',
      );
    }

    // Execute action handlers
    await this.executeActionHandlers(alert, event, isNewAlert);

    return alert;
  }

  private async executeActionHandlers(
    alert: Alert,
    event: AlertEventMessage,
    isNewAlert: boolean,
  ): Promise<void> {
    for (const handler of this.actionHandlers) {
      if (!handler.shouldExecute(event)) {
        continue;
      }

      const startTime = process.hrtime.bigint();
      let status = 'success';

      try {
        const result = await handler.execute(alert, event, isNewAlert);
        if (!result.success) {
          status = 'error';
          this.logger.warn(
            {
              actionType: handler.actionType,
              alertId: alert.id,
              error: result.error,
            },
            'Action handler failed',
          );
        }
      } catch (error: unknown) {
        status = 'error';
        const errorObj =
          error instanceof Error ? error : new Error('Unknown error');
        this.logger.error(
          {
            err: errorObj,
            actionType: handler.actionType,
            alertId: alert.id,
          },
          'Action handler threw exception',
        );
      } finally {
        const endTime = process.hrtime.bigint();
        const durationSeconds = Number(endTime - startTime) / 1_000_000_000;
        this.actionDuration.observe(
          { action_type: handler.actionType, status },
          durationSeconds,
        );
      }
    }
  }

  private calculateDedupKey(event: AlertEventMessage): string {
    const windowKey = this.calculateWindowKey(event);
    return `${event.ruleId}:${event.accountId || 'no-account'}:${windowKey}`;
  }

  private calculateWindowKey(event: AlertEventMessage): string {
    const transactionDate = new Date(event.transactionDatetime);
    const timeWindow = (event.ruleConfig?.timeWindow as string) || '24h';

    // Parse time window (e.g., "24h", "7d", "1h")
    const match = timeWindow.match(/^(\d+)([hdwm])$/i);
    if (!match) {
      // Default to daily bucket if invalid format
      return this.formatDateKey(transactionDate, 'day');
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'h': {
        // Hourly buckets - floor to nearest N hours
        const hours = transactionDate.getUTCHours();
        const bucketHour = Math.floor(hours / value) * value;
        const bucketDate = new Date(transactionDate);
        bucketDate.setUTCHours(bucketHour, 0, 0, 0);
        return bucketDate.toISOString();
      }
      case 'd': {
        // Daily buckets - floor to nearest N days
        const startOfYear = new Date(
          Date.UTC(transactionDate.getUTCFullYear(), 0, 1),
        );
        const dayOfYear = Math.floor(
          (transactionDate.getTime() - startOfYear.getTime()) /
            (24 * 60 * 60 * 1000),
        );
        const bucketDay = Math.floor(dayOfYear / value) * value;
        const bucketDate = new Date(startOfYear);
        bucketDate.setUTCDate(bucketDate.getUTCDate() + bucketDay);
        return this.formatDateKey(bucketDate, 'day');
      }
      case 'w': {
        // Weekly buckets
        const startOfYear = new Date(
          Date.UTC(transactionDate.getUTCFullYear(), 0, 1),
        );
        const weekOfYear = Math.floor(
          (transactionDate.getTime() - startOfYear.getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        );
        const bucketWeek = Math.floor(weekOfYear / value) * value;
        const bucketDate = new Date(startOfYear);
        bucketDate.setUTCDate(bucketDate.getUTCDate() + bucketWeek * 7);
        return this.formatDateKey(bucketDate, 'week');
      }
      case 'm': {
        // Monthly buckets
        const bucketMonth =
          Math.floor(transactionDate.getUTCMonth() / value) * value;
        return `${transactionDate.getUTCFullYear()}-${String(bucketMonth + 1).padStart(2, '0')}`;
      }
      default:
        return this.formatDateKey(transactionDate, 'day');
    }
  }

  private formatDateKey(date: Date, type: 'day' | 'week'): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return type === 'week'
      ? `${year}-W${this.getWeekNumber(date)}`
      : `${year}-${month}-${day}`;
  }

  private getWeekNumber(date: Date): string {
    const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(
      ((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000) + 1) /
        7,
    );
    return String(weekNumber).padStart(2, '0');
  }

  private parseSeverity(severity: string): AlertSeverity {
    const upper = severity?.toUpperCase();
    if (Object.values(AlertSeverity).includes(upper as AlertSeverity)) {
      return upper as AlertSeverity;
    }
    return AlertSeverity.MEDIUM;
  }

  private parseCategory(category: string): AlertCategory {
    const upper = category?.toUpperCase();
    if (Object.values(AlertCategory).includes(upper as AlertCategory)) {
      return upper as AlertCategory;
    }
    return AlertCategory.UNKNOWN;
  }

  async findByOrganization(
    organizationId: string,
    query: AlertQueryDto,
  ): Promise<PaginatedResult<Alert>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { idOrganization: organizationId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.ruleId) {
      where.idRule = query.ruleId;
    }

    const [data, total] = await this.alertRepository.findAndCount({
      where,
      order: { lastTriggeredAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(organizationId: string, id: string): Promise<Alert> {
    const alert = await this.alertRepository.findOne({
      where: { id, idOrganization: organizationId },
      relations: ['rule', 'transaction'],
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID "${id}" not found`);
    }

    return alert;
  }

  async updateStatus(
    organizationId: string,
    id: string,
    updateDto: UpdateAlertStatusDto,
  ): Promise<Alert> {
    const alert = await this.findOne(organizationId, id);
    alert.status = updateDto.status;
    return this.alertRepository.save(alert);
  }
}
