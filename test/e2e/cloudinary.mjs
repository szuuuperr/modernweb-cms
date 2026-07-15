/**
 * Cloudinary adapter check against the real API (Fase 3).
 *
 * Needs the server up with STORAGE_DRIVER=cloudinary and CLOUDINARY_URL set.
 * Run from the repo root (`npm run e2e:cloudinary`) so dotenv finds .env.
 */
import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

const BASE = 'http://localhost:3001/api/v1';
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'adyatma.yafi19@gmail.com';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` -> ${JSON.stringify(detail)}` : ''}`);
  }
}

async function api(method, path, { token, body } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, data };
}

async function upload(token, wid, { bytes, filename, mimeType, alt }) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mimeType }), filename);
  if (alt) form.append('alt', alt);
  const res = await fetch(`${BASE}/websites/${wid}/media`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, data };
}

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>',
);
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 99 9]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
);

async function fetchUrl(url) {
  try {
    const res = await fetch(url);
    return { status: res.status, type: res.headers.get('content-type') };
  } catch (error) {
    return { status: 0, type: null, error: String(error) };
  }
}

/**
 * Source of truth for "is it gone": the CDN keeps serving a cached copy for a
 * while after destroy(), so a URL fetch cannot prove deletion.
 */
async function existsInCloudinary(publicId, resourceType) {
  try {
    await cloudinary.api.resource(publicId, { resource_type: resourceType });
    return true;
  } catch (error) {
    if (error?.error?.http_code === 404) return false;
    throw error;
  }
}

async function main() {
  const login = await api('POST', '/auth/login', {
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (login.status !== 200) {
    console.error('Login gagal — server jalan di port 3001?', login.data);
    process.exit(1);
  }
  const token = login.data.accessToken;
  const websites = await api('GET', '/websites', { token });
  const wid = websites.data.items.find((w) => w.slug === 'halwa-travel').id;

  console.log('\n== upload gambar (raster) ==');
  const img = await upload(token, wid, {
    bytes: PNG_1X1,
    filename: 'e2e-cloudinary.png',
    mimeType: 'image/png',
    alt: 'uji cloudinary',
  });
  check('upload PNG -> 201', img.status === 201, img.data);
  check(
    'url mengarah ke Cloudinary (bukan local /uploads)',
    typeof img.data?.url === 'string' && img.data.url.includes('res.cloudinary.com'),
    img.data?.url,
  );
  check(
    'storageKey = public_id di folder websiteId',
    typeof img.data?.storageKey === 'string' && img.data.storageKey.startsWith(`${wid}/`),
    img.data?.storageKey,
  );
  check(
    'variants thumb + medium ada',
    !!img.data?.variants?.thumb && !!img.data?.variants?.medium,
    img.data?.variants,
  );
  check(
    'variant URL memuat transformasi w_320 / f_auto / q_auto',
    /w_320/.test(img.data?.variants?.thumb ?? '') &&
      /f_auto/.test(img.data?.variants?.thumb ?? '') &&
      /q_auto/.test(img.data?.variants?.thumb ?? ''),
    img.data?.variants?.thumb,
  );
  check(
    'asset benar-benar ada di Cloudinary (Admin API)',
    await existsInCloudinary(img.data.storageKey, 'image'),
  );

  const original = await fetchUrl(img.data.url);
  check('URL original melayani bytes (200)', original.status === 200, original);
  const thumb = await fetchUrl(img.data.variants.thumb);
  check('URL thumb melayani bytes (200)', thumb.status === 200, thumb);
  check(
    'thumb dikirim sebagai gambar (f_auto aktif)',
    (thumb.type ?? '').startsWith('image/'),
    thumb.type,
  );
  const medium = await fetchUrl(img.data.variants.medium);
  check('URL medium melayani bytes (200)', medium.status === 200, medium);

  console.log('\n== upload SVG (vektor) ==');
  const svg = await upload(token, wid, {
    bytes: SVG,
    filename: 'e2e-cloudinary.svg',
    mimeType: 'image/svg+xml',
  });
  check('upload SVG -> 201', svg.status === 201, svg.data);
  check(
    'SVG tidak diberi varian raster',
    svg.data?.variants === null || svg.data?.variants === undefined,
    svg.data?.variants,
  );

  console.log('\n== upload PDF (raw) ==');
  const pdf = await upload(token, wid, {
    bytes: PDF,
    filename: 'e2e-cloudinary.pdf',
    mimeType: 'application/pdf',
  });
  check('upload PDF -> 201', pdf.status === 201, pdf.data);
  check(
    'PDF tidak diberi varian raster',
    pdf.data?.variants === null || pdf.data?.variants === undefined,
    pdf.data?.variants,
  );
  const pdfType = pdf.data.url.includes('/raw/') ? 'raw' : 'image';
  check(
    'PDF ada di Cloudinary (Admin API)',
    await existsInCloudinary(pdf.data.storageKey, pdfType),
    { resourceType: pdfType },
  );

  // ---------- delete ----------
  // adapter.delete() swallows a miss and still returns 200, so the HTTP status
  // proves nothing on its own — the Admin API is the real check.
  console.log('\n== delete ==');
  const delImg = await api('DELETE', `/websites/${wid}/media/${img.data.id}`, { token });
  check('delete gambar -> 200', delImg.status === 200, delImg.data);
  check(
    'gambar benar-benar terhapus dari Cloudinary (Admin API)',
    !(await existsInCloudinary(img.data.storageKey, 'image')),
  );

  const delPdf = await api('DELETE', `/websites/${wid}/media/${pdf.data.id}`, { token });
  check('delete PDF -> 200', delPdf.status === 200, delPdf.data);
  check(
    `PDF terhapus dari Cloudinary (resource_type=${pdfType})`,
    !(await existsInCloudinary(pdf.data.storageKey, pdfType)),
  );

  const delSvg = await api('DELETE', `/websites/${wid}/media/${svg.data.id}`, { token });
  check('delete SVG -> 200', delSvg.status === 200, delSvg.data);
  check(
    'SVG terhapus dari Cloudinary',
    !(await existsInCloudinary(svg.data.storageKey, 'image')),
  );

  const list = await api('GET', `/websites/${wid}/media`, { token });
  const leftovers = list.data.items.filter((m) =>
    m.filename.startsWith('e2e-cloudinary'),
  );
  check('tidak ada sisa row media di DB', leftovers.length === 0, leftovers);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    console.log('failed checks:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
