import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateFieldDto, UpdateFieldDto } from './dto/create-field.dto';

@Injectable()
export class FieldsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(websiteId: string, collectionId: string, dto: CreateFieldDto) {
    await this.ensureCollection(websiteId, collectionId);
    const existing = await this.prisma.field.findUnique({
      where: { collectionId_key: { collectionId, key: dto.key } },
    });
    if (existing) {
      throw new ConflictException(`Field key "${dto.key}" already exists`);
    }
    return this.prisma.field.create({
      data: {
        collectionId,
        name: dto.name,
        key: dto.key,
        type: dto.type,
        required: dto.required ?? false,
        order: dto.order ?? 0,
        options: (dto.options ?? undefined) as
          Prisma.InputJsonValue | undefined,
      },
    });
  }

  async update(
    websiteId: string,
    collectionId: string,
    fieldId: string,
    dto: UpdateFieldDto,
  ) {
    const field = await this.findFieldOrThrow(websiteId, collectionId, fieldId);
    if (dto.key && dto.key !== field.key) {
      const existing = await this.prisma.field.findUnique({
        where: { collectionId_key: { collectionId, key: dto.key } },
      });
      if (existing) {
        throw new ConflictException(`Field key "${dto.key}" already exists`);
      }
    }
    return this.prisma.field.update({
      where: { id: fieldId },
      data: {
        ...dto,
        options: (dto.options ?? undefined) as
          Prisma.InputJsonValue | undefined,
      },
    });
  }

  async remove(websiteId: string, collectionId: string, fieldId: string) {
    await this.findFieldOrThrow(websiteId, collectionId, fieldId);
    await this.prisma.field.delete({ where: { id: fieldId } });
    return { deleted: true };
  }

  private async ensureCollection(websiteId: string, collectionId: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, websiteId },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }

  private async findFieldOrThrow(
    websiteId: string,
    collectionId: string,
    fieldId: string,
  ) {
    await this.ensureCollection(websiteId, collectionId);
    const field = await this.prisma.field.findFirst({
      where: { id: fieldId, collectionId },
    });
    if (!field) throw new NotFoundException('Field not found');
    return field;
  }
}
