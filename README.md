# ModernWeb CMS

Multi-website **headless CMS** — satu backend NestJS + MySQL melayani banyak website frontend (Next.js di Vercel) sekaligus. Konten dikelola lewat *dynamic collections* sehingga jenis bisnis baru tidak butuh perubahan backend.

## Stack

- **NestJS 11** (TypeScript, modular monolith)
- **Prisma 7** + **MySQL 8** (Docker) — driver adapter `@prisma/adapter-mariadb`
- **JWT** auth (access + refresh) + **RBAC** per website
- **Swagger** di `/docs`

## Menjalankan (development)

```bash
# 1. Salin env
cp .env.example .env

# 2. Jalankan MySQL (port host 3307)
docker compose up -d mysql

# 3. Migrasi + seed
npx prisma migrate dev
npx prisma db seed

# 4. Start
npm run start:dev
```

API: `http://localhost:3000/api/v1` — Swagger: `http://localhost:3000/docs`

Login super admin: lihat `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` di `.env`.

## Menjalankan (production, Docker penuh)

```bash
docker compose --profile prod up -d --build
```

Menjalankan NestJS + MySQL + Nginx (port 80).

## Konsep

```
Website ─── Collection ─── Field (definisi schema)
   │            └───────── Entry (data JSON, divalidasi terhadap Field)
   ├── Role / WebsiteUser (RBAC per website)
   └── Media
```

- Semua data ter-scope `websiteId` (multi-tenant, satu database).
- **Entry data** disimpan sebagai kolom JSON dan divalidasi oleh *field-type strategies* (Strategy + Factory pattern).
- **Public Content API** (tanpa auth, hanya entry `PUBLISHED`):
  `GET /api/v1/content/{websiteSlug}/collections/{collectionSlug}/entries`
  - Filter: `?filter[price][gte]=1000000` (ops: `eq, ne, gt, gte, lt, lte, contains`)
  - Sort: `?sort=publishedAt:desc` — Pagination: `?page=1&limit=20`

## Struktur

```
src/
├── common/            # decorators, DTO pagination, tipe bersama
├── infrastructure/
│   ├── prisma/        # PrismaService (driver adapter MariaDB)
│   └── storage/       # StorageAdapter (Adapter pattern; Local → MinIO/Cloudinary)
└── modules/
    ├── auth/          # JWT login/register/refresh
    ├── users/         # manajemen user platform
    ├── rbac/          # permissions, roles, guards
    ├── websites/      # website + members
    ├── collections/   # collections + fields (schema builder)
    ├── entries/       # data konten dinamis (Strategy/Factory/Builder + domain events)
    ├── media/         # upload file
    └── content/       # PUBLIC read-only API untuk frontend
```

Roadmap lengkap: lihat [PLAN.md](./PLAN.md).
