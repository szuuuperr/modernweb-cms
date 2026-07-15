/**
 * Fase 2 end-to-end check: pages, menus, seo, settings, api keys.
 *
 * Needs the dev server up on :3001 and the seed applied.
 * Run with `npm run e2e:fase2` (optionally pass a seeded API key as an arg).
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

async function api(method, path, { token, body, apiKey, raw } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (apiKey) headers['x-api-key'] = apiKey;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, data };
}

async function main() {
  console.log('\n== auth ==');
  const login = await api('POST', '/auth/login', {
    body: { email: EMAIL, password: PASSWORD },
  });
  check('login as super admin', login.status === 200 && !!login.data?.accessToken, login.data);
  const token = login.data.accessToken;

  const websites = await api('GET', '/websites', { token });
  const website = websites.data.items.find((w) => w.slug === 'halwa-travel');
  check('seeded website present', !!website);
  const wid = website.id;

  // ---------- pages ----------
  console.log('\n== pages (admin) ==');
  const created = await api('POST', `/websites/${wid}/pages`, {
    token,
    body: {
      title: 'Kontak E2E',
      slug: 'kontak-e2e',
      blocks: [{ type: 'form', props: { formId: 'contact' } }],
    },
  });
  check('create page -> 201 DRAFT', created.status === 201 && created.data?.status === 'DRAFT', created.data);
  const pageId = created.data.id;

  const dupe = await api('POST', `/websites/${wid}/pages`, {
    token,
    body: { title: 'Dup', slug: 'kontak-e2e' },
  });
  check('duplicate slug -> 409', dupe.status === 409, dupe.data);

  const badSlug = await api('POST', `/websites/${wid}/pages`, {
    token,
    body: { title: 'Bad', slug: 'Not Kebab Case' },
  });
  check('non-kebab slug -> 400', badSlug.status === 400);

  const badBlocks = await api('POST', `/websites/${wid}/pages`, {
    token,
    body: { title: 'Bad blocks', slug: 'bad-blocks', blocks: [{ props: {} }] },
  });
  check('block without type -> 400', badBlocks.status === 400);

  const listed = await api('GET', `/websites/${wid}/pages?status=DRAFT`, { token });
  check('list pages filtered by status', listed.status === 200 && listed.data.items.every((p) => p.status === 'DRAFT'));

  const searched = await api('GET', `/websites/${wid}/pages?search=kontak`, { token });
  check('search pages by title', searched.data.items.some((p) => p.slug === 'kontak-e2e'));

  const published = await api('POST', `/websites/${wid}/pages/${pageId}/publish`, { token });
  check('publish page sets publishedAt', published.data?.status === 'PUBLISHED' && !!published.data?.publishedAt);

  const patched = await api('PATCH', `/websites/${wid}/pages/${pageId}`, {
    token,
    body: { title: 'Kontak E2E (updated)' },
  });
  check('patch page title', patched.data?.title === 'Kontak E2E (updated)');
  check('patch does not clobber status', patched.data?.status === 'PUBLISHED');

  const unpublished = await api('POST', `/websites/${wid}/pages/${pageId}/unpublish`, { token });
  check('unpublish clears publishedAt', unpublished.data?.status === 'DRAFT' && unpublished.data?.publishedAt === null);
  await api('POST', `/websites/${wid}/pages/${pageId}/publish`, { token });

  // ---------- seo ----------
  console.log('\n== seo ==');
  const seoUpsert = await api('PUT', `/websites/${wid}/seo/PAGE/${pageId}`, {
    token,
    body: { metaTitle: 'Kontak', metaDescription: 'Hubungi kami', noIndex: false },
  });
  check('upsert page seo', seoUpsert.status === 200 && seoUpsert.data?.metaTitle === 'Kontak', seoUpsert.data);

  const seoAgain = await api('PUT', `/websites/${wid}/seo/PAGE/${pageId}`, {
    token,
    body: { metaDescription: 'Hubungi kami sekarang' },
  });
  check('upsert is partial (metaTitle kept)', seoAgain.data?.metaTitle === 'Kontak' && seoAgain.data?.metaDescription === 'Hubungi kami sekarang');

  const seoBadTarget = await api('PUT', `/websites/${wid}/seo/PAGE/does-not-exist`, {
    token,
    body: { metaTitle: 'x' },
  });
  check('seo for unknown target -> 404', seoBadTarget.status === 404);

  const seoBadType = await api('PUT', `/websites/${wid}/seo/BOGUS/${pageId}`, {
    token,
    body: { metaTitle: 'x' },
  });
  check('invalid targetType -> 400', seoBadType.status === 400);

  const defaults = await api('GET', `/websites/${wid}/seo/defaults`, { token });
  check('seo defaults readable', defaults.data?.titleTemplate === '%s | Halwa Travel', defaults.data);

  // ---------- menus ----------
  console.log('\n== menus ==');
  const menu = await api('POST', `/websites/${wid}/menus`, {
    token,
    body: { name: 'Footer E2E', slug: 'footer-e2e' },
  });
  check('create menu -> 201', menu.status === 201);
  const menuId = menu.data.id;

  const parent = await api('POST', `/websites/${wid}/menus/${menuId}/items`, {
    token,
    body: { label: 'Legal' },
  });
  const child = await api('POST', `/websites/${wid}/menus/${menuId}/items`, {
    token,
    body: { label: 'Privacy', url: '/privacy', parentId: parent.data.id },
  });
  check('nested item created', child.status === 201 && child.data.parentId === parent.data.id);

  const tree = await api('GET', `/websites/${wid}/menus/${menuId}`, { token });
  const legal = tree.data.items.find((i) => i.label === 'Legal');
  check('tree assembled with children', legal?.children?.length === 1 && legal.children[0].label === 'Privacy', tree.data);

  const cycle = await api('PATCH', `/websites/${wid}/menus/${menuId}/items/${parent.data.id}`, {
    token,
    body: { parentId: child.data.id },
  });
  check('cycle (parent under own child) -> 400', cycle.status === 400, cycle.data);

  const selfParent = await api('PATCH', `/websites/${wid}/menus/${menuId}/items/${parent.data.id}`, {
    token,
    body: { parentId: parent.data.id },
  });
  check('self-parent -> 400', selfParent.status === 400);

  const foreignPage = await api('POST', `/websites/${wid}/menus/${menuId}/items`, {
    token,
    body: { label: 'Bogus', pageId: 'nope' },
  });
  check('item pointing at unknown page -> 404', foreignPage.status === 404);

  const reordered = await api('PUT', `/websites/${wid}/menus/${menuId}/reorder`, {
    token,
    body: {
      items: [
        { id: child.data.id, order: 0 },
        { id: parent.data.id, order: 1 },
      ],
    },
  });
  check('reorder flattens child to root', reordered.data?.items?.length === 2, reordered.data);

  const reorderCycle = await api('PUT', `/websites/${wid}/menus/${menuId}/reorder`, {
    token,
    body: {
      items: [
        { id: parent.data.id, parentId: child.data.id, order: 0 },
        { id: child.data.id, parentId: parent.data.id, order: 0 },
      ],
    },
  });
  check('cyclic reorder payload -> 400', reorderCycle.status === 400, reorderCycle.data);

  const itemForeignMenu = await api('PUT', `/websites/${wid}/menus/${menuId}/reorder`, {
    token,
    body: { items: [{ id: 'not-in-menu', order: 0 }] },
  });
  check('reorder with foreign item id -> 404', itemForeignMenu.status === 404);

  // ---------- settings ----------
  console.log('\n== settings ==');
  const setObj = await api('PUT', `/websites/${wid}/settings/e2e.config`, {
    token,
    body: { value: { enabled: true, retries: 3 } },
  });
  check('upsert object setting', setObj.status === 200 && setObj.data?.value?.retries === 3, setObj.data);

  const setScalar = await api('PUT', `/websites/${wid}/settings/e2e.scalar`, {
    token,
    body: { value: 'hello' },
  });
  check('upsert scalar setting', setScalar.data?.value === 'hello');

  const badKey = await api('PUT', `/websites/${wid}/settings/Bad Key`, {
    token,
    body: { value: 1 },
  });
  check('invalid setting key -> 400', badKey.status === 400);

  const missing = await api('GET', `/websites/${wid}/settings/nope`, { token });
  check('unknown setting -> 404', missing.status === 404);

  // ---------- api keys ----------
  console.log('\n== api keys ==');
  const key = await api('POST', `/websites/${wid}/api-keys`, {
    token,
    body: { name: 'E2E key' },
  });
  check('create key returns plaintext once', key.status === 201 && typeof key.data?.key === 'string', key.data);
  const plaintext = key.data.key;

  const keyList = await api('GET', `/websites/${wid}/api-keys`, { token });
  const listedKey = keyList.data.find((k) => k.id === key.data.id);
  check('list never exposes hash or plaintext', !!listedKey && !('keyHash' in listedKey) && !('key' in listedKey), listedKey);

  // ---------- public content api ----------
  console.log('\n== public content api ==');
  const pubPages = await api('GET', '/content/halwa-travel/pages');
  check('public pages -> only PUBLISHED', pubPages.status === 200 && pubPages.data.items.every((p) => !!p.publishedAt), pubPages.data);
  check('public page list omits blocks', pubPages.data.items.every((p) => !('blocks' in p)));

  const pubPage = await api('GET', '/content/halwa-travel/pages/tentang-kami');
  check('public page by slug has blocks', Array.isArray(pubPage.data?.blocks) && pubPage.data.blocks.length > 0);
  check('page seo applies titleTemplate', pubPage.data?.seo?.metaTitle === 'Tentang Kami | Halwa Travel', pubPage.data?.seo);
  check('page seo falls back to website default description', typeof pubPage.data?.seo?.metaDescription === 'string');

  const draftPage = await api('GET', '/content/halwa-travel/pages/bad-blocks');
  check('unpublished/unknown page -> 404', draftPage.status === 404);

  const pubEntries = await api('GET', '/content/halwa-travel/collections/tour-packages/entries');
  check('public entries include resolved seo', pubEntries.status === 200 && pubEntries.data.items.every((e) => 'seo' in e), pubEntries.data);
  check('public entries exclude drafts', pubEntries.data.items.every((e) => !!e.publishedAt));
  check('entry seo defaults when unset', pubEntries.data.items[0]?.seo?.metaTitle === 'Halwa Travel — Paket Wisata Indonesia', pubEntries.data.items[0]?.seo);

  const filtered = await api('GET', '/content/halwa-travel/collections/tour-packages/entries?filter[price][gte]=2000000');
  check('entry JSON filter still works', filtered.data.items.every((e) => e.data.price >= 2000000), filtered.data);

  const pubMenu = await api('GET', '/content/halwa-travel/menus/main-nav');
  const nav = pubMenu.data?.items?.find((i) => i.label === 'Paket Wisata');
  check('public menu returns nested tree', nav?.children?.length === 2, pubMenu.data);

  const pubSettings = await api('GET', '/content/halwa-travel/settings');
  check('public settings is a key->value map', pubSettings.data?.currency === 'IDR' && pubSettings.data?.contact?.phone, pubSettings.data);

  const unknownSite = await api('GET', '/content/tidak-ada/pages');
  check('unknown website -> 404', unknownSite.status === 404);

  // ---------- api key enforcement ----------
  console.log('\n== api key enforcement ==');
  const anonOk = await api('GET', '/content/halwa-travel/settings');
  check('key optional while requireApiKey=false', anonOk.status === 200);

  const badKeyAnon = await api('GET', '/content/halwa-travel/settings', { apiKey: 'mwc_deadbeef_garbage' });
  check('invalid key rejected even when optional -> 401', badKeyAnon.status === 401, badKeyAnon.data);

  await api('PATCH', `/websites/${wid}`, { token, body: { requireApiKey: true } });

  const anonBlocked = await api('GET', '/content/halwa-travel/settings');
  check('requireApiKey=true blocks anonymous -> 401', anonBlocked.status === 401, anonBlocked.data);

  const withKey = await api('GET', '/content/halwa-travel/settings', { apiKey: plaintext });
  check('valid key passes when required', withKey.status === 200, withKey.data);

  // The secret is base64url, whose alphabet contains '_'. Key parsing must not
  // treat that as a separator. Randomly ~40% of keys hit this, so force the
  // case explicitly instead of hoping a run gets an unlucky key.
  const underscoreKeys = [];
  let keyWithUnderscore = null;
  for (let i = 0; i < 20 && !keyWithUnderscore; i++) {
    const k = await api('POST', `/websites/${wid}/api-keys`, {
      token,
      body: { name: `E2E underscore probe ${i}` },
    });
    underscoreKeys.push(k.data.id);
    // strip the "mwc_<8hex>_" prefix; what remains is the secret
    if (k.data.key.slice(13).includes('_')) keyWithUnderscore = k.data.key;
  }
  check('bisa membuat key yang secret-nya mengandung "_"', !!keyWithUnderscore);
  if (keyWithUnderscore) {
    const res = await api('GET', '/content/halwa-travel/settings', {
      apiKey: keyWithUnderscore,
    });
    check('key dengan "_" di secret tetap diterima', res.status === 200, res.data);
  }
  for (const id of underscoreKeys) {
    await api('DELETE', `/websites/${wid}/api-keys/${id}`, { token });
  }

  const seedKey = process.argv[2];
  if (seedKey) {
    const withSeedKey = await api('GET', '/content/halwa-travel/settings', { apiKey: seedKey });
    check('seeded key works', withSeedKey.status === 200, withSeedKey.data);
  }

  await api('POST', `/websites/${wid}/api-keys/${key.data.id}/revoke`, { token });
  const revoked = await api('GET', '/content/halwa-travel/settings', { apiKey: plaintext });
  check('revoked key -> 401', revoked.status === 401, revoked.data);

  await api('PATCH', `/websites/${wid}`, { token, body: { requireApiKey: false } });

  // ---------- rbac ----------
  console.log('\n== rbac ==');
  const noAuth = await api('GET', `/websites/${wid}/pages`);
  check('admin pages route needs auth -> 401', noAuth.status === 401);

  const noAuthSeo = await api('GET', `/websites/${wid}/seo/defaults`);
  check('seo route needs auth -> 401', noAuthSeo.status === 401);

  // ---------- seo cleanup on delete ----------
  console.log('\n== seo cleanup ==');
  await api('DELETE', `/websites/${wid}/pages/${pageId}`, { token });
  const orphan = await api('GET', `/websites/${wid}/seo/PAGE/${pageId}`, { token });
  check('deleting a page removes its seo row', orphan.status === 404, orphan.data);

  // cleanup
  await api('DELETE', `/websites/${wid}/menus/${menuId}`, { token });
  await api('DELETE', `/websites/${wid}/settings/e2e.config`, { token });
  await api('DELETE', `/websites/${wid}/settings/e2e.scalar`, { token });
  await api('DELETE', `/websites/${wid}/api-keys/${key.data.id}`, { token });
  const leftovers = await api('GET', `/websites/${wid}/pages?search=bad-blocks`, { token });
  for (const p of leftovers.data.items) {
    await api('DELETE', `/websites/${wid}/pages/${p.id}`, { token });
  }

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
