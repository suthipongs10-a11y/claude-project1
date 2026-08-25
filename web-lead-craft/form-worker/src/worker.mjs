// One Cloudflare Worker serving the contact form on every client site.
//
// A static site has nowhere to POST to, so this is the receiver: it takes the
// form, works out which client it belongs to from the Origin header, and
// delivers the enquiry to whichever channels that client has configured —
// their LINE Official Account, their email inbox, or both.
//
// Delivery is channel-agnostic on purpose. Which channel a client can actually
// use is decided by what THEY already run, not by what we implemented: a shop
// with a LINE OA wants LINE, an office that lives in Outlook wants email, and
// asking a client to set up the one we happen to support is how a launch slips
// by three weeks. Adding a channel to a live client stays a SITES edit.
//
// Deliberately one Worker rather than one per client. Adding a client is a
// change to the SITES secret, never a deploy — the same rule the rest of this
// business runs on: moving a client must be config, not code.
//
// Free tier: 100,000 requests/day. A shop's contact form uses double digits.
//
// No KV, no Durable Object, no database. Nothing is stored here — the enquiry
// is forwarded and forgotten, which is also the cheapest thing to say honestly
// on a privacy page.

/** Longest body we will even read. A contact form is small; anything much
 *  larger is someone probing, and we should not spend CPU on it. */
const MAX_BODY = 8 * 1024;

/** Per-field caps. Thai runs longer than the Latin equivalent, so these are
 *  generous — the point is to stop a novel, not to police a message. */
const LIMITS = { name: 120, company: 160, tel: 40, email: 160, type: 80, pest: 80, size: 40, date: 40, slot: 80, note: 2000 };

/** Fields we accept at all. Anything else in the body is dropped rather than
 *  forwarded: a form that relays arbitrary keys is a relay for whatever an
 *  attacker puts in them. */
const FIELDS = Object.keys(LIMITS);

/** Labels for the LINE message, so the shop owner reads Thai and not JSON. */
const LABELS = {
  name: 'ชื่อ', company: 'สถานประกอบการ', tel: 'เบอร์โทร', email: 'อีเมล',
  type: 'ประเภท', pest: 'ปัญหาที่พบ', size: 'ขนาดพื้นที่', date: 'วันที่สะดวก',
  slot: 'ช่วงเวลา', note: 'รายละเอียด',
};

/** Field names that no person should ever fill in. See the check below for
 *  why none of them looks like something a browser would autofill. */
const HONEYPOTS = ['wlc_hp', '_gotcha'];

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

/** CORS for one caller. The allowlist is the SITES secret — an origin with no
 *  entry gets no header back, so the browser blocks the response itself. */
function cors(origin, allowed) {
  if (!allowed) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

const reply = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });

/** Parse the SITES secret once per isolate. It is a JSON object keyed by the
 *  site's origin:
 *
 *  { "https://cleanday.co.th": {
 *      "name": "CleanDay",
 *
 *      // LINE channel — both keys, or neither.
 *      "lineToken": "…channel access token…",
 *      "lineTo": "…userId or groupId to push to…",
 *
 *      // Email channel — one address or several. `emailFrom` may be omitted
 *      // and defaults to the EMAIL_FROM secret; the API key always does.
 *      "emailTo": ["sales@cleanday.co.th", "owner@cleanday.co.th"],
 *      "emailFrom": "CleanDay Website <leads@ourdomain.com>",
 *
 *      "webhook": "https://…"        // optional, gets the same JSON
 *  } }
 *
 *  At least one channel must be configured. A site entry with none is a
 *  misconfiguration that gets a 500, never a cheerful 200 — see deliver().
 *
 *  Kept as one secret rather than one per client so adding a client is a
 *  single `wrangler secret put`, and so a token never lands in wrangler.toml.
 */
function loadSites(env) {
  if (!env.SITES) return {};
  try {
    return typeof env.SITES === 'string' ? JSON.parse(env.SITES) : env.SITES;
  } catch {
    // A malformed secret must not look like "no such client" — that would send
    // us hunting the origin allowlist while the real fault is a stray comma.
    throw new Error('SITES secret is not valid JSON');
  }
}

/** Strip control characters and clamp length. Newlines survive in `note`
 *  because a multi-line message is normal; everything else is one line. */
const CTRL_ALL = /[\u0000-\u001f\u007f]/g;
const CTRL_KEEP_NEWLINE = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

function clean(value, field) {
  if (typeof value !== 'string') return '';
  return value
    .replace(field === 'note' ? CTRL_KEEP_NEWLINE : CTRL_ALL, ' ')
    .trim()
    .slice(0, LIMITS[field]);
}

/** Read the body whichever way the form sent it. A plain HTML form posts
 *  urlencoded when JS is off, and our JS posts JSON — both must work, because
 *  a form that only works with JavaScript is a form that sometimes does not. */
async function readBody(request) {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return await request.json();
  if (type.includes('form')) return Object.fromEntries(await request.formData());
  throw new Error('unsupported content type');
}

