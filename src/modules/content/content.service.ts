import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../../common/dto/pagination.dto';
import { EntryStatus, WebsiteStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EntriesRepository } from '../entries/entries.repository';
import { EntryQueryBuilder } from '../entries/entry-query.builder';
import { PublicQueryEntriesDto } from './dto/public-query.dto';

/**
 * Public read-only content API consumed by the frontend websites.
 * Only ACTIVE websites and PUBLISHED entries are ever exposed.
 */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entriesRepository: EntriesRepository,
  ) {}

  async getEntries(
    websiteSlug: string,
    collectionSlug: string,
    query: PublicQueryEntriesDto,
  ) {
    const collection = await this.getCollection(websiteSlug, collectionSlug);
    const builder = new EntryQueryBuilder()
      .forCollection(collection.websiteId, collection.id)
      .withStatus(EntryStatus.PUBLISHED)
      .withDataFilters(query.filter)
      .sortBy(query.sort)
      .paginate(query.page, query.limit);
    const { items, total } = await this.entriesRepository.findManyPaginated(
      builder,
    );
    return paginate(
      items.map((entry) => ({
        id: entry.id,
        data: entry.data,
        publishedAt: entry.publishedAt,
        updatedAt: entry.updatedAt,
      })),
      total,
      query,
    );
  }

  async getEntry(websiteSlug: string, collectionSlug: string, entryId: string) {
    const collection = await this.getCollection(websiteSlug, collectionSlug);
    const entry = await this.prisma.entry.findFirst({
      where: {
        id: entryId,
        collectionId: collection.id,
        status: EntryStatus.PUBLISHED,
      },
    });
    if (!entry) throw new NotFoundException('Entry not found');
    return {
      id: entry.id,
      data: entry.data,
      publishedAt: entry.publishedAt,
      updatedAt: entry.updatedAt,
    };
  }

  private async getCollection(websiteSlug: string, collectionSlug: string) {
    const website = await this.prisma.website.findFirst({
      where: { slug: websiteSlug, status: WebsiteStatus.ACTIVE },
    });
    if (!website) throw new NotFoundException('Website not found');

    const collection = await this.prisma.collection.findUnique({
      where: { websiteId_slug: { websiteId: website.id, slug: collectionSlug } },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }
}
