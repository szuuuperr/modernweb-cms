import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PlatformRole } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DEFAULT_ROLES, PERMISSIONS } from '../rbac/permissions';
import { CreateWebsiteDto, UpdateWebsiteDto } from './dto/create-website.dto';

@Injectable()
export class WebsitesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the website together with its default RBAC roles. */
  async create(dto: CreateWebsiteDto) {
    const existing = await this.prisma.website.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('Slug already in use');

    return this.prisma.website.create({
      data: {
        ...dto,
        roles: {
          create: DEFAULT_ROLES.map((role) => ({
            name: role.name,
            permissions: role.permissions,
          })),
        },
      },
      include: { roles: true },
    });
  }

  async findAllFor(user: AuthUser, pagination: PaginationDto) {
    const isPlatform =
      user.platformRole === PlatformRole.SUPER_ADMIN ||
      user.platformRole === PlatformRole.PLATFORM_ADMIN ||
      user.platformRole === PlatformRole.SUPPORT;
    const where = isPlatform ? {} : { members: { some: { userId: user.id } } };

    const [items, total] = await Promise.all([
      this.prisma.website.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.website.count({ where }),
    ]);
    return paginate(items, total, pagination);
  }

  async findOne(websiteId: string) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: {
        collections: { select: { id: true, name: true, slug: true } },
        _count: { select: { members: true, entries: true, media: true } },
      },
    });
    if (!website) throw new NotFoundException('Website not found');
    return website;
  }

  async update(websiteId: string, dto: UpdateWebsiteDto) {
    await this.ensureExists(websiteId);
    if (dto.slug) {
      const bySlug = await this.prisma.website.findUnique({
        where: { slug: dto.slug },
      });
      if (bySlug && bySlug.id !== websiteId) {
        throw new ConflictException('Slug already in use');
      }
    }
    return this.prisma.website.update({ where: { id: websiteId }, data: dto });
  }

  async remove(websiteId: string) {
    await this.ensureExists(websiteId);
    await this.prisma.website.delete({ where: { id: websiteId } });
    return { deleted: true };
  }

  /**
   * The effective permissions of the caller on one website, so the admin panel
   * can render only what the user may actually do. Deliberately mirrors
   * PermissionsGuard — if the two ever disagree, the UI lies. Non-members get
   * an empty list rather than an error: "you may do nothing here" is an answer
   * the panel can render, a 403 is not.
   */
  async permissionsFor(user: AuthUser, websiteId: string) {
    await this.ensureExists(websiteId);

    if (
      user.platformRole === PlatformRole.SUPER_ADMIN ||
      user.platformRole === PlatformRole.PLATFORM_ADMIN
    ) {
      return { role: null, permissions: [...PERMISSIONS] };
    }

    const membership = await this.prisma.websiteUser.findUnique({
      where: { userId_websiteId: { userId: user.id, websiteId } },
      include: {
        role: { select: { id: true, name: true, permissions: true } },
      },
    });
    if (!membership) return { role: null, permissions: [] };

    const { id, name, permissions } = membership.role;
    return { role: { id, name }, permissions: (permissions as string[]) ?? [] };
  }

  private async ensureExists(websiteId: string) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
    });
    if (!website) throw new NotFoundException('Website not found');
  }
}
