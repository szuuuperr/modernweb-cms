import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../../modules/rbac/permissions';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Requires the current user to hold ALL of the given permissions on the
 * website identified by the `:websiteId` route param.
 * Platform admins (PLATFORM_ADMIN / SUPER_ADMIN) bypass this check.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
