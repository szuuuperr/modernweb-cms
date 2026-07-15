# Deploy Produksi — api.modernwebid.com

Stack: NestJS + MySQL + Redis + Nginx (TLS) di satu VPS, lewat `docker-compose.prod.yml`.

> **Belum pernah dijalankan di VPS sungguhan.** Semua langkah di bawah sudah diverifikasi secara lokal (image ter-build, container jalan, migrasi dari DB kosong, nginx → app 200), tapi VPS, DNS, dan sertifikat TLS hanya bisa dibuktikan di mesin Anda.

## Prasyarat

- VPS (Ubuntu 22.04+), Docker + Docker Compose plugin terpasang.
- Port 80 & 443 terbuka.
- DNS sudah disiapkan (lihat bawah). **`api.modernwebid.com` wajib sudah propagasi sebelum menerbitkan sertifikat**, kalau tidak Let's Encrypt gagal validasi.

## DNS — subdomain apa saja yang dibutuhkan

| Nama | Record | Arahkan ke | Untuk |
|---|---|---|---|
| `api.modernwebid.com` | A | IP VPS | **CMS API — satu-satunya yang wajib untuk deploy ini** |
| `cms.modernwebid.com` | CNAME | Vercel | Admin panel (Fase 5, repo terpisah) |
| `modernwebid.com`, `www` | A / CNAME | Vercel | Situs ModernWeb sendiri (opsional) |

Yang **tidak** perlu dibuat:

- **Subdomain per website klien.** Halwa Travel, Notaris ABC, dst memakai domain mereka sendiri (`halwatravel.com`) dan disimpan di kolom `Website.domain`. Itu justru inti desain multi-website ini — klien baru tidak menambah subdomain di sini.
- **Subdomain CDN/media.** Cloudinary menyajikan dari `res.cloudinary.com`. Baru relevan kalau nanti pindah ke storage sendiri.

### Admin panel (`cms.modernwebid.com`)

Panel dideploy terpisah ke Vercel dari repo `modernweb-cms-admin`. Agar login-nya jalan, API di sini **wajib** mengenali origin-nya:

```bash
ADMIN_ORIGINS="https://cms.modernwebid.com"   # boleh dipisah koma
COOKIE_SECURE="true"                          # produksi selalu HTTPS
COOKIE_SAMESITE="lax"                         # cms. & api. itu same-site
```

Hanya origin di `ADMIN_ORIGINS` yang mendapat `Access-Control-Allow-Credentials`. Origin lain tetap bisa membaca Content API publik tanpa cookie, persis seperti sebelumnya — jadi frontend klien tidak terpengaruh.

> Refresh token dikirim sebagai cookie httpOnly `mwc_rt` ber-`Path=/api/v1/auth`. Karena `cms.` dan `api.` masih satu site, `SameSite=lax` cukup. **Preview deployment Vercel (`*.vercel.app`) beda site** — kalau perlu dipakai, tambahkan origin-nya ke `ADMIN_ORIGINS` dan set `COOKIE_SAMESITE="none"`.

### Email (kalau notifikasi form dipakai)

`SMTP_FROM` harus di domain yang Anda kontrol (mis. `no-reply@modernwebid.com`), dan `modernwebid.com` butuh:

- **SPF** — TXT record yang mengizinkan server/provider pengirim Anda.
- **DKIM** — TXT/CNAME dari provider SMTP.

Tanpa keduanya email tetap terkirim tapi mendarat di spam. App menolak start bila `SMTP_HOST` diisi sedangkan `SMTP_FROM` kosong — disengaja, supaya tidak ada pengiriman dari domain asal-asalan.

## 1. Ambil kode & siapkan env

```bash
git clone <repo> /opt/modernweb-cms && cd /opt/modernweb-cms
cp .env.production.example .env.production
```

Isi `.env.production`. Generate secret yang benar-benar baru — **jangan pakai nilai dev**:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
openssl rand -base64 32   # MYSQL_ROOT_PASSWORD
```

`docker-compose.prod.yml` menolak start bila `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MYSQL_ROOT_PASSWORD`, `APP_URL`, atau `DOMAIN` kosong.

```bash
chmod 600 .env.production
```

## 2. Terbitkan sertifikat TLS (sekali, sebelum nginx jalan)

Nginx menolak start bila file sertifikat belum ada, jadi terbitkan dulu selagi port 80 bebas:

```bash
docker run --rm -p 80:80 \
  -v modernweb-cms-prod_certbot_conf:/etc/letsencrypt \
  -v modernweb-cms-prod_certbot_www:/var/www/certbot \
  certbot/certbot certonly --standalone \
  -d api.modernwebid.com --agree-tos -m you@example.com --no-eff-email
```

Perpanjangan otomatis ditangani service `certbot` (loop tiap 12 jam, mode webroot).

## 3. Jalankan stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Migrasi database jalan otomatis saat container `app` start (`prisma migrate deploy`).

## 4. Seed admin pertama (hanya deploy pertama)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec app npx prisma db seed
```

Setelah itu **hapus `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` dari `.env.production`** dan ganti password admin lewat API.

> Seed juga membuat website contoh "Halwa Travel" beserta kontennya. Untuk instalasi bersih, hapus bagian itu dari `prisma/seed.ts` dulu, atau hapus website-nya lewat API setelah seed.

## 5. Verifikasi

```bash
curl -fsS https://api.modernwebid.com/api/v1/health          # {"status":"ok","database":"up"}
curl -fsS https://api.modernwebid.com/api/v1/content/<slug>/settings
curl -sI http://api.modernwebid.com | head -1                # harus 301 ke https
docker compose -f docker-compose.prod.yml ps                  # semua healthy
```

Swagger di `https://api.modernwebid.com/docs`.

## Operasional

| Tugas | Perintah |
|---|---|
| Log aplikasi | `docker compose -f docker-compose.prod.yml logs -f app` |
| Restart app | `docker compose -f docker-compose.prod.yml restart app` |
| Deploy versi baru | `git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build app` |
| Status migrasi | `... exec app npx prisma migrate status` |
| Reload nginx (setelah renew) | `docker compose -f docker-compose.prod.yml exec nginx nginx -s reload` |

### Backup database

Tidak ada backup otomatis — siapkan cron di host:

```bash
docker compose -f docker-compose.prod.yml exec -T mysql \
  mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" modernweb_cms | gzip > backup-$(date +%F).sql.gz
```

Restore:

```bash
gunzip -c backup-YYYY-MM-DD.sql.gz | docker compose -f docker-compose.prod.yml exec -T mysql \
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" modernweb_cms
```

## Catatan yang mudah menjebak

- **Prod tidak berbagi apa pun dengan dev.** `docker-compose.yml` (dev) hanya berisi MySQL + Redis untuk lokal; volume prod terpisah (`mysql_prod_data`).
- **MySQL prod tidak mengekspos port ke host** — aksesnya hanya lewat jaringan compose. Untuk debug: `exec mysql mysql -uroot -p`.
- **`TRUST_PROXY=1` wajib** karena app ada di belakang nginx. Tanpa itu `req.ip` = IP nginx, sehingga rate limit publik memperlakukan semua pengunjung sebagai satu klien dan audit log mencatat IP salah.
- **Redis boleh mati** — API tetap melayani (turun jadi cache-miss). MySQL mati = API down.
- **Cloudinary**: `STORAGE_DRIVER=cloudinary` butuh `CLOUDINARY_URL`; app gagal start bila kosong (disengaja — lebih baik gagal keras daripada diam-diam menyimpan ke disk container yang akan hilang).
