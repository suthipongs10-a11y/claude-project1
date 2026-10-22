// Tests the Worker's real exported handler with real Request/Response objects.
// Only the outbound calls — LINE and the email API — are stubbed; everything
// the Worker does with the incoming request is the code that gets deployed,
// not a re-implementation.
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

test('the B2B fields reach the shop, each on its own labelled line', async () => {
  // A commercial enquiry is worthless without the business name and what they
  // are actually seeing — "somebody called about pests" is not a callback.
  const line = stubLine();
  try {
    await call(post({ ...valid, company: 'โรงแรมสมมติ สุขุมวิท', pest: 'หนู' }));
    const text = line.calls[0].body.messages[0].text;
    assert.match(text, /^สถานประกอบการ: โรงแรมสมมติ สุขุมวิท$/m);
    assert.match(text, /^ปัญหาที่พบ: หนู$/m);
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


// --- delivery channels ------------------------------------------------------
//
// The property under test throughout this block is one rule: the page may show
// its success panel only when something actually confirmed the enquiry. Every
// case below is that rule from a different angle — one channel, two channels,
// one of two down, both down, and none configured at all.

const EMAIL_ENV = { RESEND_KEY: 'test-key', EMAIL_FROM: 'WLC <leads@wlc.example>' };

/** Stub both outbound APIs at once and choose what each of them answers.
 *  Routes on the URL the Worker really calls, so a change of endpoint shows up
 *  here as a test that stops seeing traffic rather than one that quietly passes. */
function stubNet({ line = 200, email = 200, emailBody = '{"id":"e1"}' } = {}) {
  const calls = { line: [], email: [] };
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    const body = JSON.parse(init.body);
    if (u.includes('line')) {
      calls.line.push({ url: u, init, body });
      return new Response('{"message":"nope"}', { status: line });
    }
    calls.email.push({ url: u, init, body });
    return new Response(emailBody, { status: email });
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}

const envFor = (site, extra = {}) => ({
  SITES: JSON.stringify({ [ORIGIN]: site }), ...extra,
});

const EMAIL_SITE = { name: 'SPM', emailTo: 'bangkok@spm.example' };
const BOTH_SITE = { ...SITES[ORIGIN], ...EMAIL_SITE, name: 'CleanDay' };

test('a client with only an email address still gets the lead', async () => {
  const net = stubNet();
  try {
    const res = await call(post(valid), envFor(EMAIL_SITE, EMAIL_ENV));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });

    assert.equal(net.calls.line.length, 0, 'no LINE config means no LINE call');
    assert.equal(net.calls.email.length, 1);
    const sent = net.calls.email[0];
    assert.equal(sent.url, 'https://api.resend.com/emails');
    assert.equal(sent.init.headers.authorization, 'Bearer test-key');
    assert.equal(sent.body.from, 'WLC <leads@wlc.example>');
    assert.deepEqual(sent.body.to, ['bangkok@spm.example']);
    assert.match(sent.body.text, /เบอร์โทร: 0812345678/);
    assert.match(sent.body.html, /เบอร์โทร: 0812345678/);
  } finally { net.restore(); }
});

test('the subject line says who it is and how to reach them', async () => {
  // What the marketing desk sees in the inbox list decides whether this gets
  // opened now or after lunch, so it has to carry the lead on its own.
  const net = stubNet();
  try {
    await call(post({ ...valid, company: 'โรงแรมสมมติ' }), envFor(EMAIL_SITE, EMAIL_ENV));
    const subject = net.calls.email[0].body.subject;
    assert.match(subject, /SPM/);
    assert.match(subject, /โรงแรมสมมติ/);
    assert.match(subject, /0812345678/);
    assert.doesNotMatch(subject, /\n/, 'a subject must be one line');
  } finally { net.restore(); }
});

test('reply-to is the visitor, so answering is one click in their own mail client', async () => {
  const net = stubNet();
  try {
    await call(post({ ...valid, email: 'khun@example.com' }), envFor(EMAIL_SITE, EMAIL_ENV));
    assert.equal(net.calls.email[0].body.reply_to, 'khun@example.com');
  } finally { net.restore(); }
});

test('a mistyped email costs the reply-to, never the enquiry', async () => {
  // Resend rejects the whole message over a malformed Reply-To. Losing a lead
  // to somebody's typo would be a ridiculous way to lose one, so the header is
  // dropped and what they typed still travels in the body.
  const net = stubNet();
  try {
    const res = await call(post({ ...valid, email: 'khun@ example, com' }),
      envFor(EMAIL_SITE, EMAIL_ENV));
    assert.equal(res.status, 200);
    const sent = net.calls.email[0].body;
    assert.equal(sent.reply_to, undefined, 'no header we cannot vouch for');
    assert.match(sent.text, /khun@ example, com/, 'the client still sees what was typed');
  } finally { net.restore(); }
});

test('every address on the list gets it — a marketing desk is more than one person', async () => {
  const net = stubNet();
  try {
    const site = { ...EMAIL_SITE, emailTo: ['bangkok@spm.example', ' wattana@spm.example '] };
    await call(post(valid), envFor(site, EMAIL_ENV));
    assert.deepEqual(net.calls.email[0].body.to,
      ['bangkok@spm.example', 'wattana@spm.example']);
  } finally { net.restore(); }
});

test('a client with both channels gets the enquiry in both places', async () => {
  const net = stubNet();
  try {
    const res = await call(post(valid), envFor(BOTH_SITE, EMAIL_ENV));
    assert.equal(res.status, 200);
    assert.equal(net.calls.line.length, 1);
    assert.equal(net.calls.email.length, 1);
    assert.equal(net.calls.line[0].body.messages[0].text, net.calls.email[0].body.text);
  } finally { net.restore(); }
});

test('one channel down does not lose a lead the other one delivered', async () => {
  const net = stubNet({ line: 401 });
  try {
    const res = await call(post(valid), envFor(BOTH_SITE, EMAIL_ENV));
    assert.equal(res.status, 200, 'the email arrived, so the visitor was right to see a tick');
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(net.calls.email.length, 1, 'a dead LINE must not skip the email');
  } finally { net.restore(); }
});

test('the email is still attempted when LINE is the one that fails', async () => {
  // Not first-one-wins and not sequential: a client with both expects both.
  const net = stubNet({ email: 500 });
  try {
    const res = await call(post(valid), envFor(BOTH_SITE, EMAIL_ENV));
    assert.equal(res.status, 200);
    assert.equal(net.calls.line.length, 1);
  } finally { net.restore(); }
});

test('when every channel fails the page is told, so it can show the phone number', async () => {
  const net = stubNet({ line: 401, email: 422 });
  try {
    const res = await call(post(valid), envFor(BOTH_SITE, EMAIL_ENV));
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { ok: false, error: 'delivery_failed' });
  } finally { net.restore(); }
});

