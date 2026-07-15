/**
 * Fase 3 end-to-end check: cache + invalidation, webhooks (HMAC/retry/log),
 * media variants contract. Spins up a local receiver to catch webhook calls.
 *
 * Needs the dev server up on :3001 and the seed applied.
 * Run with `npm run e2e:fase3`.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { createServer } from 'http';

const BASE = 'http://localhost:3001/api/v1';
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'adyatma.yafi19@gmail.com';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
const RECEIVER_PORT = 4599;

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

/** Webhook receiver that records calls and can be told to fail. */
function startReceiver() {
  const received = [];
  let mode = 'ok'; // ok | fail500 | fail400
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push({
        path: req.url,
        signature: req.headers['x-mwc-signature'],
        event: req.headers['x-mwc-event'],
        body,
      });
      if (mode === 'fail500') {
        res.writeHead(500).end('boom');
      } else if (mode === 'fail400') {
        res.writeHead(400).end('nope');
      } else {
        res.writeHead(200).end('ok');
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(RECEIVER_PORT, () =>
      resolve({
        received,
        setMode: (m) => (mode = m),
        close: () => server.close(),
      }),
    );
  });
}

function verifySignature(rawBody, signature, secret) {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function waitFor(predicate, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(100);
  }
  return false;
}

/** Polls an async fetch until it satisfies predicate; delivery is async. */
async function pollFor(fetchFn, predicate, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await fetchFn();
    if (predicate(last)) return last;
    await sleep(150);
  }
  return last;
}

