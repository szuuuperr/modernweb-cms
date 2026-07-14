import { BadRequestException } from '@nestjs/common';
import { EntryStatus, Prisma } from '../../generated/prisma/client';

const FILTER_OPS: Record<string, string> = {
  eq: 'equals',
  ne: 'not',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
  contains: 'string_contains',
};

const SORTABLE_COLUMNS = ['createdAt', 'updatedAt', 'publishedAt'] as const;

function coerce(raw: string): string | number | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}

/**
 * Builder pattern: assembles the Prisma query for listing entries,
 * including filters on keys inside the `data` JSON column.
 *
 * Example: ?filter[price][gte]=1000&filter[status_field][eq]=open&sort=createdAt:desc
 */
export class EntryQueryBuilder {
  private readonly conditions: Prisma.EntryWhereInput[] = [];
  private orderBy: Prisma.EntryOrderByWithRelationInput = { createdAt: 'desc' };
  private skip = 0;
  private take = 20;

  forCollection(websiteId: string, collectionId: string): this {
    this.conditions.push({ websiteId, collectionId });
    return this;
  }

  withStatus(status?: EntryStatus): this {
    if (status) this.conditions.push({ status });
    return this;
  }

  withDataFilters(filter?: Record<string, Record<string, string>>): this {
    if (!filter) return this;
    for (const [key, ops] of Object.entries(filter)) {
      if (typeof ops !== 'object' || ops === null) {
        throw new BadRequestException(
          `Invalid filter for "${key}"; use filter[${key}][op]=value`,
        );
      }
      for (const [op, raw] of Object.entries(ops)) {
        const prismaOp = FILTER_OPS[op];
        if (!prismaOp) {
          throw new BadRequestException(
            `Unknown filter operator "${op}"; allowed: ${Object.keys(FILTER_OPS).join(', ')}`,
          );
        }
        this.conditions.push({
          data: { path: `$.${key}`, [prismaOp]: coerce(String(raw)) },
        } as Prisma.EntryWhereInput);
      }
    }
    return this;
  }

  sortBy(sort?: string): this {
    if (!sort) return this;
    const [column, direction = 'asc'] = sort.split(':');
    if (!SORTABLE_COLUMNS.includes(column as (typeof SORTABLE_COLUMNS)[number])) {
      throw new BadRequestException(
        `Can only sort by: ${SORTABLE_COLUMNS.join(', ')}`,
      );
    }
    if (direction !== 'asc' && direction !== 'desc') {
      throw new BadRequestException('Sort direction must be asc or desc');
    }
    this.orderBy = { [column]: direction };
    return this;
  }

  paginate(page: number, limit: number): this {
    this.skip = (page - 1) * limit;
    this.take = limit;
    return this;
  }

  build() {
    return {
      where: { AND: this.conditions } satisfies Prisma.EntryWhereInput,
      orderBy: this.orderBy,
      skip: this.skip,
      take: this.take,
    };
  }
}
