import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import {
  DEFAULT_ROLES,
  PLATFORM_ONLY_PERMISSIONS,
} from '../src/modules/rbac/permissions';
import {
  EntryStatus,
  FieldType,
  PageStatus,
  PlatformRole,
  PrismaClient,
  SeoTarget,
} from '../src/generated/prisma/client';

function mariaDbConfigFromUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectionLimit: 5,
  };
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(
    mariaDbConfigFromUrl(process.env.DATABASE_URL as string),
  ),
});

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { platformRole: PlatformRole.SUPER_ADMIN },
    create: {
      email: adminEmail,
      name: 'Super Admin',
      password: await bcrypt.hash(adminPassword, 10),
      platformRole: PlatformRole.SUPER_ADMIN,
    },
  });
  console.log(`Super admin: ${admin.email} (password: ${adminPassword})`);

  let website = await prisma.website.findUnique({
    where: { slug: 'halwa-travel' },
  });
  if (!website) {
    website = await prisma.website.create({
      data: {
        name: 'Halwa Travel',
        slug: 'halwa-travel',
        domain: 'halwatravel.com',
        roles: {
          create: DEFAULT_ROLES.map((role) => ({
            name: role.name,
            permissions: role.permissions,
          })),
        },
      },
    });
    console.log(`Website created: ${website.name}`);
  }

  // Roles seeded before a new phase added permissions would otherwise keep the
  // old set. Safe here because the seeded website's roles are never customised.
  for (const role of DEFAULT_ROLES) {
    await prisma.role.updateMany({
      where: { websiteId: website.id, name: role.name },
      data: { permissions: role.permissions },
    });
  }

  await ensureMember(admin.id, website.id, 'Owner');

  /**
   * A website owner who is NOT a platform admin.
   *
   * The super admin above is also an Owner member, but that membership is inert:
   * PermissionsGuard short-circuits for SUPER_ADMIN/PLATFORM_ADMIN and never
   * looks at the role. So logging in as the super admin exercises none of RBAC.
   * This account has platformRole NONE, so every permission it has comes from
   * the Owner role — which is what a real client owner looks like, and the only
   * way to see the panel behave as they will see it.
   */
  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? 'owner@halwatravel.com';
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? 'owner123';

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    // Left empty on purpose: a re-run must not clobber a password or a role the
    // user changed by hand while testing.
    update: {},
    create: {
      email: ownerEmail,
      name: 'Owner Halwa Travel',
      password: await bcrypt.hash(ownerPassword, 10),
      platformRole: PlatformRole.NONE,
    },
  });
  await ensureMember(owner.id, website.id, 'Owner');
  console.log(
    `Website owner: ${owner.email} (password: ${ownerPassword}) — platformRole NONE, Owner of ${website.slug}`,
  );

  let collection = await prisma.collection.findUnique({
    where: {
      websiteId_slug: { websiteId: website.id, slug: 'tour-packages' },
    },
  });
  if (!collection) {
    collection = await prisma.collection.create({
      data: {
        websiteId: website.id,
        name: 'Tour Packages',
        slug: 'tour-packages',
        description: 'Paket wisata Halwa Travel',
        fields: {
          create: [
            { name: 'Title', key: 'title', type: FieldType.TEXT, required: true, order: 0 },
            { name: 'Slug', key: 'slug', type: FieldType.TEXT, required: true, order: 1 },
            { name: 'Price', key: 'price', type: FieldType.NUMBER, required: true, order: 2, options: { min: 0 } },
            { name: 'Duration', key: 'duration', type: FieldType.TEXT, order: 3 },
            { name: 'Location', key: 'location', type: FieldType.TEXT, order: 4 },
            { name: 'Thumbnail', key: 'thumbnail', type: FieldType.MEDIA, order: 5 },
            { name: 'Description', key: 'description', type: FieldType.RICHTEXT, order: 6 },
            { name: 'Facilities', key: 'facilities', type: FieldType.JSON, order: 7 },
            { name: 'Status', key: 'status', type: FieldType.SELECT, order: 8, options: { choices: ['open', 'closed'] } },
          ],
        },
      },
    });
    console.log(`Collection created: ${collection.name}`);

    const now = new Date();
    await prisma.entry.createMany({
      data: [
        {
          websiteId: website.id,
          collectionId: collection.id,
          status: EntryStatus.PUBLISHED,
          publishedAt: now,
          data: {
            title: 'Bromo Sunrise Tour',
            slug: 'bromo-sunrise-tour',
            price: 1500000,
            duration: '3D2N',
            location: 'Bromo, Jawa Timur',
            description: '<p>Nikmati sunrise di Bromo.</p>',
            facilities: ['Hotel', 'Transport', 'Makan 3x'],
            status: 'open',
          },
        },
        {
          websiteId: website.id,
          collectionId: collection.id,
          status: EntryStatus.PUBLISHED,
          publishedAt: now,
          data: {
            title: 'Bali Beach Escape',
            slug: 'bali-beach-escape',
            price: 2750000,
            duration: '4D3N',
            location: 'Bali',
            description: '<p>Liburan pantai di Bali.</p>',
            facilities: ['Villa', 'Transport', 'Snorkeling'],
            status: 'open',
          },
        },
        {
          websiteId: website.id,
          collectionId: collection.id,
          status: EntryStatus.DRAFT,
          data: {
            title: 'Raja Ampat Adventure (Draft)',
            slug: 'raja-ampat-adventure',
            price: 8500000,
            duration: '5D4N',
            location: 'Raja Ampat, Papua Barat',
            status: 'closed',
          },
        },
      ],
    });
    console.log('Sample entries created (2 published, 1 draft)');
  }

  await seedFase2(website.id);
  await stripPlatformOnlyPermissions();
}

