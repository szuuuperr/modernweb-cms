import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { STORAGE_ADAPTER } from '../../infrastructure/storage/storage.adapter';
import type { StorageAdapter } from '../../infrastructure/storage/storage.adapter';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async findAll(websiteId: string, pagination: PaginationDto) {
    const where = { websiteId };
    const [items, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.media.count({ where }),
    ]);
    return paginate(items, total, pagination);
  }

  async upload(websiteId: string, file: Express.Multer.File, alt?: string) {
    if (!file) throw new BadRequestException('No file uploaded (field "file")');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} not allowed; allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 10MB limit');
    }
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
    });
    if (!website) throw new NotFoundException('Website not found');

    const stored = await this.storage.save(
      {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
      },
      websiteId,
    );
    return this.prisma.media.create({
      data: {
        websiteId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: stored.storageKey,
        url: stored.url,
        alt,
      },
    });
  }

  async remove(websiteId: string, mediaId: string) {
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, websiteId },
    });
    if (!media) throw new NotFoundException('Media not found');
    await this.storage.delete(media.storageKey);
    await this.prisma.media.delete({ where: { id: mediaId } });
    return { deleted: true };
  }
}
