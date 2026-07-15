export const PAGE_PUBLISHED = 'page.published';
export const PAGE_UNPUBLISHED = 'page.unpublished';

/**
 * Domain event emitted when a page is (un)published.
 * Future listeners: cache invalidation, webhooks, Next.js ISR revalidate.
 */
export class PagePublishedEvent {
  constructor(
    public readonly pageId: string,
    public readonly websiteId: string,
    public readonly slug: string,
  ) {}
}
