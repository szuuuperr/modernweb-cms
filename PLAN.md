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

## Fase 5 — Admin Panel (repo terpisah) 🚧

Repo: `C:\project\modernweb-cms-admin` — Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4, dideploy ke Vercel di `cms.modernwebid.com`.

- [x] Login + sesi (access token di memory, refresh via httpOnly cookie)
- [x] Manajemen website (list, buat, edit, status, requireApiKey)
- [x] Collection builder + drag-drop field (dnd-kit)
- [x] Entry editor dinamis — form dirender dari definisi fields, 10 FieldType
- [x] Media library (upload, hapus, varian thumbnail)
- [x] Anggota & role (editor permission per resource)
- [x] Users + platform role
- [x] `noindex, nofollow` + `robots.txt` Disallow
- [x] Design system (`design.md` + token `@theme`, primary `#00419c`, Poppins)
- [x] **UI modul Fase 2**: Pages (editor block), Menus (tree drag-drop), SEO (defaults + per page/entry), Settings (key→JSON), API Keys (plaintext sekali tampil)
- [x] **UI modul Fase 3**: Webhooks (CRUD, pemilih event dari API, secret sekali tampil + rotate, log kiriman dengan payload & error). Cloudinary/cache/invalidasi tidak punya layar — semuanya konfigurasi backend; varian Cloudinary sudah dipakai media library.
- [x] **UI modul Fase 4**: Forms (builder field + notifikasi email) & submissions (+ ekspor CSV), Analytics (chart harian + path terpopuler), Audit log (filter + detail), tombol Preview di editor page/entry
- [ ] Deploy ke Vercel + set `ADMIN_ORIGINS` di API produksi

### Perubahan di repo backend untuk Fase 5

1. **Refresh token pindah ke httpOnly cookie** (`mwc_rt`, `Path=/api/v1/auth`, host-only). `login`/`register` men-set cookie dan **tidak lagi mengembalikan `refreshToken` di body**; `refresh` membaca cookie (body tetap jadi fallback untuk klien non-browser); `logout` baru untuk menghapusnya.
2. **CORS jadi delegate**: `credentials: true` hanya untuk origin di `ADMIN_ORIGINS`. Origin lain tetap dapat akses terbuka tanpa cookie seperti sebelumnya, supaya Content API publik tidak rusak.
3. **`GET /websites/:websiteId/me`** — permission efektif user di satu website, supaya admin panel bisa merender hanya kontrol yang boleh dipakai. Sengaja tanpa `@RequirePermissions`.
4. **`allowPublicKeyRetrieval` di `DATABASE_URL`** — MySQL 8 memakai `caching_sha2_password`; tanpa opsi ini driver mariadb gagal connect ke database dev lewat socket non-TLS.

### Keputusan Fase 5

