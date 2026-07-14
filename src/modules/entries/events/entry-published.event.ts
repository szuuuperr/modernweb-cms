export const ENTRY_PUBLISHED = 'entry.published';
export const ENTRY_UNPUBLISHED = 'entry.unpublished';

/**
 * Domain event emitted when an entry is (un)published.
 * Future listeners: cache invalidation, webhooks, Next.js ISR revalidate.
 */
export class EntryPublishedEvent {
  constructor(
    public readonly entryId: string,
    public readonly websiteId: string,
    public readonly collectionId: string,
  ) {}
}
