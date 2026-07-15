import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import {
  EntryStatus,
  PageStatus,
  SeoTarget,
  WebsiteStatus,
} from '../../generated/prisma/client';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EntriesRepository } from '../entries/entries.repository';
import { EntryQueryBuilder } from '../entries/entry-query.builder';
import { AnalyticsService } from '../analytics/analytics.service';
import { FormsService } from '../forms/forms.service';
import { MenusService } from '../menus/menus.service';
import { PreviewService } from '../preview/preview.service';
import { SeoService } from '../seo/seo.service';
import { SettingsService } from '../settings/settings.service';
import { PublicQueryEntriesDto } from './dto/public-query.dto';

/**
 * Public read-only content API consumed by the frontend websites.
 * Only ACTIVE websites and PUBLISHED content are ever exposed.
 *
 * Every read is cached per website and dropped wholesale when content is
 * (un)published — see CacheService and the content cache listener.
 */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entriesRepository: EntriesRepository,
    private readonly seo: SeoService,
    private readonly menus: MenusService,
    private readonly settings: SettingsService,
    private readonly cache: CacheService,
    private readonly forms: FormsService,
    private readonly analytics: AnalyticsService,
    private readonly preview: PreviewService,
  ) {}

  /**
   * Preview reads bypass the cache entirely. Caching them would let a draft be
   * served to the next anonymous visitor from the same key.
   */
  private read<T>(
    websiteId: string,
    key: string,
    preview: boolean,
    factory: () => Promise<T>,
  ): Promise<T> {
    return preview ? factory() : this.cache.getOrSet(websiteId, key, factory);
  }

  async getEntries(
    websiteSlug: string,
    collectionSlug: string,
    query: PublicQueryEntriesDto,
    preview = false,
  ) {
    const collection = await this.getCollection(websiteSlug, collectionSlug);
    return this.read(
      collection.websiteId,
      `entries:${collectionSlug}:${stableKey(query)}`,
      preview,
      async () => {
        const builder = new EntryQueryBuilder()
          .forCollection(collection.websiteId, collection.id)
          .withStatus(preview ? undefined : EntryStatus.PUBLISHED)
          .withDataFilters(query.filter)
          .sortBy(query.sort)
          .paginate(query.page, query.limit);
        const { items, total } =
          await this.entriesRepository.findManyPaginated(builder);
        const seoByEntry = await this.seo.resolveMany(
          collection.websiteId,
          SeoTarget.ENTRY,
          items.map((entry) => entry.id),
        );
        return paginate(
          items.map((entry) => ({
            id: entry.id,
            data: entry.data,
            seo: seoByEntry.get(entry.id) ?? null,
            publishedAt: entry.publishedAt,
            updatedAt: entry.updatedAt,
          })),
          total,
          query,
        );
      },
    );
  }

  async getEntry(
    websiteSlug: string,
    collectionSlug: string,
    entryId: string,
    preview = false,
  ) {
    const collection = await this.getCollection(websiteSlug, collectionSlug);
    return this.read(
      collection.websiteId,
      `entry:${collectionSlug}:${entryId}`,
      preview,
      async () => {
        const entry = await this.prisma.entry.findFirst({
          where: {
            id: entryId,
            collectionId: collection.id,
            ...(preview ? {} : { status: EntryStatus.PUBLISHED }),
          },
        });
        if (!entry) throw new NotFoundException('Entry not found');
        return {
          id: entry.id,
          data: entry.data,
          seo: await this.seo.resolve(
            collection.websiteId,
            SeoTarget.ENTRY,
            entry.id,
          ),
          publishedAt: entry.publishedAt,
          updatedAt: entry.updatedAt,
        };
      },
    );
  }

  /** Listing omits `blocks` on purpose — fetch a page by slug for its content. */
  async getPages(
    websiteSlug: string,
    pagination: PaginationDto,
    preview = false,
  ) {
    const website = await this.getWebsite(websiteSlug);
    return this.read(
      website.id,
      `pages:${stableKey(pagination)}`,
      preview,
      async () => {
        const where = {
          websiteId: website.id,
          ...(preview ? {} : { status: PageStatus.PUBLISHED }),
        };
        const [items, total] = await Promise.all([
          this.prisma.page.findMany({
            where,
            select: {
              id: true,
              title: true,
              slug: true,
              publishedAt: true,
              updatedAt: true,
            },
            skip: pagination.skip,
            take: pagination.limit,
            orderBy: { publishedAt: 'desc' },
          }),
          this.prisma.page.count({ where }),
        ]);
        const seoByPage = await this.seo.resolveMany(
          website.id,
          SeoTarget.PAGE,
          items.map((page) => page.id),
        );
        return paginate(
          items.map((page) => ({
            ...page,
            seo: seoByPage.get(page.id) ?? null,
          })),
          total,
          pagination,
        );
      },
    );
  }

  async getPage(websiteSlug: string, slug: string, preview = false) {
    const website = await this.getWebsite(websiteSlug);
    return this.read(website.id, `page:${slug}`, preview, async () => {
      const page = await this.prisma.page.findFirst({
        where: {
          websiteId: website.id,
          slug,
          ...(preview ? {} : { status: PageStatus.PUBLISHED }),
        },
      });
      if (!page) throw new NotFoundException('Page not found');
      return {
        id: page.id,
        title: page.title,
        slug: page.slug,
        blocks: page.blocks,
        seo: await this.seo.resolve(website.id, SeoTarget.PAGE, page.id),
        publishedAt: page.publishedAt,
        updatedAt: page.updatedAt,
      };
    });
  }

  async getMenu(websiteSlug: string, menuSlug: string) {
    const website = await this.getWebsite(websiteSlug);
    return this.cache.getOrSet(website.id, `menu:${menuSlug}`, () =>
      this.menus.findBySlug(website.id, menuSlug),
    );
  }

  async getSettings(websiteSlug: string) {
    const website = await this.getWebsite(websiteSlug);
    return this.cache.getOrSet(website.id, 'settings', () =>
      this.settings.asMap(website.id),
    );
  }

  async getSeoDefaults(websiteSlug: string) {
    const website = await this.getWebsite(websiteSlug);
    return this.cache.getOrSet(website.id, 'seo-defaults', async () => {
      const defaults = await this.seo.getDefaults(website.id);
      return {
        titleTemplate: defaults?.titleTemplate ?? null,
        metaTitle: defaults?.metaTitle ?? null,
        metaDescription: defaults?.metaDescription ?? null,
        ogImageUrl: defaults?.ogImageUrl ?? null,
      };
    });
  }

  /** Public form submission; validation lives in FormsService. */
  async submitForm(
    websiteSlug: string,
    formSlug: string,
    data: Record<string, unknown>,
    meta: { ip?: string; userAgent?: string },
  ) {
    const website = await this.getWebsite(websiteSlug);
    return this.forms.submit(website.id, formSlug, data, meta);
  }

  async trackPageView(websiteSlug: string, path: string) {
    const website = await this.getWebsite(websiteSlug);
    await this.analytics.track(website.id, path);
    return { tracked: true };
  }

  /** Resolves a `?preview=` token to a boolean for this website. */
  async isPreview(websiteSlug: string, token?: string) {
    if (!token) return false;
    const website = await this.getWebsite(websiteSlug);
    return this.preview.isValidFor(token, website.id);
  }

  private async getWebsite(websiteSlug: string) {
    const website = await this.prisma.website.findFirst({
      where: { slug: websiteSlug, status: WebsiteStatus.ACTIVE },
    });
    if (!website) throw new NotFoundException('Website not found');
    return website;
  }

  private async getCollection(websiteSlug: string, collectionSlug: string) {
    const website = await this.getWebsite(websiteSlug);
    const collection = await this.prisma.collection.findUnique({
      where: {
        websiteId_slug: { websiteId: website.id, slug: collectionSlug },
      },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }
}

/**
 * Stable cache key for a query object: key order must not matter, or the same
 * filter sent twice with different property order would cache twice.
 */
function stableKey(query: object): string {
  return JSON.stringify(sortDeep(query));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortDeep(v)]),
    );
  }
  return value;
}
