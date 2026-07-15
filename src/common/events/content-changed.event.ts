import { RequestContextStore } from '../context/request-context';

export const CONTENT_CHANGED = 'content.changed';

export type ContentResource = 'entry' | 'page' | 'menu' | 'setting' | 'seo';
export type ContentAction =
  'created' | 'updated' | 'deleted' | 'published' | 'unpublished';

/**
 * Emitted by every service that mutates publicly visible content.
 *
 * One generic event rather than one per resource, because both consumers care
 * about the same thing — "something on this website changed": the cache drops
 * the website's entries, and the webhook dispatcher composes the subscription
 * name as `{resource}.{action}` (e.g. "entry.published").
 */
export class ContentChangedEvent {
  /**
   * Who triggered this, captured from the request context at construction
   * rather than passed in: the event is always built synchronously inside the
   * request, and this way no emitter can forget to supply it.
   * Null when there is no request (seed, cron).
   */
  public readonly actorId: string | null;

  constructor(
    public readonly websiteId: string,
    public readonly resource: ContentResource,
    public readonly action: ContentAction,
    public readonly id?: string,
  ) {
    this.actorId = RequestContextStore.actorId() ?? null;
  }

  /** Webhook subscription name, e.g. "entry.published". */
  get name(): string {
    return `${this.resource}.${this.action}`;
  }
}
