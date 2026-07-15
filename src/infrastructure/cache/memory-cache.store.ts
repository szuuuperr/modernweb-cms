import { Injectable } from '@nestjs/common';
import { CacheStore } from './cache.store';

interface Entry {
  value: unknown;
  expiresAt: number;
}

/**
 * Fallback store used when REDIS_URL is unset. Process-local, so it is only
 * correct for a single instance — which is exactly the dev/test case.
 * Expired keys are dropped lazily on read and swept periodically.
 */
@Injectable()
export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, Entry>();

  constructor() {
    // Without a sweep, keys that are never read again would leak.
    const timer = setInterval(() => this.sweep(), 60_000);
    timer.unref();
  }

  get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return Promise.resolve(undefined);
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(entry.value as T);
  }

  set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return Promise.resolve();
  }

  increment(key: string): Promise<number> {
    const current = this.entries.get(key);
    const alive = current && current.expiresAt > Date.now();
    const next = (alive ? Number(current.value) : 0) + 1;
    // Version counters must outlive cached payloads, hence the long TTL.
    this.entries.set(key, { value: next, expiresAt: Date.now() + 86_400_000 });
    return Promise.resolve(next);
  }

  reset(): Promise<void> {
    this.entries.clear();
    return Promise.resolve();
  }

  private sweep() {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