/**
 * Removes apikeys.* and webhooks.* from every website role, on every website.
 *
 * Roles are created from DEFAULT_ROLES at website-creation time, so websites
 * made before those permissions became platform-only still carry them — the
 * boundary would hold for new websites and leak on every existing one. The
 * per-website `updateMany` above only refreshes the seeded website.
 *
 * This strips rather than resets: it never grants anything, so it is safe to
 * run over roles an owner has customised. Anything else about their role is
 * left exactly as they set it.
 */
async function stripPlatformOnlyPermissions() {
  const roles = await prisma.role.findMany({
    select: { id: true, name: true, permissions: true, websiteId: true },
  });

  let stripped = 0;
  for (const role of roles) {
    const current = (role.permissions as string[]) ?? [];
    const cleaned = current.filter(
      (p) => !PLATFORM_ONLY_PERMISSIONS.includes(p as never),
    );
    if (cleaned.length === current.length) continue;

    await prisma.role.update({
      where: { id: role.id },
      data: { permissions: cleaned },
    });
    stripped++;
  }

  console.log(
    stripped > 0
      ? `Stripped apikeys.*/webhooks.* from ${stripped} role(s) — platform-only now`
      : 'No role carried platform-only permissions',
  );
}

/**
 * Gives a user a role on a website, idempotently. `update` is empty so a re-run
 * never demotes someone whose role was changed since the last seed.
 */
async function ensureMember(
  userId: string,
  websiteId: string,
  roleName: string,
) {
  const role = await prisma.role.findUnique({
    where: { websiteId_name: { websiteId, name: roleName } },
  });
  if (!role) return;

  await prisma.websiteUser.upsert({
    where: { userId_websiteId: { userId, websiteId } },
    update: {},
    create: { userId, websiteId, roleId: role.id },
  });
}

