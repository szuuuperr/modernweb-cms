import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLATFORM_ROLE_KEY } from '../../../common/decorators/require-platform-role.decorator';
import type { AuthUser } from '../../../common/types/auth-user';
import { PlatformRole } from '../../../generated/prisma/client';

const HIERARCHY: PlatformRole[] = [
  PlatformRole.NONE,
  PlatformRole.SUPPORT,
  PlatformRole.PLATFORM_ADMIN,
  PlatformRole.SUPER_ADMIN,
];

@Injectable()
export class PlatformRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PlatformRole>(
      PLATFORM_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) throw new ForbiddenException();

    if (HIERARCHY.indexOf(user.platformRole) < HIERARCHY.indexOf(required)) {
      throw new ForbiddenException(
        `Requires platform role ${required} or higher`,
      );
    }
    return true;
  }
}
