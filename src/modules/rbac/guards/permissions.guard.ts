import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../../../common/types/auth-user';
import { PlatformRole } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { Permission } from '../permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) throw new ForbiddenException();

    if (
      user.platformRole === PlatformRole.SUPER_ADMIN ||
      user.platformRole === PlatformRole.PLATFORM_ADMIN
    ) {
      return true;
    }

    const websiteId: string | undefined = request.params?.websiteId;
    if (!websiteId) {
      throw new ForbiddenException(
        'Route requires permissions but has no :websiteId param',
      );
    }

    const membership = await this.prisma.websiteUser.findUnique({
      where: { userId_websiteId: { userId: user.id, websiteId } },
      include: { role: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this website');
    }

    const granted = (membership.role.permissions as string[]) ?? [];
    const missing = required.filter((p) => !granted.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing permissions: ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
