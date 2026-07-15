import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { MailerAdapter, OutgoingMail } from './mailer.adapter';

/**
 * SMTP works with anything (Mailtrap in dev, SES/Gmail/a provider in prod), so
 * one implementation covers every case without a vendor SDK.
 *
 * With no SMTP_HOST configured the adapter stays disabled and logs instead of
 * sending — a missing mail transport must never break form submissions.
 */
@Injectable()
export class SmtpMailerAdapter implements MailerAdapter {
  private readonly logger = new Logger(SmtpMailerAdapter.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const from = config.get<string>('SMTP_FROM');

    if (!host) {
      this.transporter = null;
      this.from = '';
      this.logger.warn(
        'SMTP_HOST not set — form notifications will be logged, not sent',
      );
      return;
    }

    // No default sender on purpose. A hardcoded fallback would send from a
    // domain nobody here controls, so SPF/DKIM would fail and the mail would
    // land in spam — a failure nobody notices. Better to refuse to start.
    if (!from) {
      throw new Error(
        'SMTP_HOST is set but SMTP_FROM is empty — set a sender address on a domain you control (and give it SPF/DKIM records).',
      );
    }
    this.from = from;

    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASSWORD');
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(config.get('SMTP_PORT', 587)),
      // Implicit TLS on 465; STARTTLS everywhere else.
      secure: Number(config.get('SMTP_PORT', 587)) === 465,
      auth: user ? { user, pass } : undefined,
    });
  }

  get enabled(): boolean {
    return this.transporter !== null;
  }

  async send(mail: OutgoingMail): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[mail disabled] would send "${mail.subject}" to ${mail.to.join(', ')}`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to: mail.to.join(', '),
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  }
}
