# ModernWeb CMS — Rencana & Roadmap

> Dokumen acuan arsitektur dan roadmap produk. Fase 1 (MVP) sudah diimplementasi.

## Visi

ModernWeb CMS adalah **platform headless CMS multi-website**: satu backend (NestJS + MySQL + Docker) di `api.modernwebid.com` melayani banyak frontend Next.js independen (ModernWeb, Halwa Travel, Notaris ABC, Garis Tour, dst). Backend hanya mengenal konsep generik — Website, Collection, Field, Entry, Media, User/RBAC — sehingga onboarding jenis bisnis baru **tidak butuh perubahan backend**. Fitur bisnis spesifik (booking, payment, membership) tetap menjadi tanggung jawab aplikasi klien.

```
                 ModernWeb CMS (NestJS + MySQL + Docker)
                        api.modernwebid.com
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

## Fase 2 — Content Platform Lengkap ✅ (selesai)

- [x] Pages: slug + blocks JSON + status, publish/unpublish + domain events (`page.published`)
- [x] Menus: `Menu` + `MenuItem` self-relation (parentId/order), tree dirakit saat dibaca, endpoint reorder untuk drag-drop
- [x] SEO: tabel `seo` polymorphic (`targetType` PAGE/ENTRY + `targetId`) + default per website (`titleTemplate`)
- [x] Settings per website (key → nilai JSON apa pun)
- [x] API Keys per website (hash bcrypt, plaintext hanya tampil sekali) + `ApiKeyGuard` + rate limit public Content API
- [x] Public Content API diperluas: pages, menus, settings, seo defaults; entry & page membawa `seo` hasil merge

### Keputusan Fase 2

1. **SEO = tabel polymorphic**, bukan kolom JSON di Page/Entry: satu tempat untuk semua SEO, bisa di-query lintas tipe, konten entry tetap murni. Konsekuensi: tidak ada FK cascade — `PagesService.remove` / `EntriesService.remove` memanggil `SeoService.removeForTarget`, dan `SeoService` memvalidasi target milik website yang benar.
2. **Menu = tabel MenuItem self-relation**, bukan JSON tree: reorder/edit per item mudah (drag-drop admin fase 5), integritas dijaga DB. Cycle dicegah di service (`ensureNoCycle` + validasi payload reorder).
3. **API key opsional, flag `Website.requireApiKey`** (default false): frontend lama tetap jalan, website bisa opt-in bertahap. Key yang tidak valid **selalu** ditolak 401 walau opsional, supaya klien salah konfigurasi tidak diam-diam jadi anonim.
4. **Rate limit** (`@nestjs/throttler`) hanya di Content API, bucket per API key bila ada, jika tidak per IP. Default 120 req/menit (`CONTENT_RATE_LIMIT`, `CONTENT_RATE_TTL_MS`).
5. **Permission baru**: `pages.*`, `menus.*`, `seo.*`, `settings.*`, `apikeys.*`. `apikeys.manage` & `roles.manage` sengaja Owner-only (keduanya mencetak kredensial).

## Fase 3 — Media & Performa ✅ (selesai)

- [x] `CloudinaryStorageAdapter` — implementasi kedua `StorageAdapter`, dipilih lewat `STORAGE_DRIVER=local|cloudinary`
- [x] Image processing lewat transformasi Cloudinary (`w_320`/`w_1024`, `f_auto`, `q_auto`) — URL varian disimpan di `Media.variants`
- [x] Cache public Content API: Redis bila `REDIS_URL` diset, fallback in-memory bila tidak
- [x] Invalidasi cache via event `content.changed` (semua mutasi konten, bukan cuma publish)
- [x] Webhooks: `Webhook` + `WebhookDelivery`, HMAC `x-mwc-signature`, retry 3x backoff, log pengiriman

### Keputusan Fase 3

1. **Cloudinary menggantikan sharp** (menyimpang dari rencana awal, disetujui user). Cloudinary menderivasi varian on-the-fly di CDN-nya, jadi resize di backend cuma kerja dobel + butuh native build sharp di Windows. Upload sekali (original), varian dihasilkan lewat URL. Konsekuensi yang harus diterima: kalau nanti pindah dari Cloudinary, varian hilang dan sharp masuk lagi.
2. **`StoredFile.variants` opsional** — supaya `MediaService` tetap tidak tahu-menahu soal provider (sesuai amanat "tanpa ubah MediaService"). Adapter yang tidak bisa menderivasi varian (Local) cukup mengabaikannya.
3. **Redis opsional, `CacheStore` pakai pola Adapter** yang sama dengan `StorageAdapter`: `RedisCacheStore` bila `REDIS_URL` ada, `MemoryCacheStore` bila tidak. Semua kegagalan Redis ditelan jadi cache-miss — cache bukan sumber kebenaran, jadi Redis mati tidak boleh menjatuhkan request. **Wajib `enableOfflineQueue: false` + `commandTimeout`**: tanpa itu ioredis mengantre perintah selama koneksi putus dan request ikut menggantung (terukur: 2 dari 5 request gagal >10s). Jangan dihapus.
4. **Invalidasi pakai version counter per website**, bukan wildcard delete: kunci cache memuat `v{n}`, invalidasi = satu `INCR`. Tidak butuh `SCAN`/pattern delete, jadi jalan di store mana pun. Payload lama kedaluwarsa sendiri lewat TTL.
5. **Event `content.changed` menggantikan rencana "invalidasi via `entry.published`"**. Kalau hanya publish yang memicu invalidasi, mengedit entry/page yang sudah published akan menyajikan konten basi sampai TTL habis — justru kasus paling sering. Satu event generik (`{resource}.{action}`) dipakai dua konsumen: cache (invalidasi) dan webhook (nama langganan). Event `entry.published`/`page.published` lama tetap ada, tidak ada yang dirusak.
6. **Webhook in-process & detached**: EventEmitter2 tidak menunggu handler, jadi receiver lambat/mati tidak memperlambat API. Balasan 4xx (selain 429) tidak di-retry — receiver menolak, mengulang tidak menolong. `webhooks.manage` Owner-only (mengirim konten ke URL sembarang + memegang secret); secret hanya ditampilkan saat create & rotate.

## Fase 4 — Operasional & Produk ✅ (selesai, kecuali eksekusi deploy di VPS)

- [x] Forms: `Form` (fields JSON) + `FormSubmission`, submit publik, notifikasi email SMTP async
- [x] Analytics: counter harian `page_views` (upsert increment) + ringkasan per rentang tanggal
- [x] Audit log: `audit_logs` dari `content.changed` + `audit.action`, actor lewat AsyncLocalStorage
- [x] Draft preview token: JWT ber-scope website, TTL pendek, **bypass cache**
- [x] `GET /api/v1/health` untuk healthcheck container & load balancer
- [x] Konfigurasi produksi terpisah (`docker-compose.prod.yml`) + TLS + runbook `docs/DEPLOY.md`
- [ ] **Eksekusi deploy di VPS** — hanya bisa dilakukan pemilik VPS; lihat `docs/DEPLOY.md`

### Keputusan Fase 4

1. **Actor lewat AsyncLocalStorage**, bukan parameter di tiap service: `ContentChangedEvent`/`AuditEvent` membaca actor **saat konstruksi**, jadi tidak ada emitter yang bisa lupa mengirimnya dan nol signature service berubah. Konsekuensi: konteks implisit — di luar request (seed/cron) actor `null`, dan itu memang benar.
2. **Dua sumber audit**: `content.changed` (mutasi konten, sudah ada sejak Fase 3) + `audit.action` (aksi keamanan: apikey, webhook, role, member). Sengaja dipisah — rotasi API key tidak boleh membuang cache website atau memicu webhook.
3. **Forms memakai ulang `EntryValidator`**, bukan validator kedua. `FieldTypeStrategy` dilonggarkan dari `Field` (baris Prisma) ke `FieldDefinition` (subset struktural), sehingga strategy yang sama memvalidasi entry (baris `fields`) dan form (definisi JSON). Menambah tipe field baru tetap cukup satu strategy.
4. **Analytics = counter harian**, bukan baris per kunjungan: tabel tidak meledak, query murah. Konsekuensi diterima: tidak ada analisis per-kunjungan (jam sibuk, referrer). Path dinormalisasi (query string & hash dibuang) agar `/a?utm=x` dan `/a` tidak jadi dua baris.
5. **Preview = JWT ber-scope**, bukan baris token di DB: tidak ada yang perlu dibersihkan, kedaluwarsa sendiri, dan token website A tidak membuka draft website B. **Wajib bypass cache** — kalau tidak, draft akan tersaji ke pengunjung anonim berikutnya lewat kunci cache yang sama.
6. **Prod dipisah total dari dev** (`docker-compose.prod.yml`, bukan profile): profile lama membuat app prod boot ke database dev dengan password dev. Prod punya volume sendiri, MySQL tidak mengekspos port, dan secret wajib (`${JWT_SECRET:?}`) sehingga stack menolak start dengan nilai kosong.
7. **`TRUST_PROXY` wajib di belakang nginx**: tanpa itu `req.ip` = IP nginx, sehingga rate limit publik memperlakukan seluruh pengunjung anonim sebagai satu klien dan audit log mencatat IP salah. Default mati — mempercayai `X-Forwarded-For` tanpa proxy di depan justru membuat IP bisa dipalsukan.

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
