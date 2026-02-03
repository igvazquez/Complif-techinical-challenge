/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';
import { makeCounterProvider, InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import {
  RULE_CACHE_INVALIDATION_EVENT,
  RuleCacheInvalidationEvent,
} from '../common/events/rule-cache.events';

export interface CachedRule {
  id: string;
  name: string;
  priority: number;
  config: Record<string, unknown>;
}

export interface CachedRules {
  rules: CachedRule[];
  cachedAt: number;
}

const CACHE_KEY_PREFIX = 'rules:engine:';
const INVALIDATION_CHANNEL = 'rules:invalidation';

export const ruleCacheHitCounterProvider = makeCounterProvider({
  name: 'rule_cache_total',
  help: 'Rule cache hits and misses',
  labelNames: ['result'],
});

@Injectable()
export class RuleCacheService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private subscriber: Redis;
  private ttlSeconds: number;
  private isConnected = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectPinoLogger(RuleCacheService.name)
    private readonly logger: PinoLogger,
    @InjectMetric('rule_cache_total')
    private readonly cacheCounter: Counter<string>,
  ) {
    const redisHost = this.configService.get<string>('redis.host', 'localhost');
    const redisPort = this.configService.get<number>('redis.port', 6379);
    this.ttlSeconds = this.configService.get<number>(
      'ruleEngine.ruleCacheTtlSeconds',
      300,
    );

    this.client = new Redis({
      host: redisHost,
      port: redisPort,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.warn('Redis connection failed, cache will be disabled');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    this.subscriber = new Redis({
      host: redisHost,
      port: redisPort,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await Promise.all([this.client.connect(), this.subscriber.connect()]);
      this.isConnected = true;
      this.logger.info('Redis connection established for rule caching');

      await this.subscriber.subscribe(INVALIDATION_CHANNEL);
      this.subscriber.on('message', (channel, message) => {
        if (channel === INVALIDATION_CHANNEL) {
          this.handleInvalidationMessage(message);
        }
      });
    } catch (error) {
      this.logger.warn(
        { error },
        'Failed to connect to Redis, cache will be disabled',
      );
      this.isConnected = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.subscriber) {
        await this.subscriber.unsubscribe(INVALIDATION_CHANNEL);
        await this.subscriber.quit();
      }
      if (this.client) {
        await this.client.quit();
      }
    } catch (error) {
      this.logger.warn({ error }, 'Error disconnecting from Redis');
    }
  }

  private handleInvalidationMessage(message: string): void {
    try {
      const { organizationId } = JSON.parse(message);
      const key = this.getCacheKey(organizationId);
      this.client.del(key).catch((err) => {
        this.logger.warn({ err, organizationId }, 'Failed to delete cache key');
      });
      this.logger.debug({ organizationId }, 'Cache invalidated via pub/sub');
    } catch (error) {
      this.logger.warn({ error }, 'Failed to parse invalidation message');
    }
  }

  private getCacheKey(organizationId: string): string {
    return `${CACHE_KEY_PREFIX}${organizationId}`;
  }

  async get(organizationId: string): Promise<CachedRules | null> {
    if (!this.isConnected) {
      this.cacheCounter.inc({ result: 'miss' });
      return null;
    }

    try {
      const key = this.getCacheKey(organizationId);
      const data = await this.client.get(key);

      if (!data) {
        this.cacheCounter.inc({ result: 'miss' });
        return null;
      }

      this.cacheCounter.inc({ result: 'hit' });
      return JSON.parse(data) as CachedRules;
    } catch (error) {
      this.logger.warn({ error, organizationId }, 'Failed to get from cache');
      this.cacheCounter.inc({ result: 'miss' });
      return null;
    }
  }

  async set(organizationId: string, rules: CachedRules): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const key = this.getCacheKey(organizationId);
      const data = JSON.stringify(rules);
      await this.client.setex(key, this.ttlSeconds, data);
      this.logger.debug(
        { organizationId, ruleCount: rules.rules.length },
        'Rules cached',
      );
    } catch (error) {
      this.logger.warn({ error, organizationId }, 'Failed to set cache');
    }
  }

  async invalidate(organizationId: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const key = this.getCacheKey(organizationId);
      await this.client.del(key);

      // Publish invalidation to other instances
      await this.client.publish(
        INVALIDATION_CHANNEL,
        JSON.stringify({ organizationId }),
      );

      this.logger.debug({ organizationId }, 'Cache invalidated');
    } catch (error) {
      this.logger.warn({ error, organizationId }, 'Failed to invalidate cache');
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }

  @OnEvent(RULE_CACHE_INVALIDATION_EVENT)
  async handleCacheInvalidation(
    event: RuleCacheInvalidationEvent,
  ): Promise<void> {
    await this.invalidate(event.organizationId);
  }
}
