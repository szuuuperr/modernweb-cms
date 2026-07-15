import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { paginate } from '../../common/dto/pagination.dto';
import {
  CONTENT_CHANGED,
  ContentAction,
  ContentChangedEvent,
} from '../../common/events/content-changed.event';
import { PageStatus, Prisma, SeoTarget } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SeoService } from '../seo/seo.service';
import { CreatePageDto, QueryPagesDto, UpdatePageDto } from './dto/page.dto';
import {
  PAGE_PUBLISHED,
  PAGE_UNPUBLISHED,
  PagePublishedEvent,
} from './events/page-published.event';

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seo: SeoService,
    private readonly events: EventEmitter2,
  ) {}

  async findAll(websiteId: string, query: QueryPagesDto) {
    const where: Prisma.PageWhereInput = {
      websiteId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search } },
              { slug: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.page.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.page.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async findOne(websiteId: string, pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, websiteId },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async create(websiteId: string, dto: CreatePageDto) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
    });
    if (!website) throw new NotFoundException('Website not found');
    await this.ensureSlugFree(websiteId, dto.slug);

    const publish = dto.status === PageStatus.PUBLISHED;
    const page = await this.prisma.page.create({
      data: {
        websiteId,
        title: dto.title,
        slug: dto.slug,
        blocks: (dto.blocks ?? []) as unknown as Prisma.InputJsonValue,
        status: publish ? PageStatus.PUBLISHED : PageStatus.DRAFT,
        publishedAt: publish ? new Date() : null,
      },
    });
    if (publish) this.emit(PAGE_PUBLISHED, page);
    return page;
  }

  async update(websiteId: string, pageId: string, dto: UpdatePageDto) {
    const page = await this.findOne(websiteId, pageId);
    if (dto.slug && dto.slug !== page.slug) {
      await this.ensureSlugFree(websiteId, dto.slug);
    }

    // `status` here only flips the flag; publishedAt is kept in sync so the
    // public API never serves a PUBLISHED page without a publish timestamp.
    const statusChange =
      dto.status && dto.status !== page.status
        ? {
            status: dto.status,
            publishedAt:
              dto.status === PageStatus.PUBLISHED ? new Date() : null,
          }
        : {};

    const updated = await this.prisma.page.update({
      where: { id: pageId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.blocks !== undefined
          ? { blocks: dto.blocks as unknown as Prisma.InputJsonValue }
          : {}),
        ...statusChange,
      },
    });
    if (dto.status && dto.status !== page.status) {
      this.emit(
        dto.status === PageStatus.PUBLISHED ? PAGE_PUBLISHED : PAGE_UNPUBLISHED,
        updated,
      );
    } else {
      // Editing an already-published page changes what the public API serves,
      // so the cache must drop it even though the status did not change.
      this.emitChanged(websiteId, 'updated', pageId);
    }
    return updated;
  }

  async publish(websiteId: string, pageId: string) {
    await this.findOne(websiteId, pageId);
    const updated = await this.prisma.page.update({
      where: { id: pageId },
      data: { status: PageStatus.PUBLISHED, publishedAt: new Date() },
    });
    this.emit(PAGE_PUBLISHED, updated);
    return updated;
  }

  async unpublish(websiteId: string, pageId: string) {
    await this.findOne(websiteId, pageId);
    const updated = await this.prisma.page.update({
      where: { id: pageId },
      data: { status: PageStatus.DRAFT, publishedAt: null },
    });
    this.emit(PAGE_UNPUBLISHED, updated);
    return updated;
  }

  async remove(websiteId: string, pageId: string) {
    await this.findOne(websiteId, pageId);
    // Seo rows are polymorphic, so no FK cascade cleans them up for us.
    await this.seo.removeForTarget(SeoTarget.PAGE, pageId);
    await this.prisma.page.delete({ where: { id: pageId } });
    this.emitChanged(websiteId, 'deleted', pageId);
    return { deleted: true };
  }

  private emit(
    eventName: string,
    page: { id: string; websiteId: string; slug: string },
  ) {
    this.events.emit(
      eventName,
      new PagePublishedEvent(page.id, page.websiteId, page.slug),
    );
    this.emitChanged(
      page.websiteId,
      eventName === PAGE_PUBLISHED ? 'published' : 'unpublished',
      page.id,
    );
  }

  /** Drives cache invalidation and webhook delivery. */
  private emitChanged(websiteId: string, action: ContentAction, id: string) {
    this.events.emit(
      CONTENT_CHANGED,
      new ContentChangedEvent(websiteId, 'page', action, id),
    );
  }

  private async ensureSlugFree(websiteId: string, slug: string) {
    const existing = await this.prisma.page.findUnique({
      where: { websiteId_slug: { websiteId, slug } },
    });
    if (existing) {
      throw new ConflictException('Page slug already in use on this website');
    }
  }
}
