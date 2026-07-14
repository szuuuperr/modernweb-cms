import { PlatformRole } from '../../generated/prisma/client';

/** Shape attached to request.user by JwtStrategy. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  platformRole: PlatformRole;
}
