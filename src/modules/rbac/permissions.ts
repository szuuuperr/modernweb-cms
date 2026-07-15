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
  'pages.read',
  'pages.create',
  'pages.update',
  'pages.delete',
  'pages.publish',
  'menus.read',
  'menus.manage',
  'seo.read',
  'seo.manage',
  'settings.read',
  'settings.manage',
  'apikeys.read',
  'apikeys.manage',
  'webhooks.read',
  'webhooks.manage',
  'audit.read',
  'forms.read',
  'forms.manage',
  'submissions.read',
  'submissions.delete',
  'analytics.read',
  'preview.create',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

/** Handing these out mints credentials, so they stay with the Owner. */
const OWNER_ONLY: Permission[] = [
  'roles.manage',
  'apikeys.manage',
  // A webhook ships content to an arbitrary URL and carries its own secret.
  'webhooks.manage',
];

/** Default roles created for every new website. */
export const DEFAULT_ROLES: { name: string; permissions: Permission[] }[] = [
  { name: 'Owner', permissions: ALL },
  {
    name: 'Manager',
    permissions: ALL.filter((p) => !OWNER_ONLY.includes(p)),
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
      'pages.read',
      'pages.create',
      'pages.update',
      'pages.delete',
      'pages.publish',
      'menus.read',
      'menus.manage',
      'seo.read',
      'seo.manage',
      'settings.read',
      'forms.read',
      'forms.manage',
      'submissions.read',
      'submissions.delete',
      'analytics.read',
      'preview.create',
      'audit.read',
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
      'pages.read',
      'pages.create',
      'pages.update',
      'menus.read',
      'seo.read',
      'seo.manage',
      'settings.read',
      'forms.read',
      'submissions.read',
      // Authors need to see their own drafts rendered on the real frontend.
      'preview.create',
    ],
  },
  {
    name: 'Viewer',
    permissions: [
      'websites.read',
      'collections.read',
      'entries.read',
      'media.read',
      'pages.read',
      'menus.read',
      'seo.read',
      'settings.read',
      'forms.read',
      'analytics.read',
    ],
  },
];
