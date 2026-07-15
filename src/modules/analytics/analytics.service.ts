import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueryPageViewsDto } from './dto/analytics.dto';

/** Strips query string and hash: /a?b=1#c and /a are the same page. */
function normalisePath(path: string): string {
  const clean = path.split(/[?#]/)[0].trim();
  const trimmed =
    clean.length > 1 && clean.endsWith('/') ? clean.slice(0, -1) : clean;
  return trimmed.slice(0, 500) || '/';
}

/** Today at 00:00 UTC — the bucket key for a day. */
function startOfDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * One row per website+path+day, incremented in place. Tracking must never
   * fail a visitor's page load, so errors are swallowed.
   */
  async track(websiteId: string, rawPath: string): Promise<void> {
    const path = normalisePath(rawPath);
    const day = startOfDay();
    try {
      await this.prisma.pageView.upsert({
        where: { websiteId_path_day: { websiteId, path, day } },
        create: { websiteId, path, day, count: 1 },
        update: { count: { increment: 1 } },
      });
    } catch (error) {
      this.logger.warn(
        `Page view not recorded: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Totals per path plus a daily series, for the admin dashboard. */
  async summary(websiteId: string, query: QueryPageViewsDto) {
    const from = query.from ? startOfDay(new Date(query.from)) : defaultFrom();
    const to = query.to ? startOfDay(new Date(query.to)) : startOfDay();

    const rows = await this.prisma.pageView.findMany({
      where: {
        websiteId,
        day: { gte: from, lte: to },
        ...(query.path ? { path: query.path } : {}),
      },
      orderBy: [{ day: 'asc' }, { path: 'asc' }],
    });

    const byPath = new Map<string, number>();
    const byDay = new Map<string, number>();
    let total = 0;
    for (const row of rows) {
      total += row.count;
      byPath.set(row.path, (byPath.get(row.path) ?? 0) + row.count);
      const key = row.day.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + row.count);
    }

    return {
      range: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      },
      total,
      topPaths: [...byPath.entries()]
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50),
      daily: [...byDay.entries()]
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    };
  }
}

/** Default window: the last 30 days. */
function defaultFrom(): Date {
  const date = startOfDay();
  date.setUTCDate(date.getUTCDate() - 29);
  return date;
}
