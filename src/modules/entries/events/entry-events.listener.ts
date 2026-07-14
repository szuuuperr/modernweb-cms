import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ENTRY_PUBLISHED,
  ENTRY_UNPUBLISHED,
  EntryPublishedEvent,
} from './entry-published.event';

@Injectable()
export class EntryEventsListener {
  private readonly logger = new Logger(EntryEventsListener.name);

  @OnEvent(ENTRY_PUBLISHED)
  onPublished(event: EntryPublishedEvent) {
    // Placeholder: phase 3 hooks cache invalidation + webhooks here.
    this.logger.log(
      `Entry ${event.entryId} published (website ${event.websiteId})`,
    );
  }

  @OnEvent(ENTRY_UNPUBLISHED)
  onUnpublished(event: EntryPublishedEvent) {
    this.logger.log(
      `Entry ${event.entryId} unpublished (website ${event.websiteId})`,
    );
  }
}