1. **CSR penuh, bukan static export.** Semua halaman dashboard `'use client'`, tapi tetap app Next biasa (bukan `output: 'export'`) supaya proxy/middleware, image optimization, dan route handler tersedia bila nanti dibutuhkan. **`app/layout.tsx` wajib tetap Server Component** — `export const metadata` diabaikan di client component, dan export itulah yang menghasilkan `noindex`.
2. **Access token di memory + refresh di httpOnly cookie.** Menyimpan token di localStorage membuatnya terbaca script mana pun kalau ada XSS — ini panel super admin multi-tenant. `JwtStrategy` **tidak diubah**: access token tetap lewat `Authorization: Bearer`, sehingga tidak ada permukaan CSRF (cookie saja tidak mengautentikasi apa pun selain `/auth/refresh`). Konsekuensi: reload tab selalu mulai tanpa token, jadi `AuthProvider` menukar cookie jadi token dulu sebelum memutuskan user anonim.
3. **`SameSite=Lax` cukup** karena `cms.` dan `api.modernwebid.com` itu same-site. **Deployment preview Vercel (`*.vercel.app`) beda registrable domain** dan butuh `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true`, kalau tidak login-nya gagal senyap.
4. **Guard login di client, bukan proxy/middleware.** Cookie host-only ke `api.` tidak pernah terlihat oleh `cms.`, dan memverifikasi JWT di edge butuh `JWT_SECRET` yang tidak boleh dikopi ke Vercel. `AuthGuard` hanya redirect demi UX; yang menegakkan tetap backend.
5. **Permission UI hanya kosmetik.** `useCan` menyembunyikan tombol yang pasti 403. `PermissionsGuard` di backend tetap satu-satunya gerbang.
6. **Validasi entry di client hanya cek `required`.** Tipe/range/choices diserahkan ke field-type strategies backend — menduplikasi aturannya berarti dua validator yang pasti menyimpang, dan pesan error backend sudah spesifik ("must be one of: …") sehingga ditampilkan apa adanya.
7. **Reorder field = PATCH per field.** Tidak seperti `MenuItem`, `Field` tidak punya endpoint reorder; hanya field yang indeksnya benar-benar berubah yang dikirim.
8. **`options.collectionId` pada field RELATION murni untuk UI.** `RelationStrategy` menerima id entry mana pun tanpa mengecek collection tujuan, jadi opsi ini hanya memberi tahu editor pilihan mana yang ditawarkan.
9. **Editor block bersifat generik (tipe + JSON props), bukan form per tipe.** Kontrak `PageBlockDto` hanya menjamin `type`; `props` sengaja bebas supaya tipe block baru tidak butuh perubahan backend. Form khusus per tipe berarti admin harus tahu setiap tipe block milik setiap klien — justru yang dihindari desain ini. Block juga diberi id sisi-klien hanya untuk drag-drop: block tidak punya identitas di database (hidup di satu kolom JSON), dan index array akan rusak begitu dua block bertukar posisi.
10. **Menu: drag hanya mengurutkan antar-saudara; pindah induk lewat form.** Drag lintas level mudah dipicu tidak sengaja dan mahal dibuat benar. Pilihan induk menyembunyikan diri sendiri + keturunannya, jadi siklus tidak pernah ditawarkan (backend tetap menolaknya lewat `ensureNoCycle`). Satu drag = satu PUT `reorder` (whole-tree), berbeda dari field yang harus PATCH satu per satu.
11. **`GET /seo/:type/:id` melempar 404 kalau target belum punya SEO** — itu kondisi normal untuk page/entry yang baru dibuat. `useSeo` menangkapnya jadi `null` supaya panel menampilkan form kosong, bukan banner error. Panel SEO di-key ke `targetId`, **bukan** ke id baris SEO: penyimpanan pertama mengubah `data` dari null jadi baris, dan key berbasis id akan me-remount form tepat saat itu sehingga konfirmasi "Tersimpan" hilang.
12. **`apiFetch` wajib tahan body kosong.** Nest menyerialisasi `null` sebagai 200 tanpa body (mis. SEO defaults yang belum pernah diset), dan `JSON.parse("")` melempar. Client membaca `text()` dulu lalu memperlakukan kosong sebagai "tidak ada nilai".
13. **Daftar event webhook diambil dari `GET /webhooks/events`, bukan disalin ke frontend.** Backend menolak apa pun di luar daftarnya (`@IsIn`), jadi salinan yang menyimpang hanya menghasilkan simpan gagal. Bandingkan dengan `lib/permissions.ts` yang memang disalin karena tidak ada endpoint-nya.
14. **Secret webhook & API key memakai pola "reveal sekali" yang sama**, karena konsekuensinya sama: backend hanya menyimpan nilai yang tidak bisa dipulihkan. Rotate secret diberi peringatan lebih keras — secret lama langsung mati dan receiver menolak semua kiriman sampai yang baru dipasang.
15. **Chart analytics memakai `primary-600` (#0052cc), bukan primary-700.** Terukur, bukan selera: `#00419c` ada di OKLCH L 0.402, di bawah band mark 0.43–0.77; `primary-600` step pertama di ramp yang sama yang lolos band + chroma floor + kontras ≥3:1. Tombol tetap primary-700 — chrome UI, bukan mark data. Chart-nya single-series: tanpa legend, satu hue untuk semua batang, label langsung hanya di puncak, plus tampilan tabel sebagai jalur tanpa hover. Detail di `design.md` repo admin.
16. **Tidak ada tautan preview ke frontend.** CMS tidak tahu route preview website klien, dan tautan tebakan yang 404 lebih buruk daripada tidak ada tautan. Panel memberi token + URL Content API (`?preview=`) yang pasti jalan, lalu menjelaskan frontend harus meneruskannya sendiri.
17. **Anggota tidak bisa mengubah/menghapus keanggotaannya sendiri** (`MembersService.ensureNotSelf`, 400). Menurunkan diri sendiri itu pintu satu arah: begitu role kehilangan `members.manage`, membatalkannya butuh orang lain — satu klik bisa mengunci owner terakhir dan hanya platform admin yang bisa menyelamatkan. **Actor di-oper eksplisit dari controller**, bukan dibaca dari `RequestContextStore`: aturan otorisasi yang bergantung pada state implisit akan diam-diam lolos di tempat state itu tidak ada (seed/cron) — persis tempat kesalahan tidak akan ketahuan. (ALS tetap khusus audit.)
18. **Platform admin di daftar anggota ditampilkan + diberi badge + role-nya dikunci di UI**, bukan disembunyikan atau ditolak di API. `PermissionsGuard` short-circuit untuk SUPER_ADMIN/PLATFORM_ADMIN, jadi role website mereka **tidak memberi apa pun dan mengubahnya tidak mencabut apa pun** — terverifikasi: owner menurunkan super admin jadi Viewer, super admin tetap 38 permission dan tetap 200 di rute Owner-only. Karena itu `MEMBER_INCLUDE` kini mengekspos `platformRole`. Menyembunyikan mereka justru kurang transparan (ada akun berkuasa penuh yang tak terlihat); menolak di API menambah aturan tanpa manfaat keamanan, karena tidak ada eskalasi hak (owner → `PATCH /users` tetap 403).
19. **Ekspor CSV submission hanya mengekspor halaman yang tampil.** Tidak ada endpoint ekspor massal; berpura-pura mengekspor semuanya berarti berbohong atau menembaki server dengan permintaan halaman berurutan. Nilai di-escape dan diberi kutip pembuka bila diawali `=`/`+`/`-`/`@` supaya Excel tidak memperlakukannya sebagai formula.

### Dua audiens, satu panel (2026-07-15)

Panel melayani **platform admin** (staf ModernWeb) dan **klien** (owner/manager/editor satu website) dengan IA yang berbeda, dipilih dari `platformRole`:

| | Platform admin | Klien |
|---|---|---|
| Sidebar | Websites, Pengguna | Dashboard, Collection, Media, Forms, Setting, Anggota |
| Pemilih website | selalu | dilewati kalau cuma punya 1 |
| Navigasi dalam website | tab bar 13 tab | sidebar (tab bar tidak dirender) |
| Collection | field builder | langsung ke entries |
| Detail website | form yang bisa diedit | informasi read-only |
| Pages, Menus, Audit, Role | ada | tidak ada |
| API Keys, Webhooks | ada | **tidak bisa sama sekali** (izin dicabut) |

Keputusan:

20. **Klien tidak boleh menyentuh API Keys & Webhooks — dicabut dari izin, bukan disembunyikan.** `PLATFORM_ONLY_PERMISSIONS` (apikeys.read/manage, webhooks.read/manage) tidak dimiliki role website mana pun; hanya short-circuit platform-role di `PermissionsGuard` yang menjangkaunya. Alasannya: API key mengautentikasi frontend yang **ModernWeb** bangun dan deploy — klien tak punya tempat memasangnya; webhook mengirim konten ke URL sembarang. Kalau hanya menunya disembunyikan, owner tetap bisa mencetak kredensial lewat curl — batas yang cuma terlihat ada. Terverifikasi: owner `POST /api-keys` → **403**.
21. **Seed mencabut izin platform-only dari SEMUA website** (`stripPlatformOnlyPermissions`), bukan cuma yang di-seed. Role dibuat dari `DEFAULT_ROLES` saat website dibuat, jadi website lama tetap membawa izin lama — batasnya akan bocor di setiap website yang sudah ada. Ini **strip, bukan reset**: tidak pernah memberi apa pun, jadi aman atas role yang sudah dikustomisasi. (Terbukti perlu: `garis-transport` masih punya Owner ber-`apikeys.manage` sampai strip ini jalan.)
22. **Detail website read-only untuk klien.** Slug dan domain tertanam di frontend yang sudah dideploy dan di URL Content API publik — mengubahnya operasi platform, bukan sesuatu yang klien bisa sentuh tak sengaja. Klien melihat kartu informasi; platform admin tetap dapat form.
23. **Builder collection bukan milik klien** meski `collections.manage` ada di role Owner. Bentuk konten didefinisikan ModernWeb; klien mengisinya. Karena itu gerbangnya `isPlatformAdmin && can(...)`, bukan `can(...)` saja — satu-satunya tempat UI sengaja lebih ketat dari API, dan itu disengaja: mendefinisikan ulang field bukan hal yang klien butuhkan, tapi juga bukan bahaya keamanan sehingga tak perlu dicabut dari izin.
24. **Settings + SEO jadi satu layar**, route `/seo` dihapus. Keduanya nilai website-wide yang dibaca frontend; memisahkannya membuat pembaca menebak-nebak mana yang memuat "judul situs".

## Workflow Client Baru

1. Platform admin membuat website baru di CMS (`POST /websites`) → default roles otomatis dibuat
2. Tambahkan owner sebagai member (`POST /websites/:id/members`)
3. Owner membuat collections + fields sesuai kebutuhan bisnisnya
4. Isi konten (entries, media)
5. Buat project Next.js baru → konsumsi `GET /api/v1/content/{website}/collections/{collection}/entries`
6. Deploy ke Vercel → website online — **tanpa membuat backend baru**