async function main() {
  const receiver = await startReceiver();
  const login = await api('POST', '/auth/login', {
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = login.data.accessToken;
  const websites = await api('GET', '/websites', { token });
  const wid = websites.data.items.find((w) => w.slug === 'halwa-travel').id;

  const collections = await api('GET', `/websites/${wid}/collections`, { token });
  const cid = collections.data.find((c) => c.slug === 'tour-packages').id;

  // ---------- cache ----------
  console.log('\n== cache ==');
  const first = await api('GET', '/content/halwa-travel/settings');
  check('settings readable', first.status === 200 && first.data.currency === 'IDR');

  await api('PUT', `/websites/${wid}/settings/currency`, {
    token,
    body: { value: 'USD' },
  });
  const afterWrite = await api('GET', '/content/halwa-travel/settings');
  check(
    'settings write invalidates cache immediately',
    afterWrite.data.currency === 'USD',
    afterWrite.data,
  );
  await api('PUT', `/websites/${wid}/settings/currency`, {
    token,
    body: { value: 'IDR' },
  });

  // A published entry edit must not be served stale (the entry.published-only
  // invalidation of the original plan would fail this).
  const entries = await api('GET', '/content/halwa-travel/collections/tour-packages/entries');
  const target = entries.data.items[0];
  const originalTitle = target.data.title;
  await api('PATCH', `/websites/${wid}/collections/${cid}/entries/${target.id}`, {
    token,
    body: { data: { title: 'Judul Diedit E2E' } },
  });
  const afterEdit = await api('GET', '/content/halwa-travel/collections/tour-packages/entries');
  check(
    'editing a published entry invalidates cache',
    afterEdit.data.items.some((e) => e.data.title === 'Judul Diedit E2E'),
    afterEdit.data.items.map((e) => e.data.title),
  );
  await api('PATCH', `/websites/${wid}/collections/${cid}/entries/${target.id}`, {
    token,
    body: { data: { title: originalTitle } },
  });

  // Distinct queries must not collide in the cache.
  const p1 = await api('GET', '/content/halwa-travel/collections/tour-packages/entries?limit=1&page=1');
  const p2 = await api('GET', '/content/halwa-travel/collections/tour-packages/entries?limit=1&page=2');
  check(
    'different pages cache separately',
    p1.data.items[0]?.id !== p2.data.items[0]?.id,
    { p1: p1.data.items[0]?.id, p2: p2.data.items[0]?.id },
  );

  const f1 = await api('GET', '/content/halwa-travel/collections/tour-packages/entries?filter[price][gte]=2000000');
  const f2 = await api('GET', '/content/halwa-travel/collections/tour-packages/entries');
  check(
    'filtered vs unfiltered cache separately',
    f1.data.items.length !== f2.data.items.length,
    { filtered: f1.data.items.length, all: f2.data.items.length },
  );

  const seoDefaults = await api('GET', '/content/halwa-travel/seo/defaults');
  check('seo defaults cached endpoint works', seoDefaults.data?.titleTemplate === '%s | Halwa Travel');

  // ---------- webhooks: crud ----------
  console.log('\n== webhooks (crud) ==');
  const events = await api('GET', `/websites/${wid}/webhooks/events`, { token });
  check('event catalogue exposed', Array.isArray(events.data?.events) && events.data.events.includes('entry.published'));

  const badEvent = await api('POST', `/websites/${wid}/webhooks`, {
    token,
    body: { name: 'bad', url: `http://localhost:${RECEIVER_PORT}/hook`, events: ['entry.exploded'] },
  });
  check('unknown event rejected -> 400', badEvent.status === 400);

  const badUrl = await api('POST', `/websites/${wid}/webhooks`, {
    token,
    body: { name: 'bad', url: 'not-a-url', events: ['entry.published'] },
  });
  check('invalid url rejected -> 400', badUrl.status === 400);

  const hook = await api('POST', `/websites/${wid}/webhooks`, {
    token,
    body: {
      name: 'E2E receiver',
      url: `http://localhost:${RECEIVER_PORT}/hook`,
      events: ['entry.published', 'page.published'],
    },
  });
  check('create webhook returns secret once', hook.status === 201 && typeof hook.data?.secret === 'string', hook.data);
  const secret = hook.data.secret;
  const hookId = hook.data.id;

  const list = await api('GET', `/websites/${wid}/webhooks`, { token });
  const listed = list.data.find((w) => w.id === hookId);
  check('list never exposes secret', !!listed && !('secret' in listed), listed);

  // ---------- webhooks: delivery ----------
  console.log('\n== webhooks (delivery) ==');
  const entry = await api('POST', `/websites/${wid}/collections/${cid}/entries`, {
    token,
    body: {
      data: { title: 'Webhook Trigger E2E', slug: 'webhook-trigger-e2e', price: 1000 },
      status: 'PUBLISHED',
    },
  });
  check('entry created published', entry.status === 201, entry.data);

  const got = await waitFor(() => receiver.received.length > 0);
  check('webhook delivered on entry.published', got, { received: receiver.received.length });

  const call = receiver.received[0];
  check('signature verifies against secret', call && verifySignature(call.body, call.signature, secret), {
    signature: call?.signature,
  });
  check('event header matches', call?.event === 'entry.published');

  const payload = call ? JSON.parse(call.body) : {};
  check('payload carries event/resource/action/id', payload.event === 'entry.published' && payload.resource === 'entry' && payload.action === 'published' && !!payload.id, payload);

  const wrongSecret = call && verifySignature(call.body, call.signature, 'whsec_wrong');
  check('signature fails with wrong secret', !wrongSecret);

  const success = await pollFor(
    async () =>
      (
        await api('GET', `/websites/${wid}/webhooks/${hookId}/deliveries`, { token })
      ).data.items.find((d) => d.event === 'entry.published'),
    (d) => d?.status === 'SUCCESS',
  );
  check(
    'delivery logged as SUCCESS',
    success?.status === 'SUCCESS' && success.responseStatus === 200 && success.attempts === 1,
    success,
  );

  // unsubscribed event must not fire
  const before = receiver.received.length;
  await api('PUT', `/websites/${wid}/settings/e2e.noise`, { token, body: { value: 1 } });
  await sleep(700);
  check('unsubscribed event does not fire', receiver.received.length === before);

  // 4xx is not retried
  console.log('\n== webhooks (failure handling) ==');
  receiver.setMode('fail400');
  receiver.received.length = 0;
  const e400 = await api('POST', `/websites/${wid}/collections/${cid}/entries`, {
    token,
    body: { data: { title: 'Hook 400', slug: 'hook-400', price: 1 }, status: 'PUBLISHED' },
  });
  await waitFor(() => receiver.received.length > 0);
  await sleep(1200);
  check('4xx is not retried (single attempt)', receiver.received.length === 1, { attempts: receiver.received.length });

  const failed = await pollFor(
    async () =>
      (
        await api('GET', `/websites/${wid}/webhooks/${hookId}/deliveries`, { token })
      ).data.items[0],
    (d) => d?.status === 'FAILED',
  );
  check(
    'failed delivery logged with status + error',
    failed?.status === 'FAILED' && failed.responseStatus === 400 && failed.lastError === 'HTTP 400',
    failed,
  );

  // 5xx IS retried: 3 attempts with 1s + 5s backoff
  receiver.setMode('fail500');
  receiver.received.length = 0;
  const e500 = await api('POST', `/websites/${wid}/collections/${cid}/entries`, {
    token,
    body: { data: { title: 'Hook 500', slug: 'hook-500', price: 1 }, status: 'PUBLISHED' },
  });
  const retried = await waitFor(() => receiver.received.length === 3, 15000);
  check('5xx retried 3 times', retried, { attempts: receiver.received.length });

  const failed500 = await pollFor(
    async () =>
      (
        await api('GET', `/websites/${wid}/webhooks/${hookId}/deliveries`, { token })
      ).data.items[0],
    (d) => d?.status === 'FAILED' && d.attempts === 3,
    15000,
  );
  check('retried delivery logged with attempts=3', failed500?.attempts === 3, failed500);

  // inactive webhook must not fire
  receiver.setMode('ok');
  receiver.received.length = 0;
  await api('PATCH', `/websites/${wid}/webhooks/${hookId}`, { token, body: { active: false } });
  const e2 = await api('POST', `/websites/${wid}/collections/${cid}/entries`, {
    token,
    body: { data: { title: 'Hook inactive', slug: 'hook-inactive', price: 1 }, status: 'PUBLISHED' },
  });
  await sleep(800);
  check('inactive webhook does not fire', receiver.received.length === 0);

  const rotated = await api('POST', `/websites/${wid}/webhooks/${hookId}/rotate-secret`, { token });
  check('rotate returns a new secret', typeof rotated.data?.secret === 'string' && rotated.data.secret !== secret);

  // ---------- media contract ----------
  console.log('\n== media ==');
  const media = await api('GET', `/websites/${wid}/media`, { token });
  check('media list works with variants column', media.status === 200, media.data);

  // ---------- cleanup ----------
  await api('DELETE', `/websites/${wid}/webhooks/${hookId}`, { token });
  await api('DELETE', `/websites/${wid}/settings/e2e.noise`, { token });
  for (const id of [entry.data?.id, e400.data?.id, e500.data?.id, e2.data?.id].filter(Boolean)) {
    await api('DELETE', `/websites/${wid}/collections/${cid}/entries/${id}`, { token });
  }
  receiver.close();

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
