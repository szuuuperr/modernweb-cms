import { AsyncLocalStorage } from 'async_hooks';

/** Who is behind the current request, for audit logging. */
export interface RequestContext {
  userId?: string;
  userEmail?: string;
  /** Set instead of userId when the caller authenticated with an API key. */
  apiKeyId?: string;
  ip?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Request-scoped context, so domain services can record *who* acted without
 * every method signature growing an `actor` parameter.
 *
 * Reads return undefined outside a request (seed scripts, cron, tests) — that
 * is expected, and callers must treat a missing actor as "system".
 */
export const RequestContextStore = {
  run<T>(context: RequestContext, fn: () => T): T {
    return storage.run(context, fn);
  },

  get(): RequestContext | undefined {
    return storage.getStore();
  },

  /** Convenience for the common case. */
  actorId(): string | undefined {
    return storage.getStore()?.userId;
  },
};
