import { SetMetadata } from '@nestjs/common';
import { PlatformRole } from '../../generated/prisma/client';

export const PLATFORM_ROLE_KEY = 'requiredPlatformRole';

/** Requires the current user to have at least the given platform role. */
export const RequirePlatformRole = (role: PlatformRole) =>
  SetMetadata(PLATFORM_ROLE_KEY, role);