test('a client with no channel at all is a loud fault, never a silent ok', async () => {
  // The failure this whole Worker exists to prevent: a form that looks like it
  // worked and delivered nowhere. It must not be reachable by forgetting a key.
  const net = stubNet();
  try {
    const res = await call(post(valid), envFor({ name: 'Half-Set-Up' }, EMAIL_ENV));
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { ok: false, error: 'server_misconfigured' });
    assert.equal(net.calls.email.length + net.calls.line.length, 0);
  } finally { net.restore(); }
});

test('an email channel missing its API key is a fault, not a skipped channel', async () => {
  const net = stubNet();
  try {
    const res = await call(post(valid), envFor(EMAIL_SITE, {}));
    assert.equal(res.status, 500, 'a client who believes their form works must not be left believing it');
    assert.equal(net.calls.email.length, 0);
  } finally { net.restore(); }
});

test('a half-configured channel does not stop the working one', async () => {
  // emailTo set, no key: the email channel is broken, LINE is not. The lead
  // goes out on LINE and the gap is logged rather than costing the enquiry.
  const net = stubNet();
  try {
    const res = await call(post(valid), envFor({ ...BOTH_SITE }, {}));
    assert.equal(res.status, 200);
    assert.equal(net.calls.line.length, 1);
    assert.equal(net.calls.email.length, 0);
  } finally { net.restore(); }
});

test('the destination addresses come from our config, never from the body', async () => {
  const net = stubNet();
  try {
    await call(post({ ...valid, emailTo: 'attacker@evil.example', to: 'attacker@evil.example' }),
      envFor(EMAIL_SITE, EMAIL_ENV));
    assert.deepEqual(net.calls.email[0].body.to, ['bangkok@spm.example']);
    assert.doesNotMatch(JSON.stringify(net.calls.email[0].body), /evil\.example/);
  } finally { net.restore(); }
});

test('a note cannot inject markup into the HTML part of the email', async () => {
  const net = stubNet();
  try {
    await call(post({ ...valid, note: '<img src=x onerror=alert(1)>' }),
      envFor(EMAIL_SITE, EMAIL_ENV));
    const html = net.calls.email[0].body.html;
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  } finally { net.restore(); }
});


