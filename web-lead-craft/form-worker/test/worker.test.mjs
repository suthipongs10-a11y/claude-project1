// Tests the Worker's real exported handler with real Request/Response objects.
// Only the outbound call to LINE is stubbed — everything the Worker does with
// the incoming request is the code that gets deployed, not a re-implementation.
//
//   node --test form-worker/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';

const ORIGIN = 'https://cleanday.example';
const SITES = {
  [ORIGIN]: { name: 'CleanDay', lineToken: 'test-token', lineTo: 'U123' },
};
const env = { SITES: JSON.stringify(SITES) };

/** Capture what the Worker sends to LINE, and choose what LINE sends back. */
function stubLine({ status = 200, body = '{}' } = {}) {
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(init.body) });
    return new Response(body, { status });
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

const post = (body, { origin = ORIGIN, type = 'application/json', headers = {} } = {}) =>
  new Request('https://form.example/', {
    method: 'POST',
    headers: { origin, 'content-type': type, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const valid = { name: 'สมชาย', tel: '0812345678', note: 'อยากได้คิวเสาร์เช้า', elapsed: 9000 };

const call = async (request, e = env) => worker.fetch(request, e, { waitUntil() {} });

test('a real enquiry reaches LINE and answers ok', async () => {
  const line = stubLine();
  try {
    const res = await call(post(valid));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });

    assert.equal(line.calls.length, 1);
    const sent = line.calls[0];
    assert.equal(sent.url, 'https://api.line.me/v2/bot/message/push');
    assert.equal(sent.init.headers.authorization, 'Bearer test-token');
    assert.equal(sent.body.to, 'U123');
    const text = sent.body.messages[0].text;
    assert.match(text, /CleanDay/);
    assert.match(text, /ชื่อ: สมชาย/);
    assert.match(text, /เบอร์โทร: 0812345678/);
    assert.match(text, /อยากได้คิวเสาร์เช้า/);
  } finally { line.restore(); }
});

test('the browser gets a CORS header it can actually use', async () => {
  const line = stubLine();
  try {
    const res = await call(post(valid));
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal(res.headers.get('vary'), 'Origin');
  } finally { line.restore(); }
});

test('preflight is answered for a known origin and refused for a stranger', async () => {
  const options = origin =>
    new Request('https://form.example/', { method: 'OPTIONS', headers: { origin } });

  const good = await call(options(ORIGIN));
  assert.equal(good.status, 204);
  assert.equal(good.headers.get('access-control-allow-origin'), ORIGIN);

  const bad = await call(options('https://someone-else.example'));
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});

test('an unknown origin is refused and told nothing about our clients', async () => {
  const line = stubLine();
  try {
    const res = await call(post(valid, { origin: 'https://attacker.example' }));
    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { ok: false, error: 'unknown_site' });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
    assert.equal(line.calls.length, 0, 'nothing may be pushed for an unknown origin');
  } finally { line.restore(); }
});

test('GET is not a way in', async () => {
  const res = await call(new Request('https://form.example/', { headers: { origin: ORIGIN } }));
  assert.equal(res.status, 405);
});

test('a plain form post works, so the form survives JavaScript being off', async () => {
  const line = stubLine();
  try {
    const body = new URLSearchParams({ tel: '0899999999', name: 'มานี', elapsed: '9000' });
    const res = await call(post(body.toString(), { type: 'application/x-www-form-urlencoded' }));
    assert.equal(res.status, 200);
    assert.match(line.calls[0].body.messages[0].text, /มานี/);
  } finally { line.restore(); }
});

test('the honeypot swallows a bot without teaching it the bypass', async () => {
  const line = stubLine();
  try {
    const res = await call(post({ ...valid, wlc_hp: 'http://spam.example' }));
    assert.equal(res.status, 200, 'a bot must not learn that it failed');
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(line.calls.length, 0, 'nothing may reach the client');
  } finally { line.restore(); }
});

test('a form filled faster than a person can type is treated the same way', async () => {
  const line = stubLine();
  try {
    const res = await call(post({ ...valid, elapsed: 300 }));
    assert.equal(res.status, 200);
    assert.equal(line.calls.length, 0);
  } finally { line.restore(); }
});

test('a submission with no way to reply is rejected', async () => {
  const line = stubLine();
  try {
    const res = await call(post({ name: 'ไม่ทิ้งเบอร์', elapsed: 9000 }));
    assert.equal(res.status, 422);
    assert.deepEqual(await res.json(), { ok: false, error: 'contact_required' });
    assert.equal(line.calls.length, 0);
  } finally { line.restore(); }
});

