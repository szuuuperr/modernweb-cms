import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CONTENT_CHANGED,
  ContentAction,
  ContentChangedEvent,
} from '../../common/events/content-changed.event';
import { Prisma, Seo, SeoTarget } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UpsertSeoDefaultsDto, UpsertSeoDto } from './dto/seo.dto';

/** SEO as the public API serves it: target values merged over website defaults. */
export interface ResolvedSeo {
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  extra: unknown;
}

type SeoDefaults = {
  titleTemplate: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
} | null;

@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Drives cache invalidation and webhook delivery. */
  private emitChanged(websiteId: string, action: ContentAction, id: string) {
    this.events.emit(
      CONTENT_CHANGED,
      new ContentChangedEvent(websiteId, 'seo', action, id),
    );
  }

  async get(websiteId: string, targetType: SeoTarget, targetId: string) {
    await this.ensureTargetExists(websiteId, targetType, targetId);
    const seo = await this.prisma.seo.findUnique({
      where: { targetType_targetId: { targetType, targetId } },
    });
    if (!seo) throw new NotFoundException('No SEO set for this target');
    return seo;
  }

  async upsert(
    websiteId: string,
    targetType: SeoTarget,
    targetId: string,
    dto: UpsertSeoDto,
  ) {
    await this.ensureTargetExists(websiteId, targetType, targetId);
    const data = {
      ...(dto.metaTitle !== undefined ? { metaTitle: dto.metaTitle } : {}),
      ...(dto.metaDescription !== undefined
        ? { metaDescription: dto.metaDescription }
        : {}),
      ...(dto.ogImageUrl !== undefined ? { ogImageUrl: dto.ogImageUrl } : {}),
      ...(dto.canonicalUrl !== undefined
        ? { canonicalUrl: dto.canonicalUrl }
        : {}),
      ...(dto.noIndex !== undefined ? { noIndex: dto.noIndex } : {}),
      ...(dto.extra !== undefined
        ? { extra: dto.extra as Prisma.InputJsonValue }
        : {}),
    };
    const seo = await this.prisma.seo.upsert({
      where: { targetType_targetId: { targetType, targetId } },
      create: { websiteId, targetType, targetId, ...data },
      update: data,
    });
    this.emitChanged(websiteId, 'updated', targetId);
    return seo;
  }

  async remove(websiteId: string, targetType: SeoTarget, targetId: string) {
    await this.get(websiteId, targetType, targetId);
    await this.prisma.seo.delete({
      where: { targetType_targetId: { targetType, targetId } },
    });
    this.emitChanged(websiteId, 'deleted', targetId);
    return { deleted: true };
  }

  /**
   * Deletes SEO for a target that is itself being deleted. Skips the target
   * existence check on purpose — callers own the target and there is no FK
   * cascade for a polymorphic reference.
   */
  async removeForTarget(targetType: SeoTarget, targetId: string) {
    await this.prisma.seo.deleteMany({ where: { targetType, targetId } });
  }

  getDefaults(websiteId: string) {
    return this.prisma.websiteSeoDefault.findUnique({ where: { websiteId } });
  }

  async upsertDefaults(websiteId: string, dto: UpsertSeoDefaultsDto) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
    });
    if (!website) throw new NotFoundException('Website not found');
    const defaults = await this.prisma.websiteSeoDefault.upsert({
      where: { websiteId },
      create: { websiteId, ...dto },
      update: dto,
    });
    // Defaults are merged into every page/entry response, so this touches all.
    this.emitChanged(websiteId, 'updated', websiteId);
    return defaults;
  }

  /** Resolves one target's SEO for the public API. */
  async resolve(
    websiteId: string,
    targetType: SeoTarget,
    targetId: string,
  ): Promise<ResolvedSeo> {
    const [seo, defaults] = await Promise.all([
      this.prisma.seo.findUnique({
        where: { targetType_targetId: { targetType, targetId } },
      }),
      this.getDefaults(websiteId),
    ]);
    return this.merge(seo, defaults);
  }

  /** Batched variant so listing endpoints don't issue one query per item. */
  async resolveMany(
    websiteId: string,
    targetType: SeoTarget,
    targetIds: string[],
  ): Promise<Map<string, ResolvedSeo>> {
    const resolved = new Map<string, ResolvedSeo>();
    if (targetIds.length === 0) return resolved;

    const [rows, defaults] = await Promise.all([
      this.prisma.seo.findMany({
        where: { targetType, targetId: { in: targetIds } },
      }),
      this.getDefaults(websiteId),
    ]);
    const byTarget = new Map(rows.map((row) => [row.targetId, row]));
    for (const id of targetIds) {
      resolved.set(id, this.merge(byTarget.get(id) ?? null, defaults));
    }
    return resolved;
  }

  private merge(seo: Seo | null, defaults: SeoDefaults): ResolvedSeo {
    const metaTitle = seo?.metaTitle
      ? this.applyTitleTemplate(seo.metaTitle, defaults?.titleTemplate ?? null)
      : (defaults?.metaTitle ?? null);
    return {
      metaTitle,
      metaDescription:
        seo?.metaDescription ?? defaults?.metaDescription ?? null,
      ogImageUrl: seo?.ogImageUrl ?? defaults?.ogImageUrl ?? null,
      canonicalUrl: seo?.canonicalUrl ?? null,
      noIndex: seo?.noIndex ?? false,
      extra: seo?.extra ?? null,
    };
  }

  private applyTitleTemplate(title: string, template: string | null) {
    if (!template || !template.includes('%s')) return title;
    return template.replace('%s', title);
  }

  /**
   * The Seo.targetId is polymorphic, so nothing at the DB level stops a caller
   * from attaching SEO to another website's page. This check is that guard.
   */
  private async ensureTargetExists(
    websiteId: string,
    targetType: SeoTarget,
    targetId: string,
  ) {
    const found =
      targetType === SeoTarget.PAGE
        ? await this.prisma.page.findFirst({
            where: { id: targetId, websiteId },
            select: { id: true },
          })
        : await this.prisma.entry.findFirst({
            where: { id: targetId, websiteId },
            select: { id: true },
          });
    if (!found) {
      throw new NotFoundException(
        `${targetType === SeoTarget.PAGE ? 'Page' : 'Entry'} not found on this website`,
      );
    }
  }
}
