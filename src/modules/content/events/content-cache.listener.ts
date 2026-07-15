import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CONTENT_CHANGED,
  ContentChangedEvent,
} from '../../../common/events/content-changed.event';
import { CacheService } from '../../../infrastructure/cache/cache.service';

@Injectable()
export class ContentCacheListener {
  private readonly logger = new Logger(ContentCacheListener.name);

  constructor(private readonly cache: CacheService) {}

  @OnEvent(CONTENT_CHANGED)
  async onContentChanged(event: ContentChangedEvent) {
    if (!this.cache.enabled) return;
    await this.cache.invalidateWebsite(event.websiteId);
    this.logger.debug(
      `Cache invalidated for website ${event.websiteId} (${event.name})`,
    );
  }
}
