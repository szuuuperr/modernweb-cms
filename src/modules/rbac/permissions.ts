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

/**
 * Not granted by any website role — only the platform-role short-circuit in
 * PermissionsGuard reaches these.
 *
 * An API key authenticates the frontend that ModernWeb builds and deploys, and
 * a webhook ships content to an arbitrary URL under its own secret. Both are
 * platform infrastructure: the client has nowhere to install a key and no
 * reason to point a webhook anywhere. Leaving them on the Owner role would let
 * a client mint credentials over curl while the panel hides the menu — a
 * boundary that only looks like it exists.
 */
export const PLATFORM_ONLY_PERMISSIONS: Permission[] = [
  'apikeys.read',
  'apikeys.manage',
  'webhooks.read',
  'webhooks.manage',
];
const PLATFORM_ONLY = PLATFORM_ONLY_PERMISSIONS;

/** Owner keeps these; they hand out access, so a Manager must not. */
const OWNER_ONLY: Permission[] = ['roles.manage'];

const CLIENT_ALL: Permission[] = ALL.filter(
  (p) => !PLATFORM_ONLY.includes(p),
);

/** Default roles created for every new website. */
export const DEFAULT_ROLES: { name: string; permissions: Permission[] }[] = [
  { name: 'Owner', permissions: CLIENT_ALL },
  {
    name: 'Manager',
    permissions: CLIENT_ALL.filter((p) => !OWNER_ONLY.includes(p)),
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
