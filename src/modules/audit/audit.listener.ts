import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RequestContextStore } from '../../common/context/request-context';
import { AUDIT_ACTION, AuditEvent } from '../../common/events/audit.event';
import {
  CONTENT_CHANGED,
  ContentChangedEvent,
} from '../../common/events/content-changed.event';
import { AuditService } from './audit.service';

/**
 * Turns domain events into audit rows. Two sources on purpose: content
 * mutations already broadcast `content.changed`, while security/admin actions
 * emit `audit.action` so they never touch the cache or webhooks.
 */
@Injectable()
export class AuditListener {
  constructor(private readonly audit: AuditService) {}

  @OnEvent(CONTENT_CHANGED)
  async onContentChanged(event: ContentChangedEvent) {
    const context = RequestContextStore.get();
    await this.audit.record({
      websiteId: event.websiteId,
      actorId: event.actorId,
      actorEmail: context?.userEmail,
      resource: event.resource,
      action: event.action,
      targetId: event.id,
      ip: context?.ip,
    });
  }

  @OnEvent(AUDIT_ACTION)
  async onAuditAction(event: AuditEvent) {
    const context = RequestContextStore.get();
    await this.audit.record({
      websiteId: event.websiteId,
      actorId: event.actorId,
      actorEmail: context?.userEmail,
      resource: event.resource,
      action: event.action,
      targetId: event.targetId,
      meta: event.meta,
      ip: context?.ip,
    });
  }
}