// --- several forms on one site ----------------------------------------------
//
// SPM has three: the survey request goes to marketing, job applications and
// franchise enquiries to HR. The page names the form; SITES names the inbox.

const FORMS_SITE = {
  name: 'SPM',
  emailTo: ['bangkok@spm.example'],
  forms: {
    job: { label: 'ใบสมัครงาน', emailTo: ['hr@spm.example'], attachPdf: true },
    franchise: { label: 'สนใจแฟรนไชส์', emailTo: ['hr@spm.example'] },
  },
};

test('a named form reaches its own inbox, and the survey keeps the old one', async () => {
  const net = stubNet();
  try {
    const env = envFor(FORMS_SITE, EMAIL_ENV);
    assert.equal((await call(post({ ...valid, form: 'franchise', province: 'เชียงใหม่' }), env)).status, 200);
    assert.equal((await call(post(valid), env)).status, 200);
    assert.deepEqual(net.calls.email[0].body.to, ['hr@spm.example']);
    assert.deepEqual(net.calls.email[1].body.to, ['bangkok@spm.example']);
    assert.match(net.calls.email[0].body.text, /จังหวัดที่สนใจ: เชียงใหม่/);
  } finally { net.restore(); }
});

test('an unknown form name still reaches somebody rather than nobody', async () => {
  const net = stubNet();
  try {
    for (const form of ['careers', '__proto__', 'toString', 'constructor']) {
      const res = await call(post({ ...valid, form }), envFor(FORMS_SITE, EMAIL_ENV));
      assert.equal(res.status, 200, form);
    }
    for (const sent of net.calls.email) assert.deepEqual(sent.body.to, ['bangkok@spm.example']);
  } finally { net.restore(); }
});

test('HR can tell an application from a customer before opening it', async () => {
  const net = stubNet();
  try {
    await call(post({ ...valid, form: 'job', position: 'Technician / ช่างบริการกำจัดแมลง' }),
      envFor(FORMS_SITE, EMAIL_ENV));
    const { subject, text } = net.calls.email[0].body;
    assert.match(subject, /ใบสมัครงาน Technician/);
    assert.doesNotMatch(subject, /ลูกค้าใหม่/);
    assert.match(text, /^📩 ใบสมัครงานจากเว็บไซต์ SPM/);
    assert.match(text, /ตำแหน่งที่สมัคร: Technician/);
  } finally { net.restore(); }
});

test('an application carries the applicant\'s education and email to HR', async () => {
  const net = stubNet();
  try {
    await call(post({ ...valid, form: 'job', email: 'applicant@example.com',
      education: "Bachelor's degree / ปริญญาตรี", position: 'IT / งานสารสนเทศ' }), envFor(FORMS_SITE, EMAIL_ENV));
    const { text, reply_to } = net.calls.email[0].body;
    assert.match(text, /ระดับการศึกษา: Bachelor's degree \/ ปริญญาตรี/);
    assert.equal(reply_to, 'applicant@example.com', 'HR answers the applicant with one click');
  } finally { net.restore(); }
});

test('a form entry that names no working channel is a loud fault', async () => {
  const site = { ...FORMS_SITE, forms: { job: { emailTo: 'not-an-address' } } };
  const net = stubNet();
  try {
    const res = await call(post({ ...valid, form: 'job' }), envFor(site, EMAIL_ENV));
    assert.equal(res.status, 500);
    assert.equal(net.calls.email.length, 0);
  } finally { net.restore(); }
});

// --- a CV on the job form ----------------------------------------------------

const pdfBytes = (size = 2048) => {
  const b = new Uint8Array(size).fill(0x20);
  b.set(new TextEncoder().encode('%PDF-1.7\n'));
  return b;
};

/** A real multipart post: the browser's own FormData, boundary and all. */
const postForm = (fields, file, { headers = {} } = {}) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  if (file) fd.append('file', file);
  return new Request('https://form.example/', { method: 'POST', headers: { origin: ORIGIN, ...headers }, body: fd });
};

const job = { ...valid, form: 'job', position: 'Inspector / เจ้าหน้าที่ตรวจสอบอาวุโส' };

test('a PDF reaches HR as an attachment, byte for byte', async () => {
  const net = stubNet();
  try {
    const bytes = pdfBytes(5000);
    const res = await call(postForm(job, new File([bytes], 'สมชาย ใจดี CV.pdf', { type: 'application/pdf' })),
      envFor(FORMS_SITE, EMAIL_ENV));
    assert.equal(res.status, 200);
    const sent = net.calls.email[0].body;
    assert.deepEqual(sent.to, ['hr@spm.example']);
    assert.equal(sent.attachments.length, 1);
    assert.equal(sent.attachments[0].filename, 'สมชาย ใจดี CV.pdf');
    assert.deepEqual(new Uint8Array(Buffer.from(sent.attachments[0].content, 'base64')), bytes);
    assert.match(sent.text, /ไฟล์แนบ: สมชาย ใจดี CV\.pdf \(5 KB\)/);
  } finally { net.restore(); }
});

