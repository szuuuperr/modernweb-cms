import { Injectable } from '@nestjs/common';
import { paginate } from '../../common/dto/pagination.dto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { QueryAuditDto } from './dto/audit.dto';

export interface AuditRecord {
  websiteId: string | null;
  actorId: string | null;
  actorEmail?: string | null;
  resource: string;
  action: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Append-only; a failure here must never break the action being audited. */
  async record(entry: AuditRecord): Promise<void> {
    await this.prisma.auditLog
      .create({
        data: {
          websiteId: entry.websiteId,
          actorId: entry.actorId,
          actorEmail: entry.actorEmail,
          resource: entry.resource,
          action: entry.action,
          targetId: entry.targetId,
          meta: (entry.meta ?? undefined) as Prisma.InputJsonValue | undefined,
          ip: entry.ip,
        },
      })
      .catch(() => undefined);
  }

  async findAll(websiteId: string, query: QueryAuditDto) {
    const where: Prisma.AuditLogWhereInput = {
      websiteId,
      ...(query.resource ? { resource: query.resource } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(items, total, query);
  }
}