/** Pages, menus, SEO, settings and an API key for the seeded website. */
async function seedFase2(websiteId: string) {
  const homePage = await prisma.page.upsert({
    where: { websiteId_slug: { websiteId, slug: 'tentang-kami' } },
    update: {},
    create: {
      websiteId,
      title: 'Tentang Kami',
      slug: 'tentang-kami',
      status: PageStatus.PUBLISHED,
      publishedAt: new Date(),
      blocks: [
        {
          type: 'hero',
          props: {
            heading: 'Tentang Halwa Travel',
            subheading: 'Teman perjalanan Anda sejak 2015',
          },
        },
        {
          type: 'richtext',
          props: {
            html: '<p>Kami menyediakan paket wisata domestik dan internasional.</p>',
          },
        },
      ],
    },
  });
  console.log(`Page: ${homePage.slug} (${homePage.status})`);

  await prisma.websiteSeoDefault.upsert({
    where: { websiteId },
    update: {},
    create: {
      websiteId,
      titleTemplate: '%s | Halwa Travel',
      metaTitle: 'Halwa Travel — Paket Wisata Indonesia',
      metaDescription:
        'Paket wisata Bromo, Bali, Raja Ampat dan destinasi lainnya.',
    },
  });

  await prisma.seo.upsert({
    where: {
      targetType_targetId: { targetType: SeoTarget.PAGE, targetId: homePage.id },
    },
    update: {},
    create: {
      websiteId,
      targetType: SeoTarget.PAGE,
      targetId: homePage.id,
      metaTitle: 'Tentang Kami',
      metaDescription: 'Kenali Halwa Travel lebih dekat.',
    },
  });
  console.log('SEO defaults + page SEO set');

  const existingMenu = await prisma.menu.findUnique({
    where: { websiteId_slug: { websiteId, slug: 'main-nav' } },
  });
  if (!existingMenu) {
    const menu = await prisma.menu.create({
      data: { websiteId, name: 'Main Navigation', slug: 'main-nav' },
    });
    const packages = await prisma.menuItem.create({
      data: { menuId: menu.id, label: 'Paket Wisata', url: '/tour-packages', order: 0 },
    });
    await prisma.menuItem.createMany({
      data: [
        { menuId: menu.id, parentId: packages.id, label: 'Bromo', url: '/tour-packages/bromo-sunrise-tour', order: 0 },
        { menuId: menu.id, parentId: packages.id, label: 'Bali', url: '/tour-packages/bali-beach-escape', order: 1 },
        { menuId: menu.id, label: 'Tentang Kami', pageId: homePage.id, url: '/tentang-kami', order: 1 },
      ],
    });
    console.log('Menu "main-nav" created (1 nested level)');
  }

  const settings: { key: string; value: unknown }[] = [
    {
      key: 'contact',
      value: {
        phone: '+62 812 0000 0000',
        whatsapp: '+62 812 0000 0000',
        email: 'halo@halwatravel.com',
      },
    },
    {
      key: 'social',
      value: { instagram: 'halwatravel', facebook: 'halwatravel' },
    },
    { key: 'currency', value: 'IDR' },
  ];
  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { websiteId_key: { websiteId, key: setting.key } },
      update: {},
      create: { websiteId, key: setting.key, value: setting.value as never },
    });
  }
  console.log(`Settings seeded: ${settings.map((s) => s.key).join(', ')}`);

  const existingForm = await prisma.form.findUnique({
    where: { websiteId_slug: { websiteId, slug: 'kontak' } },
  });
  if (!existingForm) {
    await prisma.form.create({
      data: {
        websiteId,
        name: 'Kontak',
        slug: 'kontak',
        notifyEmails: ['sales@halwatravel.com'],
        fields: [
          { key: 'nama', name: 'Nama', type: FieldType.TEXT, required: true },
          { key: 'email', name: 'Email', type: FieldType.TEXT, required: true },
          { key: 'pesan', name: 'Pesan', type: FieldType.TEXTAREA, required: true },
          {
            key: 'topik',
            name: 'Topik',
            type: FieldType.SELECT,
            options: { choices: ['umum', 'kerjasama'] },
          },
        ],
      },
    });
    console.log('Form "kontak" created');
  }

  const hasKey = await prisma.apiKey.findFirst({ where: { websiteId } });
  if (!hasKey) {
    const prefix = `mwc_${randomBytes(4).toString('hex')}`;
    const plaintext = `${prefix}_${randomBytes(24).toString('base64url')}`;
    await prisma.apiKey.create({
      data: {
        websiteId,
        name: 'Seed development key',
        prefix,
        keyHash: await bcrypt.hash(plaintext, 10),
      },
    });
    // Only ever printed here: the API stores a hash and cannot show it again.
    console.log(`API key (dev, save it now): ${plaintext}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Seed complete.');
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
