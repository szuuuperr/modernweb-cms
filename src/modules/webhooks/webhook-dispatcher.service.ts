import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createHmac } from 'crypto';
import {
  CONTENT_CHANGED,
  ContentChangedEvent,
} from '../../common/events/content-changed.event';
import { Webhook, WebhookDeliveryStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { WebhooksService } from './webhooks.service';

export const SIGNATURE_HEADER = 'x-mwc-signature';
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1_000, 5_000, 25_000];
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * The index signature is what makes this directly assignable to Prisma's Json
 * input, so storing it needs no type assertion (which `lint --fix` strips).
 * It is honest too: the payload really is a flat map of strings.
 */
interface WebhookPayload {
  [key: string]: string | undefined;
  event: string;
  websiteId: string;
  resource: string;
  action: string;
  id?: string;
  timestamp: string;
}

/**
 * Delivers content events to subscribed receivers (typically a Next.js ISR
 * revalidate route).
 *
 * Runs in-process and detached: EventEmitter2 does not await handlers, so a
 * slow or dead receiver never delays the API request that triggered it. Every
 * attempt is recorded, because a webhook that quietly stops working is worse
 * than one that visibly fails.
 */
@Injectable()
export class WebhookDispatcher {
  private readonly logger = new Logger(WebhookDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
  ) {}

  @OnEvent(CONTENT_CHANGED)
  async onContentChanged(event: ContentChangedEvent) {
    try {
      const subscribers = await this.webhooks.findSubscribers(
        event.websiteId,
        event.name,
      );
      if (subscribers.length === 0) return;

      const payload: WebhookPayload = {
        event: event.name,
        websiteId: event.websiteId,
        resource: event.resource,
        action: event.action,
        id: event.id,
        timestamp: new Date().toISOString(),
      };
      await Promise.all(
        subscribers.map((webhook) => this.deliver(webhook, payload)),
      );
    } catch (error) {
      // Never let webhook problems surface as an unhandled rejection.
      this.logger.error(
        `Webhook dispatch failed for ${event.name}: ${asMessage(error)}`,
      );
    }
  }

  private async deliver(webhook: Webhook, payload: WebhookPayload) {
    const body = JSON.stringify(payload);
    const signature = sign(body, webhook.secret);

    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: payload.event,
        payload: payload,
      },
      select: { id: true },
    });

    let lastError = '';
    let responseStatus: number | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [SIGNATURE_HEADER]: signature,
            'x-mwc-event': payload.event,
          },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        responseStatus = response.status;

        if (response.ok) {
          await this.finish(delivery.id, {
            status: WebhookDeliveryStatus.SUCCESS,
            attempts: attempt,
            responseStatus,
            deliveredAt: new Date(),
          });
          return;
        }
        lastError = `HTTP ${response.status}`;

        // 4xx (except 429) means the receiver rejected it; retrying won't help.
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          break;
        }
      } catch (error) {
        lastError = asMessage(error);
      }

      if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS[attempt - 1]);
    }

    await this.finish(delivery.id, {
      status: WebhookDeliveryStatus.FAILED,
      attempts: MAX_ATTEMPTS,
      responseStatus,
      lastError: lastError.slice(0, 1000),
    });
    this.logger.warn(
      `Webhook ${webhook.name} failed after retries: ${lastError}`,
    );
  }

  private async finish(
    deliveryId: string,
    data: {
      status: WebhookDeliveryStatus;
      attempts: number;
      responseStatus: number | null;
      lastError?: string;
      deliveredAt?: Date;
    },
  ) {
    await this.prisma.webhookDelivery
      .update({ where: { id: deliveryId }, data })
      .catch(() => undefined);
  }
}

/** Receivers verify with: sha256=HMAC_SHA256(secret, rawBody). */
function sign(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
