/**
 * Fase 4 end-to-end check: audit log (actor via CLS), forms + submissions,
 * analytics counters, draft preview tokens, health endpoint.
 *
 * Needs the dev server up on :3001 and the seed applied.
 * Run with `npm run e2e:fase4`.
 */
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
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, data };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Audit rows are written from an async listener. */
async function pollAudit(wid, token, predicate, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await api(`GET`, `/websites/${wid}/audit-logs?limit=50`, { token });
    const found = res.data?.items?.find(predicate);
    if (found) return found;
    await sleep(200);
  }
  return null;
}

async function main() {
  console.log('== health ==');
  const health = await api('GET', '/health');
  check('health -> ok + database up', health.status === 200 && health.data?.database === 'up', health.data);

  const login = await api('POST', '/auth/login', {
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = login.data.accessToken;
  const me = await api('GET', '/auth/me', { token });
  const myId = me.data?.id;

  const websites = await api('GET', '/websites', { token });
  const wid = websites.data.items.find((w) => w.slug === 'halwa-travel').id;
  const collections = await api('GET', `/websites/${wid}/collections`, { token });
  const cid = collections.data.find((c) => c.slug === 'tour-packages').id;

  // ---------- audit log ----------
  console.log('\n== audit log ==');
  const page = await api('POST', `/websites/${wid}/pages`, {
    token,
    body: { title: 'Audit E2E', slug: 'audit-e2e', status: 'PUBLISHED' },
  });
  const auditPublish = await pollAudit(
    wid,
    token,
    (a) => a.resource === 'page' && a.targetId === page.data.id,
  );
  check('publish tercatat di audit log', !!auditPublish, auditPublish);
  check('audit mencatat actor (userId) dari CLS', auditPublish?.actorId === myId, {
    actorId: auditPublish?.actorId,
    myId,
  });
  check('audit mencatat email actor', auditPublish?.actorEmail === EMAIL, auditPublish?.actorEmail);
  check('audit mencatat action published', auditPublish?.action === 'published', auditPublish?.action);
  check('audit mencatat ip', !!auditPublish?.ip, auditPublish?.ip);

  // security action (not a content mutation)
  const key = await api('POST', `/websites/${wid}/api-keys`, {
    token,
    body: { name: 'audit probe key' },
  });
  const auditKey = await pollAudit(
    wid,
    token,
    (a) => a.resource === 'apikey' && a.targetId === key.data.id,
  );
  check('pembuatan api key tercatat (AuditEvent)', !!auditKey, auditKey);
  check('audit api key membawa actor', auditKey?.actorId === myId);
  check('meta audit tidak memuat secret', !JSON.stringify(auditKey?.meta ?? {}).includes(key.data.key), auditKey?.meta);
  await api('DELETE', `/websites/${wid}/api-keys/${key.data.id}`, { token });

  const filtered = await api('GET', `/websites/${wid}/audit-logs?resource=apikey`, { token });
  check('filter audit by resource', filtered.data.items.every((a) => a.resource === 'apikey'), filtered.data.items?.[0]);

  const noAuth = await api('GET', `/websites/${wid}/audit-logs`);
  check('audit log butuh auth -> 401', noAuth.status === 401);

  // ---------- forms ----------
  console.log('\n== forms ==');
  const forms = await api('GET', `/websites/${wid}/forms`, { token });
  const kontak = forms.data.find((f) => f.slug === 'kontak');
  check('form seed "kontak" ada', !!kontak, forms.data);

  const submit = await api('POST', '/content/halwa-travel/forms/kontak/submit', {
    body: {
      data: { nama: 'Budi', email: 'budi@example.com', pesan: 'Halo', topik: 'umum' },
    },
  });
  check('submit publik -> 200', submit.status === 200 && submit.data?.submitted === true, submit.data);

  const missingRequired = await api('POST', '/content/halwa-travel/forms/kontak/submit', {
    body: { data: { nama: 'Budi' } },
  });
  check('field wajib yang kosong -> 400', missingRequired.status === 400, missingRequired.data);

  const unknownField = await api('POST', '/content/halwa-travel/forms/kontak/submit', {
    body: { data: { nama: 'B', email: 'b@e.com', pesan: 'x', jahat: 'inject' } },
  });
  check('field asing ditolak -> 400', unknownField.status === 400, unknownField.data);

  const badChoice = await api('POST', '/content/halwa-travel/forms/kontak/submit', {
    body: { data: { nama: 'B', email: 'b@e.com', pesan: 'x', topik: 'bukan-pilihan' } },
  });
  check('SELECT di luar choices ditolak -> 400 (validator entry dipakai ulang)', badChoice.status === 400, badChoice.data);

  const unknownForm = await api('POST', '/content/halwa-travel/forms/tidak-ada/submit', {
    body: { data: {} },
  });
  check('form tidak dikenal -> 404', unknownForm.status === 404);

  const subs = await api('GET', `/websites/${wid}/forms/${kontak.id}/submissions`, { token });
  const mine = subs.data.items.find((s) => s.data?.email === 'budi@example.com');
  check('submission tersimpan & terbaca admin', !!mine, subs.data.items?.[0]);
  check('submission menyimpan ip', !!mine?.ip, mine?.ip);
  check('submissions butuh auth -> 401', (await api('GET', `/websites/${wid}/forms/${kontak.id}/submissions`)).status === 401);

  // inactive form must reject
  await api('PATCH', `/websites/${wid}/forms/${kontak.id}`, { token, body: { active: false } });
  const inactive = await api('POST', '/content/halwa-travel/forms/kontak/submit', {
    body: { data: { nama: 'B', email: 'b@e.com', pesan: 'x' } },
  });
  check('form non-aktif menolak submit -> 400', inactive.status === 400, inactive.data);
  await api('PATCH', `/websites/${wid}/forms/${kontak.id}`, { token, body: { active: true } });

  const dupKeys = await api('POST', `/websites/${wid}/forms`, {
    token,
    body: {
      name: 'Dup', slug: 'dup-keys',
      fields: [
        { key: 'a', name: 'A', type: 'TEXT' },
        { key: 'a', name: 'A lagi', type: 'TEXT' },
      ],
    },
  });
  check('field key duplikat ditolak -> 400', dupKeys.status === 400, dupKeys.data);

  if (mine) {
    await api('DELETE', `/websites/${wid}/forms/${kontak.id}/submissions/${mine.id}`, { token });
  }

  // ---------- analytics ----------
  console.log('\n== analytics ==');
  const before = await api('GET', `/websites/${wid}/analytics/page-views?path=/e2e-analytics`, { token });
  const beforeTotal = before.data?.total ?? 0;

  for (let i = 0; i < 3; i++) {
    const t = await api('POST', '/content/halwa-travel/analytics/page-view', {
      body: { path: '/e2e-analytics?utm=abc#bagian' },
    });
    if (i === 0) check('track page view -> 202', t.status === 202, t.data);
  }
  await sleep(300);

  const after = await api('GET', `/websites/${wid}/analytics/page-views?path=/e2e-analytics`, { token });
  check('3 hit menambah counter harian (+3)', (after.data?.total ?? 0) === beforeTotal + 3, {
    before: beforeTotal,
    after: after.data?.total,
  });
  check('query string & hash dinormalisasi jadi satu path', after.data.topPaths.some((p) => p.path === '/e2e-analytics'), after.data.topPaths);
  check('ada seri harian', Array.isArray(after.data?.daily) && after.data.daily.length > 0, after.data?.daily);

  const badPath = await api('POST', '/content/halwa-travel/analytics/page-view', {
    body: { path: 'tanpa-slash' },
  });
  check('path tanpa "/" ditolak -> 400', badPath.status === 400);
  check('analytics butuh auth -> 401', (await api('GET', `/websites/${wid}/analytics/page-views`)).status === 401);

  // ---------- preview token ----------
  console.log('\n== preview token ==');
  const draft = await api('POST', `/websites/${wid}/pages`, {
    token,
    body: { title: 'Draft Preview E2E', slug: 'draft-preview-e2e' },
  });
  check('page draft dibuat', draft.data?.status === 'DRAFT');

  const anon = await api('GET', '/content/halwa-travel/pages/draft-preview-e2e');
  check('draft tidak terlihat publik -> 404', anon.status === 404);

  const tokenRes = await api('POST', `/websites/${wid}/preview-tokens`, { token });
  check('terbitkan preview token', tokenRes.status === 200 && !!tokenRes.data?.token, tokenRes.data);
  const previewToken = tokenRes.data.token;

  const withPreview = await api('GET', `/content/halwa-travel/pages/draft-preview-e2e?preview=${previewToken}`);
  check('draft terlihat dengan preview token', withPreview.status === 200 && withPreview.data?.slug === 'draft-preview-e2e', withPreview.data);

  const badToken = await api('GET', '/content/halwa-travel/pages/draft-preview-e2e?preview=bukan-token');
  check('token ngawur diabaikan -> 404', badToken.status === 404);

  // The important one: a preview read must not poison the public cache.
  const anonAfterPreview = await api('GET', '/content/halwa-travel/pages/draft-preview-e2e');
  check('preview TIDAK mencemari cache publik (masih 404)', anonAfterPreview.status === 404, anonAfterPreview.data);

  const listAnon = await api('GET', '/content/halwa-travel/pages');
  check('draft tidak muncul di listing publik', !listAnon.data.items.some((p) => p.slug === 'draft-preview-e2e'));
  const listPreview = await api('GET', `/content/halwa-travel/pages?preview=${previewToken}`);
  check('draft muncul di listing dengan preview', listPreview.data.items.some((p) => p.slug === 'draft-preview-e2e'));

  // a token for another website must not unlock this one
  const other = await api('POST', '/websites', {
    token,
    body: { name: 'E2E Preview Lain', slug: 'e2e-preview-lain' },
  });
  const otherToken = (await api('POST', `/websites/${other.data.id}/preview-tokens`, { token })).data.token;
  const crossSite = await api('GET', `/content/halwa-travel/pages/draft-preview-e2e?preview=${otherToken}`);
  check('token website lain tidak membuka draft ini -> 404', crossSite.status === 404, crossSite.data);
  await api('DELETE', `/websites/${other.data.id}`, { token });

  check('preview-tokens butuh auth -> 401', (await api('POST', `/websites/${wid}/preview-tokens`)).status === 401);

  // ---------- cleanup ----------
  await api('DELETE', `/websites/${wid}/pages/${draft.data.id}`, { token });
  await api('DELETE', `/websites/${wid}/pages/${page.data.id}`, { token });

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
