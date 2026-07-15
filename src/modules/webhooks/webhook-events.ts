/**
 * Event names a webhook may subscribe to, composed as `{resource}.{action}`
 * from ContentChangedEvent. Kept explicit so a typo in a subscription is
 * rejected at creation instead of silently never firing.
 */
export const WEBHOOK_EVENTS = [
  'entry.published',
  'entry.unpublished',
  'entry.updated',
  'entry.deleted',
  'page.published',
  'page.unpublished',
  'page.updated',
  'page.deleted',
  'menu.created',
  'menu.updated',
  'menu.deleted',
  'setting.updated',
  'setting.deleted',
  'seo.updated',
  'seo.deleted',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
