import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheStore } from './cache.store';

/**
 * Redis-backed store for production, where several app instances must share
 * one cache. A cache is not a source of truth, so every failure here is
 * swallowed and degrades to a miss rather than failing the request.
 */
@Injectable()
export class RedisCacheStore implements CacheStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheStore.name);
  private readonly redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      // Without this, ioredis queues commands while the connection is down and
      // they only settle once it reconnects — which stalls the request instead
      // of degrading to a miss. Measured: 2 of 5 reads hung past 10s.
      enableOfflineQueue: false,
      // Bounds a connected-but-unresponsive Redis too.
      commandTimeout: 500,
      // Never let a cache outage stall the event loop with retries.
      retryStrategy: (times) => Math.min(times * 200, 2_000),
    });
    this.redis.on('error', (error: Error) => {
      this.logger.warn(`Redis unavailable, serving uncached: ${error.message}`);
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // A failed write just means the next read misses.
    }
  }

  async increment(key: string): Promise<number> {
    try {
      return await this.redis.incr(key);
    } catch {
      // Returning 0 keeps callers working; it only costs a cache miss.
      return 0;
    }
  }

  async reset(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch {
      /* ignore */
    }
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }
}
