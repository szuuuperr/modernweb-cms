import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_ROLES } from '../src/modules/rbac/permissions';
import {
  EntryStatus,
  FieldType,
  PlatformRole,
  PrismaClient,
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

  const ownerRole = await prisma.role.findUnique({
    where: { websiteId_name: { websiteId: website.id, name: 'Owner' } },
  });
  if (ownerRole) {
    await prisma.websiteUser.upsert({
      where: {
        userId_websiteId: { userId: admin.id, websiteId: website.id },
      },
      update: {},
      create: {
        userId: admin.id,
        websiteId: website.id,
        roleId: ownerRole.id,
      },
    });
  }

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
