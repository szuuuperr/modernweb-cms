import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CONTENT_CHANGED,
  ContentAction,
  ContentChangedEvent,
} from '../../common/events/content-changed.event';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Drives cache invalidation and webhook delivery. */
  private emitChanged(websiteId: string, action: ContentAction, id: string) {
    this.events.emit(
      CONTENT_CHANGED,
      new ContentChangedEvent(websiteId, 'setting', action, id),
    );
  }

  findAll(websiteId: string) {
    return this.prisma.setting.findMany({
      where: { websiteId },
      orderBy: { key: 'asc' },
    });
  }

  async findOne(websiteId: string, key: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { websiteId_key: { websiteId, key } },
    });
    if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
    return setting;
  }

  async upsert(websiteId: string, key: string, value: unknown) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
    });
    if (!website) throw new NotFoundException('Website not found');

    const json = toJsonValue(value);
    const setting = await this.prisma.setting.upsert({
      where: { websiteId_key: { websiteId, key } },
      create: { websiteId, key, value: json },
      update: { value: json },
    });
    this.emitChanged(websiteId, 'updated', key);
    return setting;
  }

  async remove(websiteId: string, key: string) {
    await this.findOne(websiteId, key);
    await this.prisma.setting.delete({
      where: { websiteId_key: { websiteId, key } },
    });
    this.emitChanged(websiteId, 'deleted', key);
    return { deleted: true };
  }

  /** Public API shape: a flat key -> value map is what a frontend wants. */
  async asMap(websiteId: string): Promise<Record<string, unknown>> {
    const settings = await this.prisma.setting.findMany({
      where: { websiteId },
      select: { key: true, value: true },
    });
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  }
}

/** Prisma needs an explicit JsonNull to store a JSON `null`. */
function toJsonValue(value: unknown) {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}