test('an email alone is enough — not everyone leaves a phone number', async () => {
  const line = stubLine();
  try {
    const res = await call(post({ email: 'a@b.example', elapsed: 9000 }));
    assert.equal(res.status, 200);
    assert.match(line.calls[0].body.messages[0].text, /อีเมล: a@b\.example/);
  } finally { line.restore(); }
});

test('fields we do not know about are dropped, not relayed', async () => {
  const line = stubLine();
  try {
    await call(post({ ...valid, evil: 'https://malware.example', to: 'Uattacker' }));
    const sent = line.calls[0];
    assert.equal(sent.body.to, 'U123', 'the destination comes from our config, never the body');
    assert.doesNotMatch(sent.body.messages[0].text, /malware/);
  } finally { line.restore(); }
});

test('control characters cannot forge extra lines in the message', async () => {
  // The reader parses this message by line, so the property that matters is
  // that a field's value can never start a line of its own. Typing
  // "เบอร์โทร: …" inside a name is legitimate text and stays where it was
  // typed — what must not happen is a second line claiming to be the number.
  const line = stubLine();
  try {
    await call(post({ ...valid, name: 'สมชาย\nเบอร์โทร: 0000000000', note: 'ok\r\nเบอร์โทร: 111' }));
    const text = line.calls[0].body.messages[0].text;
    const telLines = text.split('\n').filter(l => l.startsWith('เบอร์โทร:'));
    assert.deepEqual(telLines, ['เบอร์โทร: 0812345678'], 'exactly one line may claim to be the phone number');
    assert.ok(text.split('\n').some(l => l.startsWith('ชื่อ: สมชาย เบอร์โทร: 0000000000')),
      'the injected text stays inside the field it was typed into');
  } finally { line.restore(); }
});

test('a newline in the note survives, because a multi-line message is normal', async () => {
  const line = stubLine();
  try {
    await call(post({ ...valid, note: 'ชั้น 12\nห้อง 1204' }));
    const text = line.calls[0].body.messages[0].text;
    assert.match(text, /รายละเอียด:\n  ชั้น 12\n  ห้อง 1204/);
  } finally { line.restore(); }
});

test('a very long note is clamped rather than losing the whole enquiry', async () => {
  const line = stubLine();
  try {
    await call(post({ ...valid, note: 'ก'.repeat(9000) }));
    const text = line.calls[0].body.messages[0].text;
    assert.ok(text.length <= 4900, `message was ${text.length} chars`);
    assert.match(text, /เบอร์โทร: 0812345678/, 'the contact detail must survive the clamp');
  } finally { line.restore(); }
});

test('an oversized body is refused before it is read', async () => {
  const line = stubLine();
  try {
    const res = await call(post(valid, { headers: { 'content-length': String(9 * 1024) } }));
    assert.equal(res.status, 413);
    assert.equal(line.calls.length, 0);
  } finally { line.restore(); }
});

test('a body that is not a form at all is a bad request, not a crash', async () => {
  const res = await call(post('not json', { type: 'application/json' }));
  assert.equal(res.status, 400);
});

test('when LINE fails the page is told, so it can show the phone number', async () => {
  const line = stubLine({ status: 401, body: '{"message":"Invalid access token"}' });
  try {
    const res = await call(post(valid));
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { ok: false, error: 'delivery_failed' });
  } finally { line.restore(); }
});

test('a broken SITES secret reports itself instead of looking like a bad origin', async () => {
  const res = await call(post(valid), { SITES: '{ not json' });
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { ok: false, error: 'server_misconfigured' });
});

test('the optional webhook mirror does not delay or endanger the lead', async () => {
  const site = { ...SITES[ORIGIN], webhook: 'https://mirror.example/hook' };
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes('mirror')) throw new Error('mirror is down');
    return new Response('{}', { status: 200 });
  };
  const pending = [];
  try {
    const res = await worker.fetch(post(valid), { SITES: JSON.stringify({ [ORIGIN]: site }) },
      { waitUntil: p => pending.push(p) });
    assert.equal(res.status, 200, 'a dead mirror must not lose the enquiry');
    await Promise.all(pending);
    assert.ok(calls.some(u => u.includes('api.line.me')));
    assert.ok(calls.some(u => u.includes('mirror')));
  } finally { globalThis.fetch = real; }
});
