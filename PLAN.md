# ModernWeb CMS — Rencana & Roadmap

> Dokumen acuan arsitektur dan roadmap produk. Fase 1 (MVP) sudah diimplementasi.

## Visi

ModernWeb CMS adalah **platform headless CMS multi-website**: satu backend (NestJS + MySQL + Docker) di `api.modernwebcms.com` melayani banyak frontend Next.js independen (ModernWeb, Halwa Travel, Notaris ABC, Garis Tour, dst). Backend hanya mengenal konsep generik — Website, Collection, Field, Entry, Media, User/RBAC — sehingga onboarding jenis bisnis baru **tidak butuh perubahan backend**. Fitur bisnis spesifik (booking, payment, membership) tetap menjadi tanggung jawab aplikasi klien.

```
                 ModernWeb CMS (NestJS + MySQL + Docker)
                        api.modernwebcms.com
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
         ModernWeb         Halwa Travel      Notaris ABC
          Next.js            Next.js           Next.js
          (Vercel)           (Vercel)          (Vercel)
```

## Keputusan Arsitektur

1. **Entry storage = kolom JSON** (bukan EAV): tabel `entries` punya kolom `data JSON`; schema didefinisikan di tabel `fields` dan divalidasi backend. Query sederhana, 1 entry = 1 baris.
2. **Multi-tenant satu database**: semua data ter-scope `websiteId`.
3. **RBAC**: role = kumpulan permission string (`entries.publish`, `media.upload`, …). Platform role (SUPER_ADMIN/PLATFORM_ADMIN/SUPPORT) terpisah dari website role (Owner/Manager/Editor/Author/Viewer).
4. **Backend API dulu**; admin panel Next.js menyusul sebagai repo terpisah.

## Design Pattern — diterapkan pragmatis

| Pattern | Penerapan konkret |
|---|---|
| Modular Monolith | 1 module per domain di `src/modules/` |
| Dependency Injection | Native NestJS |
| Service Pattern | Application service per module |
| Repository Pattern | `EntriesRepository` — service tidak menyentuh Prisma langsung |
| Strategy Pattern | 1 strategy per field type (`src/modules/entries/domain/field-types/`) |
| Factory Pattern | `FieldTypeRegistry` me-resolve strategy dari `field.type` |
| Adapter Pattern | `StorageAdapter` → `LocalStorageAdapter` (MinIO/Cloudinary menyusul) |
| Builder Pattern | `EntryQueryBuilder` untuk filter/sort/paginate kolom JSON |
| Event Driven | `@nestjs/event-emitter` — `entry.published` / `entry.unpublished` |
| Clean Architecture | Diperingan: layer `domain/` hanya di module dengan logika nyata (entries) |

## Fase 1 — MVP Inti ✅ (selesai)

- [x] Auth JWT (register/login/refresh) + guard global
- [x] Users + platform roles
- [x] RBAC: roles, permissions, PermissionsGuard per website
- [x] Websites CRUD + members + default roles otomatis
- [x] Collections + Fields (schema builder dinamis)
- [x] Entries: validasi via field-type strategies, filter/sort JSON, publish/unpublish + domain events
- [x] Media upload (local storage adapter) + serve `/uploads`
- [x] Public Content API (read-only, hanya PUBLISHED)
- [x] Docker Compose (MySQL dev; app+mysql+nginx profile prod), Dockerfile multi-stage
- [x] Seed: super admin, website Halwa Travel, collection tour-packages

## Fase 2 — Content Platform Lengkap

- Pages (halaman statis per website: slug, blocks/sections JSON, status)
- Menus (struktur menu nested per website)
- SEO module (meta title/description/OG per entry/page + default per website)
- Settings per website (key-value)
- API Keys per website + guard untuk public Content API (rate limit dasar)

## Fase 3 — Media & Performa

- Adapter MinIO/Cloudinary (implementasi kedua `StorageAdapter` — tanpa ubah MediaService)
- Image processing (resize/thumbnail via sharp)
- Redis cache untuk public Content API + invalidasi via event `entry.published`
- Webhooks (trigger revalidate Next.js ISR saat konten berubah)

## Fase 4 — Operasional & Produk

- Forms module (form builder + submission + notifikasi email)
- Analytics dasar (page views per website)
- Audit log (siapa mengubah apa, berbasis domain events)
- Draft preview token untuk frontend
- Deploy produksi: VPS + Docker Compose (NestJS + MySQL + Redis + Nginx) di `api.modernwebcms.com`

## Fase 5 — Admin Panel (repo terpisah)

- Next.js + TypeScript + TailwindCSS, repo `modernweb-cms-admin`
- Login, manajemen website, collection builder (drag-drop field), entry editor dinamis (form dirender dari definisi fields), media library, user & role management

## Workflow Client Baru

1. Platform admin membuat website baru di CMS (`POST /websites`) → default roles otomatis dibuat
2. Tambahkan owner sebagai member (`POST /websites/:id/members`)
3. Owner membuat collections + fields sesuai kebutuhan bisnisnya
4. Isi konten (entries, media)
5. Buat project Next.js baru → konsumsi `GET /api/v1/content/{website}/collections/{collection}/entries`
6. Deploy ke Vercel → website online — **tanpa membuat backend baru**
