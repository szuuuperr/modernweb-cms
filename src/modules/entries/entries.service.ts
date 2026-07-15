import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { paginate } from '../../common/dto/pagination.dto';
import {
  CONTENT_CHANGED,
  ContentAction,
  ContentChangedEvent,
} from '../../common/events/content-changed.event';
import { EntryStatus, Prisma, SeoTarget } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SeoService } from '../seo/seo.service';
import { EntryValidator } from './domain/entry-validator';
import { EntriesRepository } from './entries.repository';
import { EntryQueryBuilder } from './entry-query.builder';
import {
  ENTRY_PUBLISHED,
  ENTRY_UNPUBLISHED,
  EntryPublishedEvent,
} from './events/entry-published.event';
import {
  CreateEntryDto,
  QueryEntriesDto,
  UpdateEntryDto,
} from './dto/entry.dto';

@Injectable()
export class EntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: EntriesRepository,
    private readonly validator: EntryValidator,
    private readonly seo: SeoService,
    private readonly events: EventEmitter2,
  ) {}

  async findAll(
    websiteId: string,
    collectionId: string,
    query: QueryEntriesDto,
  ) {
    await this.getCollectionOrThrow(websiteId, collectionId);
    const builder = new EntryQueryBuilder()
      .forCollection(websiteId, collectionId)
      .withStatus(query.status)
      .withDataFilters(query.filter)
      .sortBy(query.sort)
      .paginate(query.page, query.limit);
    const { items, total } = await this.repository.findManyPaginated(builder);
    return paginate(items, total, query);
  }

  async findOne(websiteId: string, collectionId: string, entryId: string) {
    const entry = await this.repository.findOneScoped(
      websiteId,
      collectionId,
      entryId,
    );
    if (!entry) throw new NotFoundException('Entry not found');
    return entry;
  }

  async create(websiteId: string, collectionId: string, dto: CreateEntryDto) {
    const collection = await this.getCollectionOrThrow(websiteId, collectionId);
    const data = this.validator.validate(collection.fields, dto.data);

    const publish = dto.status === EntryStatus.PUBLISHED;
    const entry = await this.repository.create({
      websiteId,
      collectionId,
      data: data as Prisma.InputJsonValue,
      status: publish ? EntryStatus.PUBLISHED : EntryStatus.DRAFT,
      publishedAt: publish ? new Date() : null,
    });
    if (publish) this.emitPublished(ENTRY_PUBLISHED, entry.id, entry);
    return entry;
  }

  async update(
    websiteId: string,
    collectionId: string,
    entryId: string,
    dto: UpdateEntryDto,
  ) {
    const [collection, entry] = await Promise.all([
      this.getCollectionOrThrow(websiteId, collectionId),
      this.findOne(websiteId, collectionId, entryId),
    ]);
    const cleaned = this.validator.validate(collection.fields, dto.data, {
      partial: true,
    });
    const merged = {
      ...(entry.data as Record<string, unknown>),
      ...cleaned,
    };
    const updated = await this.repository.update(entryId, {
      data: merged as Prisma.InputJsonValue,
    });
    // Editing an already-published entry changes what the public API serves,
    // so the cache must drop it even though the status did not change.
    this.emitChanged(websiteId, 'updated', entryId);
    return updated;
  }

  async publish(websiteId: string, collectionId: string, entryId: string) {
    const [collection, entry] = await Promise.all([
      this.getCollectionOrThrow(websiteId, collectionId),
      this.findOne(websiteId, collectionId, entryId),
    ]);
    // A draft may have been created before fields became required; re-check.
    this.validator.validate(
      collection.fields,
      entry.data as Record<string, unknown>,
    );
    const updated = await this.repository.update(entryId, {
      status: EntryStatus.PUBLISHED,
      publishedAt: new Date(),
    });
    this.emitPublished(ENTRY_PUBLISHED, entryId, updated);
    return updated;
  }

  async unpublish(websiteId: string, collectionId: string, entryId: string) {
    await this.findOne(websiteId, collectionId, entryId);
    const updated = await this.repository.update(entryId, {
      status: EntryStatus.DRAFT,
      publishedAt: null,
    });
    this.emitPublished(ENTRY_UNPUBLISHED, entryId, updated);
    return updated;
  }

  async remove(websiteId: string, collectionId: string, entryId: string) {
    await this.findOne(websiteId, collectionId, entryId);
    // Seo rows are polymorphic, so no FK cascade cleans them up for us.
    await this.seo.removeForTarget(SeoTarget.ENTRY, entryId);
    await this.repository.delete(entryId);
    this.emitChanged(websiteId, 'deleted', entryId);
    return { deleted: true };
  }

  private emitPublished(
    eventName: string,
    entryId: string,
    entry: { websiteId: string; collectionId: string },
  ) {
    this.events.emit(
      eventName,
      new EntryPublishedEvent(entryId, entry.websiteId, entry.collectionId),
    );
    this.emitChanged(
      entry.websiteId,
      eventName === ENTRY_PUBLISHED ? 'published' : 'unpublished',
      entryId,
    );
  }

  /** Drives cache invalidation and webhook delivery. */
  private emitChanged(websiteId: string, action: ContentAction, id: string) {
    this.events.emit(
      CONTENT_CHANGED,
      new ContentChangedEvent(websiteId, 'entry', action, id),
    );
  }

  private async getCollectionOrThrow(websiteId: string, collectionId: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, websiteId },
      include: { fields: true },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }
}
