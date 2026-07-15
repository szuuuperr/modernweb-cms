import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MAILER_ADAPTER } from '../../../infrastructure/mailer/mailer.adapter';
import type { MailerAdapter } from '../../../infrastructure/mailer/mailer.adapter';
import { FORM_SUBMITTED, FormSubmittedEvent } from './form-submitted.event';

/**
 * Sends the notification off the request path: EventEmitter2 does not await
 * handlers, so a slow or broken SMTP server never delays (or fails) the
 * visitor's submission — the row is already stored either way.
 */
@Injectable()
export class FormNotificationListener {
  private readonly logger = new Logger(FormNotificationListener.name);

  constructor(@Inject(MAILER_ADAPTER) private readonly mailer: MailerAdapter) {}

  @OnEvent(FORM_SUBMITTED)
  async onSubmitted(event: FormSubmittedEvent) {
    if (event.notifyEmails.length === 0) return;

    try {
      await this.mailer.send({
        to: event.notifyEmails,
        subject: `[${event.formName}] submission baru`,
        text: renderText(event),
        html: renderHtml(event),
      });
    } catch (error) {
      // The submission is already safe in the database; log and move on.
      this.logger.error(
        `Failed to send notification for submission ${event.submissionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function renderText(event: FormSubmittedEvent): string {
  const lines = Object.entries(event.data).map(
    ([key, value]) => `${key}: ${format(value)}`,
  );
  return [`Form: ${event.formName}`, '', ...lines].join('\n');
}

function renderHtml(event: FormSubmittedEvent): string {
  const rows = Object.entries(event.data)
    .map(
      ([key, value]) =>
        `<tr><td><strong>${escapeHtml(key)}</strong></td><td>${escapeHtml(
          format(value),
        )}</td></tr>`,
    )
    .join('');
  return `<p>Form: <strong>${escapeHtml(event.formName)}</strong></p><table>${rows}</table>`;
}

function format(value: unknown): string {
  return typeof value === 'object' && value !== null
    ? JSON.stringify(value)
    : String(value);
}

/** Submitted values are attacker-controlled; never interpolate them raw. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
