import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EntryQueryBuilder } from './entry-query.builder';

/** Repository pattern: the only place in the module that touches Prisma for entries. */
@Injectable()
export class EntriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyPaginated(builder: EntryQueryBuilder) {
    const { where, orderBy, skip, take } = builder.build();
    const [items, total] = await Promise.all([
      this.prisma.entry.findMany({ where, orderBy, skip, take }),
      this.prisma.entry.count({ where }),
    ]);
    return { items, total };
  }

  findOneScoped(websiteId: string, collectionId: string, entryId: string) {
    return this.prisma.entry.findFirst({
      where: { id: entryId, websiteId, collectionId },
    });
  }

  create(data: Prisma.EntryUncheckedCreateInput) {
    return this.prisma.entry.create({ data });
  }

  update(entryId: string, data: Prisma.EntryUncheckedUpdateInput) {
    return this.prisma.entry.update({ where: { id: entryId }, data });
  }

  delete(entryId: string) {
    return this.prisma.entry.delete({ where: { id: entryId } });
  }
}
