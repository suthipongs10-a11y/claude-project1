// One Cloudflare Worker serving the contact form on every client site.
//
// A static site has nowhere to POST to, so this is the receiver: it takes the
// form, works out which client it belongs to from the Origin header, and
// pushes the enquiry into that client's LINE Official Account.
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
const LIMITS = { name: 120, tel: 40, email: 160, type: 80, size: 40, date: 40, slot: 80, note: 2000 };

/** Fields we accept at all. Anything else in the body is dropped rather than
 *  forwarded: a form that relays arbitrary keys is a relay for whatever an
 *  attacker puts in them. */
const FIELDS = Object.keys(LIMITS);

/** Labels for the LINE message, so the shop owner reads Thai and not JSON. */
const LABELS = {
  name: 'ชื่อ', tel: 'เบอร์โทร', email: 'อีเมล', type: 'ประเภท',
  size: 'ขนาดพื้นที่', date: 'วันที่สะดวก', slot: 'ช่วงเวลา', note: 'รายละเอียด',
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
 *      "lineToken": "…channel access token…",
 *      "lineTo": "…userId or groupId to push to…",
 *      "webhook": "https://…"        // optional, gets the same JSON
 *  } }
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

    try {
      await pushToLine(site, text);
    } catch (err) {
      // The enquiry is lost if we simply 500 here, so say so plainly and let
      // the page show its fallback: call, or message the shop on LINE.
      console.error(`push failed for ${origin}: ${err.message}`);
      return reply(502, { ok: false, error: 'delivery_failed' }, cors(origin, site));
    }

    // A mirror of the same enquiry to anywhere else the client wants it —
    // email service, spreadsheet, CRM. Deliberately after the LINE push and
    // deliberately not awaited: a broken webhook must not lose a lead.
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
