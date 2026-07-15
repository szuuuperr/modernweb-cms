import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_STORE } from './cache.store';
import type { CacheStore } from './cache.store';

/**
 * Read-through cache for the public Content API.
 *
 * Invalidation uses a per-website version counter baked into every key rather
 * than wildcard deletes: bumping the counter orphans a whole website's entries
 * at once, which no store has to support natively and costs a single INCR.
 * Orphaned payloads simply expire on their own TTL.
 */
@Injectable()
export class CacheService {
  private readonly ttlSeconds: number;

  constructor(
    @Inject(CACHE_STORE) private readonly store: CacheStore,
    config: ConfigService,
  ) {
    this.ttlSeconds = Number(config.get('CONTENT_CACHE_TTL', 60));
  }

  get enabled(): boolean {
    return this.ttlSeconds > 0;
  }

  async getOrSet<T>(
    websiteId: string,
    keySuffix: string,
    factory: () => Promise<T>,
  ): Promise<T> {
    if (!this.enabled) return factory();

    const key = await this.buildKey(websiteId, keySuffix);
    const hit = await this.store.get<T>(key);
    if (hit !== undefined) return hit;

    const value = await factory();
    await this.store.set(key, value, this.ttlSeconds);
    return value;
  }

  /** Drops every cached response for one website. */
  async invalidateWebsite(websiteId: string): Promise<void> {
    await this.store.increment(versionKey(websiteId));
  }

  private async buildKey(websiteId: string, suffix: string): Promise<string> {
    const version = (await this.store.get<number>(versionKey(websiteId))) ?? 0;
    return `content:${websiteId}:v${version}:${suffix}`;
  }
}

function versionKey(websiteId: string): string {
  return `cachever:${websiteId}`;
}
