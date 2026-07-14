/**
 * RBAC: a role is nothing more than a named set of permission strings.
 * Website-scoped permissions checked by PermissionsGuard against the
 * user's membership (WebsiteUser -> Role.permissions).
 */
export const PERMISSIONS = [
  'websites.read',
  'websites.update',
  'members.read',
  'members.manage',
  'roles.read',
  'roles.manage',
  'collections.read',
  'collections.manage',
  'entries.read',
  'entries.create',
  'entries.update',
  'entries.delete',
  'entries.publish',
  'media.read',
  'media.upload',
  'media.delete',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

/** Default roles created for every new website. */
export const DEFAULT_ROLES: { name: string; permissions: Permission[] }[] = [
  { name: 'Owner', permissions: ALL },
  {
    name: 'Manager',
    permissions: ALL.filter((p) => p !== 'roles.manage'),
  },
  {
    name: 'Editor',
    permissions: [
      'websites.read',
      'collections.read',
      'entries.read',
      'entries.create',
      'entries.update',
      'entries.delete',
      'entries.publish',
      'media.read',
      'media.upload',
      'media.delete',
    ],
  },
  {
    name: 'Author',
    permissions: [
      'websites.read',
      'collections.read',
      'entries.read',
      'entries.create',
      'entries.update',
      'media.read',
      'media.upload',
    ],
  },
  {
    name: 'Viewer',
    permissions: ['websites.read', 'collections.read', 'entries.read', 'media.read'],
  },
];
