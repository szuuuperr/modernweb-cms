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
   ├── Page (blocks JSON) ── Menu ── MenuItem (nested)
   ├── Setting (key → JSON) ── ApiKey
   ├── Seo (polymorphic: PAGE | ENTRY) + default SEO per website
   └── Media
```

- Semua data ter-scope `websiteId` (multi-tenant, satu database).
- **Entry data** disimpan sebagai kolom JSON dan divalidasi oleh *field-type strategies* (Strategy + Factory pattern).
- **Page blocks** bebas bentuk (`[{ type, props }]`) — menambah tipe block tidak butuh perubahan backend.
- **SEO** disimpan sekali per target dan di-*merge* dengan default website saat dibaca publik (`titleTemplate: "%s | Halwa Travel"`).

### Public Content API

Read-only, hanya konten `PUBLISHED` dari website `ACTIVE`.

| Endpoint | Keterangan |
|---|---|
| `GET /api/v1/content/{website}/collections/{collection}/entries` | filter/sort/paginate, tiap item membawa `seo` |
| `GET /api/v1/content/{website}/collections/{collection}/entries/{id}` | satu entry |
| `GET /api/v1/content/{website}/pages` | daftar page (tanpa `blocks`) |
| `GET /api/v1/content/{website}/pages/{slug}` | page + `blocks` + `seo` |
| `GET /api/v1/content/{website}/menus/{menuSlug}` | menu sebagai tree nested |
| `GET /api/v1/content/{website}/settings` | map `key → value` |
| `GET /api/v1/content/{website}/seo/defaults` | default SEO website |
| `POST /api/v1/content/{website}/forms/{formSlug}/submit` | kirim form (divalidasi terhadap definisi field) |
| `POST /api/v1/content/{website}/analytics/page-view` | catat page view (`{ "path": "/..." }`) |

- Filter: `?filter[price][gte]=1000000` (ops: `eq, ne, gt, gte, lt, lte, contains`)
- Sort: `?sort=publishedAt:desc` — Pagination: `?page=1&limit=20`
- **API key**: opsional secara default. Set `requireApiKey: true` pada website (`PATCH /websites/{id}`) agar header `x-api-key` wajib. Key dibuat lewat `POST /websites/{id}/api-keys` dan **hanya ditampilkan sekali**.
- **Rate limit**: 120 req/menit per API key (atau per IP bila anonim) — atur via `CONTENT_RATE_LIMIT` / `CONTENT_RATE_TTL_MS`.
- **Cache**: semua response di atas di-cache per website (TTL `CONTENT_CACHE_TTL`, default 60s) dan langsung dibuang begitu konten website itu berubah.
- **Preview draft**: tambahkan `?preview=<token>` pada endpoint entries/pages untuk melihat konten `DRAFT`. Token dibuat lewat `POST /websites/{id}/preview-tokens` (TTL `PREVIEW_TOKEN_TTL`, default 1 jam), ter-scope ke satu website, dan request preview **tidak di-cache**.

## Forms, Analytics & Audit

- **Forms** — definisi field memakai tipe yang sama dengan collection (`TEXT`, `SELECT`, …) dan divalidasi oleh *strategy* yang sama. Submission publik disimpan, lalu notifikasi email dikirim **di luar jalur request** (SMTP lambat/mati tidak menggagalkan submit). Isi `SMTP_HOST` untuk mengaktifkan; kalau kosong, email hanya di-log.
- **Analytics** — `POST .../analytics/page-view` menambah counter harian per (website, path, hari). Query string & hash dinormalisasi. Baca ringkasannya di `GET /websites/{id}/analytics/page-views?from=&to=&path=`.
- **Audit log** — `GET /websites/{id}/audit-logs?resource=&action=&actorId=&from=&to=`. Append-only, tanpa endpoint tulis. Mencatat mutasi konten (dari event `content.changed`) dan aksi keamanan (api key, webhook, role, member). Pelakunya diambil dari request context (AsyncLocalStorage), jadi tidak ada service yang perlu mengoper parameter `actor`.

## Deploy produksi

Lihat **[docs/DEPLOY.md](./docs/DEPLOY.md)**. Ringkasnya: `docker-compose.prod.yml` (terpisah dari compose dev — beda database, beda volume, secret wajib), TLS Let's Encrypt di nginx, dan `GET /api/v1/health` untuk healthcheck.

## Media & Storage

`STORAGE_DRIVER` menentukan implementasi `StorageAdapter` — `MediaService` tidak berubah sama sekali:

- `local` (default) — simpan ke disk, disajikan lewat `/uploads`.
- `cloudinary` — upload ke Cloudinary; varian gambar diderivasi on-the-fly di CDN-nya (`f_auto` = WebP/AVIF per browser, `q_auto` = kompresi otomatis), bukan di backend. Isi `CLOUDINARY_URL` di `.env`.

Response upload membawa `variants` untuk gambar raster (SVG & PDF tidak):

```json
{
  "url": "https://res.cloudinary.com/.../v1/<website-id>/abc123.jpg",
  "variants": {
    "thumb":  "https://res.cloudinary.com/.../c_limit,f_auto,q_auto,w_320/v1/<website-id>/abc123",
    "medium": "https://res.cloudinary.com/.../c_limit,f_auto,q_auto,w_1024/v1/<website-id>/abc123"
  }
}
```

## Cache

- Tanpa `REDIS_URL` → cache in-memory (cukup untuk dev / satu instance).
- Dengan `REDIS_URL` → Redis, supaya beberapa instance berbagi cache. Redis mati **tidak** menjatuhkan request: perintah gagal seketika (`enableOfflineQueue: false`, `commandTimeout: 500ms`) dan turun jadi cache-miss — terukur ~12ms, bukan menggantung. Diuji dengan mematikan container Redis saat runtime.
- Invalidasi: setiap perubahan konten memicu event `content.changed`, dan cache untuk website itu dibuang seketika — termasuk saat **mengedit** entry/page yang sudah published, bukan cuma saat publish.

## Webhooks

Untuk memicu revalidate ISR di Next.js saat konten berubah.

```bash
POST /api/v1/websites/{id}/webhooks
{ "name": "ISR revalidate", "url": "https://situs.com/api/revalidate",
  "events": ["entry.published", "page.published"] }
