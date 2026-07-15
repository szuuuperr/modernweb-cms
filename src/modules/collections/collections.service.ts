import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  CreateCollectionDto,
  UpdateCollectionDto,
} from './dto/create-collection.dto';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(websiteId: string) {
    return this.prisma.collection.findMany({
      where: { websiteId },
      include: { _count: { select: { entries: true, fields: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(websiteId: string, collectionId: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, websiteId },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }

  async create(websiteId: string, dto: CreateCollectionDto) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
    });
    if (!website) throw new NotFoundException('Website not found');

    await this.ensureSlugFree(websiteId, dto.slug);
    return this.prisma.collection.create({
      data: { websiteId, ...dto },
    });
  }

  async update(
    websiteId: string,
    collectionId: string,
    dto: UpdateCollectionDto,
  ) {
    const collection = await this.findOne(websiteId, collectionId);
    if (dto.slug && dto.slug !== collection.slug) {
      await this.ensureSlugFree(websiteId, dto.slug);
    }
    return this.prisma.collection.update({
      where: { id: collectionId },
      data: dto,
    });
  }

  async remove(websiteId: string, collectionId: string) {
    await this.findOne(websiteId, collectionId);
    await this.prisma.collection.delete({ where: { id: collectionId } });
    return { deleted: true };
  }

  private async ensureSlugFree(websiteId: string, slug: string) {
    const existing = await this.prisma.collection.findUnique({
      where: { websiteId_slug: { websiteId, slug } },
    });
    if (existing) {
      throw new ConflictException(
        'Collection slug already in use on this website',
      );
    }
  }
}
