/**
 * Adapter pattern, same shape as StorageAdapter: CacheService depends only on
 * this contract, so Redis stays optional and dev/test can run in-memory.
 */
export interface CacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  /** Atomic increment, used for the per-website cache version counter. */
  increment(key: string): Promise<number>;
  reset(): Promise<void>;
}

export const CACHE_STORE = Symbol('CACHE_STORE');