```

- Daftar event yang bisa dilanggan: `GET /websites/{id}/webhooks/events`.
- Payload ditandatangani HMAC-SHA256 di header `x-mwc-signature: sha256=<hex>`; verifikasi di penerima dengan `secret` yang diberikan **sekali** saat create (atau `POST /{webhookId}/rotate-secret`).
- Retry 3x (1s, 5s, 25s). Balasan 4xx selain 429 tidak diulang.
- Riwayat pengiriman: `GET /websites/{id}/webhooks/{webhookId}/deliveries`.

## Struktur

```
src/
├── common/            # decorators, DTO pagination, request context (CLS), domain events
├── infrastructure/
│   ├── prisma/        # PrismaService (driver adapter MariaDB)
│   ├── cache/         # CacheStore (Adapter pattern; Memory ↔ Redis) + CacheService
│   ├── mailer/        # MailerAdapter (Adapter pattern; SMTP → provider API menyusul)
│   └── storage/       # StorageAdapter (Adapter pattern; Local ↔ Cloudinary)
└── modules/
    ├── auth/          # JWT login/register/refresh
    ├── users/         # manajemen user platform
    ├── rbac/          # permissions, roles, guards
    ├── websites/      # website + members
    ├── collections/   # collections + fields (schema builder)
    ├── entries/       # data konten dinamis (Strategy/Factory/Builder + domain events)
    ├── media/         # upload file
    ├── pages/         # halaman statis (blocks JSON) + domain events
    ├── menus/         # menu nested (MenuItem self-relation) + reorder
    ├── seo/           # SEO polymorphic (PAGE/ENTRY) + default per website
    ├── settings/      # key-value per website
    ├── api-keys/      # API key per website + ApiKeyGuard
    ├── webhooks/      # webhook + HMAC signing, retry, delivery log
    ├── forms/         # form builder + submission + notifikasi email
    ├── analytics/     # page view counter harian
    ├── audit/         # audit log (append-only, dari domain events)
    ├── preview/       # token preview draft
    ├── health/        # GET /health untuk healthcheck
    └── content/       # PUBLIC API untuk frontend (cached; submit form & track view)
```

Roadmap lengkap: lihat [PLAN.md](./PLAN.md).
