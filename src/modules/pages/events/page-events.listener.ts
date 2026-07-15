import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PAGE_PUBLISHED,
  PAGE_UNPUBLISHED,
  PagePublishedEvent,
} from './page-published.event';

@Injectable()
export class PageEventsListener {
  private readonly logger = new Logger(PageEventsListener.name);

  @OnEvent(PAGE_PUBLISHED)
  onPublished(event: PagePublishedEvent) {
    // Placeholder: phase 3 hooks cache invalidation + webhooks here.
    this.logger.log(
      `Page ${event.slug} published (website ${event.websiteId})`,
    );
  }

  @OnEvent(PAGE_UNPUBLISHED)
  onUnpublished(event: PagePublishedEvent) {
    this.logger.log(
      `Page ${event.slug} unpublished (website ${event.websiteId})`,
    );
  }
}
