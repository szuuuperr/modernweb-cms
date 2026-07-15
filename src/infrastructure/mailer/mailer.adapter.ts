/**
 * Adapter pattern, same shape as StorageAdapter and CacheStore: callers depend
 * only on this contract, so an API provider (Resend/SES) can be added later
 * without touching the modules that send mail.
 */
export interface OutgoingMail {
  to: string[];
  subject: string;
  text: string;
  html?: string;
}

export interface MailerAdapter {
  send(mail: OutgoingMail): Promise<void>;
  /** False when no transport is configured; callers skip sending instead of failing. */
  readonly enabled: boolean;
}

export const MAILER_ADAPTER = Symbol('MAILER_ADAPTER');
