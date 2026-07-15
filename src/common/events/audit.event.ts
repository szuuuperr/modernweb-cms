import { RequestContextStore } from '../context/request-context';

export const AUDIT_ACTION = 'audit.action';

/**
 * Security- and admin-relevant actions that are not content mutations, so they
 * do not belong on `content.changed` (which drives cache invalidation and
 * webhooks — an API key rotation must not dump a website's cache).
 *
 * Content mutations are audited from `content.changed` instead.
 */
export class AuditEvent {
  public readonly actorId: string | null;

  constructor(
    /** Null for platform-level actions that are not scoped to one website. */
    public readonly websiteId: string | null,
    public readonly resource: string,
    public readonly action: string,
    public readonly targetId?: string,
    /** Small, non-sensitive extras. Never put secrets in here. */
    public readonly meta?: Record<string, unknown>,
  ) {
    this.actorId = RequestContextStore.actorId() ?? null;
  }

  get name(): string {
    return `${this.resource}.${this.action}`;
  }
}