/** The message the shop owner actually reads on their phone.
 *
 *  `note` is the one field that keeps its newlines, so it is the one field a
 *  visitor could use to type a line looking exactly like another label — a
 *  second "เบอร์โทร:" line is a wrong number to call. Its lines are therefore
 *  indented under a heading of their own, which no label line ever is. */
function composeMessage(site, fields, meta) {
  const lines = [`📩 ลูกค้าใหม่จากเว็บไซต์ ${site.name ?? ''}`.trim(), ''];
  for (const key of FIELDS) {
    if (!fields[key]) continue;
    if (key === 'note') {
      lines.push(`${LABELS[key]}:`, ...fields[key].split('\n').map(l => `  ${l}`));
    } else {
      lines.push(`${LABELS[key]}: ${fields[key]}`);
    }
  }
  if (meta.page) lines.push('', `หน้า: ${meta.page}`);
  // LINE rejects a text message over 5,000 characters outright, and losing the
  // whole enquiry to a long note would be the worst possible failure here.
  return lines.join('\n').slice(0, 4900);
}

/** An address we are willing to put in a Reply-To header.
 *
 *  Deliberately strict about what it refuses rather than clever about what it
 *  accepts: no whitespace, no comma or semicolon, no angle brackets. Those are
 *  the characters that turn one recipient into several, or a bare address into
 *  a display name pointing somewhere else. */
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/i;

/** Where the client wants their enquiries. Accepts one address or a list —
 *  SPM's marketing desk is two people, and a lead should reach both. */
function recipients(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(',');
  return list.map(a => String(a).trim()).filter(a => EMAIL_RE.test(a));
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ESCAPES[c]);

/** The line the client sees in their inbox list, before they open anything.
 *
 *  Who and how-to-reach-them, because that is what decides whether this gets
 *  opened now or after lunch. `note` is not in here — it is the one field that
 *  keeps newlines, and a subject must be one line. */
function composeSubject(site, fields) {
  const who = fields.company || fields.name || 'ผู้ติดต่อใหม่';
  const how = fields.tel || fields.email;
  return `[${site.name ?? 'เว็บไซต์'}] ลูกค้าใหม่: ${who}${how ? ` · ${how}` : ''}`
    .replace(/\s+/g, ' ')
    .slice(0, 180);
}

/** Same text, wrapped so a mail client renders the line breaks. `pre-wrap`
 *  rather than <br>: nothing to escape wrongly, and it still wraps on a phone. */
const emailHtml = text =>
  '<div style="font-family:system-ui,-apple-system,\'Segoe UI\',Roboto,sans-serif;' +
  'font-size:15px;line-height:1.7;color:#10263F;white-space:pre-wrap">' +
  escapeHtml(text) + '</div>';

/** Send through Resend. Their REST API takes JSON, so no header of ours is
 *  built by string concatenation and there is nothing for a newline to break.
 *
 *  Reply-To is the entire point of the email channel: the client hits reply in
 *  the mail client they already have open and it goes to the customer. But an
 *  address that fails EMAIL_RE is dropped rather than sent — Resend rejects the
 *  whole message over a malformed Reply-To, and losing an enquiry to somebody's
 *  typo would be a ridiculous way to lose it. What they typed still appears in
 *  the body either way. */