test('something that is not a PDF is refused, whatever it is called', async () => {
  const net = stubNet();
  try {
    const exe = new File([new TextEncoder().encode('MZ\x90\x00 not a pdf')], 'cv.pdf', { type: 'application/pdf' });
    const res = await call(postForm(job, exe), envFor(FORMS_SITE, EMAIL_ENV));
    assert.equal(res.status, 415);
    assert.deepEqual(await res.json(), { ok: false, error: 'file_not_pdf' });
    assert.equal(net.calls.email.length, 0);
  } finally { net.restore(); }
});

test('a PDF over 4MB is refused, and so is a body claiming to be one', async () => {
  const net = stubNet();
  try {
    const big = new File([pdfBytes(4 * 1024 * 1024 + 1)], 'cv.pdf');
    const res = await call(postForm(job, big), envFor(FORMS_SITE, EMAIL_ENV));
    assert.equal(res.status, 413);
    assert.deepEqual(await res.json(), { ok: false, error: 'file_too_large' });

    const claimed = postForm(job, new File([pdfBytes()], 'cv.pdf'),
      { headers: { 'content-length': String(5 * 1024 * 1024) } });
    assert.equal((await call(claimed, envFor(FORMS_SITE, EMAIL_ENV))).status, 413);
    assert.equal(net.calls.email.length, 0);
  } finally { net.restore(); }
});

test('a site with no file-taking form keeps the small cap', async () => {
  const res = await call(postForm(valid, null, { headers: { 'content-length': String(9 * 1024) } }),
    envFor(EMAIL_SITE, EMAIL_ENV));
  assert.equal(res.status, 413);
});

test('a file sent to a form that takes none is dropped, the enquiry is not', async () => {
  const net = stubNet();
  try {
    const res = await call(postForm({ ...valid, form: 'franchise' }, new File([pdfBytes()], 'cv.pdf')),
      envFor(FORMS_SITE, EMAIL_ENV));
    assert.equal(res.status, 200);
    assert.equal(net.calls.email[0].body.attachments, undefined);
  } finally { net.restore(); }
});

test('an application without a file still arrives', async () => {
  // An empty file input posts a nameless zero-byte file. That is "no CV",
  // and HR would rather have the phone number than nothing.
  const net = stubNet();
  try {
    const res = await call(postForm(job, new File([], '')), envFor(FORMS_SITE, EMAIL_ENV));
    assert.equal(res.status, 200);
    assert.equal(net.calls.email[0].body.attachments, undefined);
  } finally { net.restore(); }
});

test('the attachment name cannot carry a path or a second extension', async () => {
  const net = stubNet();
  try {
    await call(postForm(job, new File([pdfBytes()], '../../evil<script>.exe.pdf')), envFor(FORMS_SITE, EMAIL_ENV));
    const name = net.calls.email[0].body.attachments[0].filename;
    assert.doesNotMatch(name, /[\/<>]/);
    assert.match(name, /\.pdf$/);
    assert.equal(name.match(/\.pdf/g).length, 1);
  } finally { net.restore(); }
});

test('a CV with only LINE to go to is a loud fault, not a lost file', async () => {
  const site = { ...SITES[ORIGIN], forms: { job: { attachPdf: true } } };
  const net = stubNet();
  try {
    const res = await call(postForm(job, new File([pdfBytes()], 'cv.pdf')), envFor(site));
    assert.equal(res.status, 500);
    assert.equal(net.calls.line.length, 0);
  } finally { net.restore(); }
});

test('the webhook mirror gets the application, not the CV', async () => {
  const site = { ...FORMS_SITE, webhook: 'https://mirror.example/hook' };
  const net = stubNet();
  const pending = [];
  try {
    await worker.fetch(postForm(job, new File([pdfBytes()], 'cv.pdf')), envFor(site, EMAIL_ENV),
      { waitUntil: p => pending.push(p) });
    await Promise.all(pending);
    const mirror = net.calls.email.find(c => c.url.includes('mirror'));
    assert.ok(mirror, 'the mirror was called');
    assert.equal(mirror.body.form, 'job');
    assert.doesNotMatch(JSON.stringify(mirror.body), /content/);
  } finally { net.restore(); }
});