async function sendEmail(channel, fields, text, subject) {
  const replyTo = EMAIL_RE.test(fields.email) ? fields.email : undefined;
  const res = await fetch(`${channel.api}/emails`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${channel.key}` },
    body: JSON.stringify({
      from: channel.from,
      to: channel.to,
      subject,
      text,
      html: emailHtml(text),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`email ${res.status}: ${detail.slice(0, 200)}`);
  }
}

async function pushToLine(site, text) {
  const res = await fetch(`${site.lineApi ?? 'https://api.line.me'}/v2/bot/message/push`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${site.lineToken}`,
    },
    body: JSON.stringify({ to: site.lineTo, messages: [{ type: 'text', text }] }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LINE ${res.status}: ${detail.slice(0, 200)}`);
  }
}

/** Work out which channels this client actually has, and say plainly why any
 *  half-configured one was skipped.
 *
 *  "Half-configured" matters more than it looks: a site with `emailTo` but no
 *  sending key is a client who believes their form works. Skipping that in
 *  silence is how a lead disappears with nobody to notice, so it is logged
 *  even when the other channel carries the message.
 */
function channelsFor(site, env, skipped) {
  const channels = [];

  if (site.lineToken && site.lineTo) {
    channels.push({ name: 'line', send: text => pushToLine(site, text) });
  } else if (site.lineToken || site.lineTo) {
    skipped.push('line: needs both lineToken and lineTo');
  }

  if (site.emailTo) {
    const key = site.resendKey ?? env.RESEND_KEY;
    const from = site.emailFrom ?? env.EMAIL_FROM;
    const to = recipients(site.emailTo);
    if (key && from && to.length) {
      const channel = { api: site.emailApi ?? 'https://api.resend.com', key, from, to };
      channels.push({
        name: 'email',
        send: (text, fields, subject) => sendEmail(channel, fields, text, subject),
      });
    } else {
      skipped.push(`email: missing ${[!key && 'API key', !from && 'from address',
        !to.length && 'a valid recipient'].filter(Boolean).join(', ')}`);
    }
  }

  return channels;
}

/** Try every channel, and treat the enquiry as delivered if any one of them
 *  confirms.
 *
 *  Not sequential, and not first-one-wins. A client with both channels expects
 *  the lead in both places, so both are attempted; and if LINE is down while
 *  email is up, the visitor should still see "we got it", because we did.
 *
 *  The rule this exists to keep: the page may only show its success panel once
 *  something actually confirmed. Zero confirmations is a 502 and a phone
 *  number on screen, never a green tick. */
async function deliver(channels, text, fields, subject) {
  const results = await Promise.allSettled(
    channels.map(c => c.send(text, fields, subject)));

  const failures = results
    .map((r, i) => r.status === 'rejected'
      ? `${channels[i].name}: ${r.reason?.message ?? r.reason}` : null)
    .filter(Boolean);

  return { delivered: results.length - failures.length, failures };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('origin') ?? '';

    let sites;
    try {
      sites = loadSites(env);
    } catch (err) {
      console.error(err.message);
      return reply(500, { ok: false, error: 'server_misconfigured' });
    }
    const site = sites[origin];

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: site ? 204 : 403, headers: cors(origin, site) });
    }
    if (request.method !== 'POST') {
      return reply(405, { ok: false, error: 'method_not_allowed' }, cors(origin, site));
    }
    // An unknown origin gets the same answer as a wrong one, and no CORS
    // header — so a probe cannot enumerate which domains we serve.
    if (!site) return reply(403, { ok: false, error: 'unknown_site' });

    // Before anything else: can we deliver at all? A client whose entry names
    // no working channel must fail here, loudly and every time. The tempting
    // alternative — accept the form and drop it — is the one failure this
    // whole Worker exists to prevent, and it would look fine from the outside.
    const skipped = [];
    const channels = channelsFor(site, env, skipped);
    if (skipped.length) console.error(`config gap for ${origin} — ${skipped.join(' | ')}`);
    if (!channels.length) {
      console.error(`no delivery channel configured for ${origin}`);
      return reply(500, { ok: false, error: 'server_misconfigured' }, cors(origin, site));
    }

    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > MAX_BODY) {
      return reply(413, { ok: false, error: 'too_large' }, cors(origin, site));
    }

    let raw;
    try {
      raw = await readBody(request);
    } catch {
      return reply(400, { ok: false, error: 'bad_request' }, cors(origin, site));
    }

    // Honeypot: a field hidden from people and irresistible to form bots.
    // Answer 200 rather than an error — a bot told it failed simply retries
    // with the field left blank, and then we would have taught it the bypass.
    //
    // None of these names is an autofill type. A honeypot called "website" or
    // "url" is one the browser may fill in for a real customer, and then every
    // genuine enquiry is dropped in silence — the exact failure this whole
    // Worker exists to prevent.
    if (HONEYPOTS.some(k => clean(raw[k], 'name'))) {
      return reply(200, { ok: true }, cors(origin, site));
    }

    // Filled in faster than a person can type: same treatment as the honeypot.
    const elapsed = Number(raw.elapsed ?? 0);
    if (elapsed && elapsed < 2500) {
      return reply(200, { ok: true }, cors(origin, site));
    }

    const fields = {};
    for (const key of FIELDS) fields[key] = clean(raw[key], key);

    // One contactable route is the whole point of the form. Everything else,
    // including the name, is optional — a phone number alone is a lead.
    if (!fields.tel && !fields.email) {
      return reply(422, { ok: false, error: 'contact_required' }, cors(origin, site));
    }

    const meta = { page: clean(raw.page ?? '', 'name') };
    const text = composeMessage(site, fields, meta);
    const subject = composeSubject(site, fields);

    const { delivered, failures } = await deliver(channels, text, fields, subject);
    if (failures.length) console.error(`delivery failed for ${origin} — ${failures.join(' | ')}`);
    if (!delivered) {
      // The enquiry is lost if we answer ok here, so say so plainly and let
      // the page show its fallback: call, or message the shop on LINE.
      return reply(502, { ok: false, error: 'delivery_failed' }, cors(origin, site));
    }

    // A mirror of the same enquiry to anywhere else the client wants it —
    // spreadsheet, CRM, Zapier. Deliberately after delivery and deliberately
    // not awaited: a broken webhook must not lose a lead.
    if (site.webhook) {
      const mirror = fetch(site.webhook, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ site: site.name, origin, fields, meta, text }),
      }).catch(err => console.error(`webhook failed for ${origin}: ${err.message}`));
      if (ctx?.waitUntil) ctx.waitUntil(mirror);
    }

    return reply(200, { ok: true }, cors(origin, site));
  },
};
