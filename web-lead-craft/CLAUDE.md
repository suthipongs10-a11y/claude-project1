# CLAUDE.md — Web Lead Craft (client website production line)

Context file for work inside `web-lead-craft/`. The operator speaks Thai —
respond in Thai; keep code, comments and commits in English.

## What this is

A Thai freelance web-building business. Packages sold: 990 THB (one-page),
1,990 THB (one-page, 2 languages + LINE notify), 5,990 THB (multi-page + CMS).
The operator sells and talks to clients; Claude builds. `README.md` (Thai) has
the day-to-day workflow and Cloudflare Pages limits.

## Hard rules

1. **Static sites only. Never WordPress** — decided 2026-08-05, do not reopen.
2. **Never host client sites on the RO game VPS** (my-episode project) — that
   box is a DDoS target by nature. Client sites go to Cloudflare Pages.
3. One folder per site under `sites/<name>/` with the same contract:
   `site.json` (domain, brand name) and `src/` holding `head.html` (meta only),
   `styles.css`, `body.html` (markup + script), `favicon.svg`, and the
   generated `fonts.css`. Build with `node tools/build-site.mjs sites/<name>`.
   **Only `dist/` is ever deployed** — shipping the site folder would expose
   `src/` and `preview.html`.
4. Deliverables are **self-contained**: fonts embedded as data URIs
   (`tools/fetch-fonts.mjs`, thai+latin subsets only), icons as an inline SVG
   sprite, zero external requests. This is what makes the same page work both
   deployed and as a claude.ai artifact preview (artifact CSP blocks CDNs),
   and what makes PageSpeed trivially green.
   **Photos are the exception** — a data URI cannot be lazy-loaded, cached
   separately, or sized to the viewport. Masters live full-resolution in
   `src/img/*.webp` (committed); `tools/images.mjs` derives 480/800/1200 into
   `dist/img/` behind a `srcset`, and inlines them only for `preview.html`.
   Reference them from `body.html` as `{{img:name:sizes}}`, never a raw `src`.
   Every `<img>` needs Thai `alt` text plus `width`/`height` — and any CSS
   sizing it must set `height: auto`, or the attribute beats `aspect-ratio`.
5. Demo sites: fictional brand + fictional contact details, a footer
   disclaimer saying so, and the Web Lead Craft credit strip
   (LINE: kitty4uu · 099-151-4049). A demo doubles as an ad.
6. "LINE แจ้งเตือน" features must use the LINE Messaging API with a LINE
   Official Account. LINE Notify was discontinued March 2025 — never quote it.
   **A static site has nowhere to POST to, so every contact form goes through
   `form-worker/`** — one Cloudflare Worker for all clients, keyed on the
   site's Origin. A client is added by editing the SITES secret, never by
   deploying. Point a site at it with `FORM_ENDPOINT` in `head.html`; empty
   means demo mode, where the form only pretends to send.

   **Delivery is channel-agnostic: LINE, email, or both** (2026-08-25).
   Which one a client uses is decided by what they already run, not by what we
   built. **Default to email.** Not because it is better — because LINE needs
   the *client* to enable Messaging API and dig a `lineTo` out of the LINE
   Developers Console, and a client who has never opened that page is a launch
   that slips by weeks. Email needs nothing from them but an address: the
   Resend account and the sending domain are ours. Adding LINE to a live client
   later is one line in the SITES secret.
   Email sends from **our** domain, never the client's — putting an `include:`
   into a company's existing SPF record risks their whole outbound mail, and
   `Reply-To` (the visitor's own address, validated first) gives the client
   the one-click reply that was the point anyway. An address that fails
   validation loses the header, never the enquiry.

   Three rules that are not negotiable:
   - **The success panel may only appear after delivery is confirmed** — a lost
     enquiry the shop never learns about is the worst thing this business can
     ship. With several channels that means *at least one confirmed*; all
     channels are attempted, and 502 only when every one of them failed.
   - **A site with no complete channel is a loud 500, every time.** Accepting a
     form we cannot deliver is the same lost lead wearing a green tick, and it
     would look fine from the outside — which is exactly why it must fail.
   - **A honeypot field must never be named `website`, `url` or `email2`**,
     because browser autofill would fill it for a real customer and drop every
     genuine lead in silence.
   **Never add a Meta/Facebook Pixel to a client site** — dropped 2026-08-06.
   The snippet is trivial; the support is not. Selling it invites Business
   Suite questions the operator cannot answer, and a feature we cannot support
   costs more than one we do not offer. Analytics stays on Google, which we
   can support. A link to the client's own Facebook page is unrelated and fine.
7. Reveal-on-scroll must be gated behind a JS-added `.anim` class so content
   is never hidden when scripts don't run (this bug was already made and
   fixed once — see demo-cleaning).
8. **Every package ships a privacy page.** A form taking a name and a phone
   number collects personal data, so PDPA applies at 990 THB as much as at
   5,990 — decided 2026-08-06, and it is quoted as included, not as an extra.
   A one-page site emits it from `src/privacy.html`; a multi-page site makes it
   a `src/pages/` file with no `nav:` entry. Link it from the footer and from
   under the form's submit button, which is where the data is actually taken.
   **A cookie bar belongs only on a site that installs a tracker** — CleanDay
   sets no cookies at all, and a consent bar there would be theatre. Where one
   does exist, the analytics must genuinely be gated on the answer: the policy
   page promises that in writing, and HOMEKEEP shipped the promise before the
   code kept it. `qa-site.mjs` drives the bar and intercepts the tracker
   request to prove it, so do not hand-verify this.
9. **`node tools/qa-site.mjs sites/<name>` must print PASS before any site is
   shown to a client.** Every check in it corresponds to something that has
   already shipped broken here: invisible sections, sideways scroll, 20px-tall
   footer links, an over-long `<title>`. Do not hand over on a red run, and do
   not weaken a check to make it green — fix the site.

## Multi-language sites (Business package and up)

**One page, switched in place** — the operator's call, made after separate
`/` and `/en/` pages meant the switch 404'd when the built file was opened off
disk. `site.json` lists the languages, `{{t|ไทย|English}}` carries both
phrases anywhere in `head.html`/`body.html`, and `{{SWITCHER}}` places the
buttons. The build picks a mechanism per context: dual `<span data-t lang>` for
text (CSS hides the inactive one, so it leaves the accessibility tree too), and
a JSON island the switch reads for attributes and `<option>` text, which cannot
hold markup. `<title>`, the meta description and `<html lang>` update with it;
the choice persists in localStorage. A token missing a phrase fails the build.

Do not restore language auto-detection from `navigator.language`: English-locale
phones are common in Thailand, so it put Thai visitors on the English copy.

The cost, and it should be quoted honestly: one URL means Google ranks one
language. Separate `/` and `/en/` pages are a bigger job, not the default.

Two sizing rules this package makes load-bearing:
- **Grid tracks holding translated copy must be `minmax(0, Nfr)`, never bare
  `Nfr`** — a bare `fr` will not shrink below its content's min-content width,
  so the longer language steals width from its neighbour.
- **No `white-space: nowrap` on a translated phrase.** It pins min-content to
  the whole phrase; the English hero em overflowed its column into the photo
  that way. Underline such a phrase with a background gradient plus
  `box-decoration-break: clone` so it can wrap.

`qa-site.mjs` drives the switch itself and, in every language, checks that
nothing from another language is still visible, that every translated attribute
actually changed, and that no element spills sideways out of its parent.

## Multi-page sites (Premium package)

A site opts in by having `src/pages/`; `tools/pages.mjs` then drives pages,
articles, nav, breadcrumbs and article listings. Metadata rides in comment
front matter so source files stay valid HTML. Output is **flat `.html`**, not
`folder/index.html` — the only layout where one set of links works both on a
server and from a double-clicked file, since a directory URL has no index off
disk. Everything an article links to or loads goes through `{{BASE}}`, which
resolves to `../` one level down; forgetting it is how article images 404'd.

Every page needs exactly one `<h1>` and its own `<title>`. Both are checked.

## Where the Premium tier's cost actually sits

The demo's back-office panel is illustrative and labelled as such — the
operator chose that over wiring a real CMS. When a paying client wants the
real thing, it is Sveltia CMS (git-based, free, one Cloudflare Worker serves
every client site via ALLOWED_DOMAINS) and it brings two consequences worth
quoting for: the client needs a GitHub account to log in, and the site must
use Cloudflare's Git integration rather than Direct Upload, so every content
save spends one of the account's 500 monthly builds — shared across all sites.

Three line items on that tier are services, not site features, and need
written scope or they eat the margin: the 30-day support window, the
statistics reporting, and Google Business Profile (whose verification is
Google's timeline and needs the client, not us).

## Colour variants of a finished site

A client who likes the layout but not the palette is routine. `tools/theme-variant.mjs`
generates a sibling site folder from a declared colour map, and it is the only
sanctioned way to do it — hand-editing hex values across five files is how a
theme ends up 95% swapped, which reads as a bug rather than a decision.

Two things make it work, and both are load-bearing:

- **The source site keeps every colour in a small set of literals**, declared in
  the `:root` block of its `styles.css`. If a new rule invents a colour inline,
  the variants silently keep the old one there.
- **Token names say what a colour does, not what it looks like** — `--brand`,
  `--brand-deep`, `--highlight`, `--accent`. `--forest: #17386B` in a navy theme
  is the confusion this avoids. `spm-pest` was renamed for exactly this reason.

The tool fails loudly on two conditions rather than producing something
plausible: any source colour surviving anywhere in the output, and any declared
contrast pair falling under WCAG AA. Each theme lists its own pairs, so a
palette is measured rather than admired. Run `qa-site.mjs` on every variant
afterwards — it is a separate site as far as the checks are concerned.

Real-world object colours stay put on purpose: the LINE green, the error reds,
and the amber glue board in the light-trap illustration are not theme colours.

**A light theme needs one more thing: the dark bands must be tokens too.** The
hero, the assurance strip, coverage and the form's ground are structure, and
what sits on them was written as literal `#fff` and `rgba(255,255,255,…)`. That
makes a light variant impossible without forking the CSS. `spm-pest` therefore
states the contract — `--panel`, `--on-panel`, `--on-panel-body/dim/faint`,
`--panel-line`, `--panel-card`, `--ghost-*`, plus `--on-brand` and
`--on-highlight` for what reads on a solid fill. `spm-pest-sky` is a pure
substitution because of it. When adding a rule to any band, reach for those
tokens, never `#fff`.

## `.x span` is a trap in a bilingual site

`{{t|…|…}}` compiles to `<span data-t>`. So a rule written `.assure-item span`
also matches the translation span **inside the `<b>` beside the caption** — and
both selectors weigh (0,1,1), so whichever is written second wins. Fourteen
bold headings across four components were rendering at the caption's font size
and dimmed colour, in every theme, and it survived several rounds of eyeballing
because the text is still bold and the colour shift is subtle on a dark panel.

Write the child combinator: `.assure-item > div > span`, `.stat > span`,
`.cover-item > span`. The same applies to `.x b`, `.x i`, `.x small` wherever a
translated sibling exists.

**`qa-site.mjs` now measures this**, because looking never caught it: for every
`<b>`/`<strong>`/`<em>`/`<i>`/`<small>`/heading holding a translation span, the
element's computed size and colour must equal the span's. It shipped broken in
`demo-cleaning-biz` (16 elements, including all four package prices at 13.6px
grey where the design says 32px ink) and `demo-cleaning-pro` (20, the pricing
page among them) and was invisible on both until it was measured.

## A master narrower than 1200px used to ship a broken image

`buildDerivatives()` refuses to upscale, but `applyImages()` wrote
`src="…-1200.webp"` and a full three-width srcset regardless. Any master under
1200px therefore pointed at a file that was never written — a broken `<img>` on
the page. It never fired on the demos because every stock photo in them happens
to be wider than 1200; the first client to send photographs off a phone hit it
immediately.

`availableWidths(masterWidth)` is now the single answer to "which files exist",
called by the writer and the rewriter both, so they cannot disagree. It also
adds the master's own width when it falls between two steps, so a 720px phone
photo is served at 720 instead of dropping to 480.

**Client photos come off phones.** Expect portrait, expect under 1200px wide,
and crop rather than upscale — `tools/` has no upscaler and should not get one.

**`buildDerivatives` derives every master in `src/img/`, referenced or not.**
It only prunes a derivative whose *master* is gone, so a photo the design has
moved on from keeps shipping in `dist/` forever — a third of spm-live's deploy
was images no page requested. A client's own photographs should not be deleted
just because this round replaced them, so park them in `src/img/unused/`:
`listImages` reads one level and filters on `.webp`, so a subdirectory drops
out of the build while staying in the repo and in reach.

## A photograph as a section's ground, not an exhibit beside it

SPM asked for this four times before it was actually what they meant. Round
one: a veil over a framed photo in a side column. Rejected — "faint like a
background", not a tinted exhibit. Round two: the same veil on every framed
photo on the page. Still rejected — they wanted the *hero's* full-bleed
treatment specifically, on every section, and the documentary work-gallery
gone outright, because a grid of captioned photos is the opposite of a photo
used as ground. Round three shipped that. Round four is the one that settled
it: the client sent a deck naming one photograph per section, and with it the
sentence the whole design turns on — *"ตัวหนังสือก็ทำกรอบ ใส่พื้นหลังเพื่อให้อ่านง่าย
รูป BG ใส่ไว้เฉยๆ ไม่ต้องเน้น ขอแค่ให้มี ให้เห็นก็พอ"*. The photograph is backdrop;
the copy carries its own ground.

The shipped pattern, `.sec-photo`/`.sec-photo-bg` in `styles.css`: an `<img>`
absolutely positioned to fill the section (never a CSS `background-image` —
the `{{img:}}` token ships a `srcset`, which a `background-image` cannot use),
under one shared veil, with every block of copy on `--read-panel`. One section,
one photo, one crop point — `--band-pos` — is the entire per-component API.

- **Where the contrast comes from is the whole design decision, and it
  inverts once every section has a photo.** Rounds one to three leaned on a
  heavy veil, which works only where copy *is* the section's entire content —
  a hero, a single column of prose. It cannot work for a page of card grids,
  an accordion and a form: veil it enough to read small type over any
  photograph the client sends next and the photograph is gone, which is the
  opposite of what they asked for. So the veil went to a flat, moderate
  `--band-veil` and readability moved to `--read-panel` behind each block.
  Contrast became a property of the system rather than of the photograph.
- **Components that already carry a solid card are deliberately left out of
  that list.** `.svc`, `.plan`, `.rev`, `.certs`, `.book-form` and the hero's
  credential card are frames already; panelling them again would be a card in
  a card, and the photograph showing *between* them is the point.
- **State the stacking fix once, on the wrapper every section already has.**
  `.sec-photo > .wrap { position: relative; }` — see the bullet below for why
  it is load-bearing. Filed per-component it was missed on two sections and
  cost a debugging round; filed here, a new photo band cannot reintroduce it.

- **The absolutely-positioned background can paint *over* the text despite
  coming first in the DOM, and the fix is `position: relative` on the text's
  wrapper — not a z-index.** CSS stacking is not simple DOM order: a
  `position: static` box paints in the "in-flow" layer, and *any* positioned
  descendant with `z-index: auto` — even one with no `z-index` set at all —
  paints in a later layer than every static box in the same context,
  regardless of which one is later in the markup. `.hero-grid` already had
  `position: relative` and was fine. `.gear-in` and `.std` did not, and every
  word of copy in both sections rendered — correctly, per the DOM and the
  computed styles — directly underneath its own opaque background image.
  Nothing in DevTools' computed-style panel flags this, because every value
  it shows is correct; only the *stacking rule* is unfamiliar. If a photo
  band ever ships with invisible copy again, check this before anything else.
- **Reveal-on-scroll can look like the same bug and isn't.** Screenshotting a
  section below the fold needs `.rv` elements' `IntersectionObserver` to have
  actually fired first — `element.scrollIntoView()` alone, if the page sets
  `scroll-behavior: smooth`, returns before the animated scroll finishes, so
  a `getBoundingClientRect()` read immediately after it is stale. Walk the
  whole page with `window.scrollTo({top, behavior:'instant'})` in steps first,
  *then* jump to the target section, to get a trustworthy screenshot.
- **Not the certification seals, not the logo.** A tint over a printed mark on
  white reads as a rendering fault, not a treatment.
- **A directional veil (dark under the copy, lighter toward the photo) stops
  making sense the moment a section collapses to one column on mobile** —
  there is no "lighter side" left to fade toward once the copy spans the full
  band. Only the hero still uses one, because the hero is the one band whose
  copy stands on the picture rather than on a panel; it overrides `--band-veil`
  on its own class, and flattens it again under the breakpoint where its grid
  collapses. Everywhere else the flat token is already correct at every width.
- **Client photographs are portrait phone shots being read through a wide
  letterbox, and a centred `cover` crop loses the subject in about half of
  them.** Of the eleven SPM sent, a default crop cut the company's own sign
  off its office building, left a fog-machine section showing only treeline,
  and reduced a torch-lit inspection to an empty wall. Open each one and pick
  `--band-pos` against what is actually in frame — the same "measure, don't
  guess" rule the fonts and the map labels each arrived at separately.

Keep the veil in **one token** (`--band-veil`, `--band-fade`) and the panels in
another (`--read-panel`), both shared by every section. Keep the crop points
**together in one table** rather than filed under each component: the client
iterates on them as a set, so a set is what they should be able to read at
once. Send a rendered comparison sheet rather than guessing — faster than a
second wrong answer, which is now four rounds of evidence rather than one.

## Text nobody can read, and why looking never finds it

`.sec-photo` sets a light body colour for the copy standing on its photograph.
A solid white card *inside* that section inherits it. So on spm-live the
services description and every sector bullet rendered white on white — and it
was delivered that way, because the cards were plainly present and plainly
correct and only their words were gone. A screenshot review reads straight
past that; the eye sees a card, not an absence.

`qa-site.mjs` now measures the contrast of every text-bearing element against
its composited ancestor background, and fails under **2.5:1**. Three decisions
in it are worth keeping:

- **The gate is "can this be read", not WCAG AA.** AA is 4.5:1 (3:1 for large
  text) and several of these sites sit just under it on captions and form
  hints. That is a real shortfall and a palette decision to take deliberately
  — not a build break. Below 2.5 nothing is a decision; it is text the cascade
  swallowed. The case that shipped measured 1.00.
- **When the ground cannot be known, say so and skip.** `backgroundColor` is
  blind to gradients, so walking past a gradient to whatever is further up
  invents a ground that is not there — the first version reported white-on-white
  for every button on a gradient across four sites. A check that cries wolf
  gets switched off, which is worse than never having written it. Same for a
  label parked at `left: -9999px`: the honeypot is *supposed* to be unreadable.
- **A brand's own pairing is not ours to correct.** White on LINE's green is
  2.26:1 and it stays — a LINE button nobody recognises is worse than one that
  is hard to squint at. Opt out with `data-contrast-exempt="<reason>"` on the
  element; the reason is in the markup where the next person will see it.

It was verified the only way worth trusting: the fix was taken back out, the
check reported 72 unreadable elements, and the fix restored. A check nobody has
watched fail is a check nobody knows works — this is the fourth time on this
project that building the instrument was the actual fix.

Two findings it turned up on sites nobody was looking at: `lanna-mekong-1200`'s
"สมัครเข้าร่วม" button is **1.16:1**, pale blue-grey on amber — its primary call
to action, effectively blank — and `demo-cleaning-biz`'s step numerals are
2.07:1, which may well be the intended watermark and is the owner's call.

## Route maps without Google Maps

`tools/route-map.mjs` turns a site's `route.json` into one inline SVG map —
real province outlines, a smoothed route line, numbered stops, pan, zoom,
pinch, and a stage picker that frames a leg and dims the rest. Boundaries come
from `tools/geo/th-provinces.json` (MIT, vendored, all 77 provinces), so any
Thai client can have one.

**A Google Maps embed was the obvious answer and it is the wrong one**, for
three reasons that all outrank "it would look familiar":
rule 4 says a deliverable makes zero external requests, so it works from the
zip and offline; an embed sets Google's cookies on the client's domain, which
drags a consent bar and a PDPA disclosure onto a 990 THB page; and the Embed
API wants a key, which is a secret with nowhere to live on a static site.

What we give up is real road geometry, and that has to be said out loud rather
than glossed: the line is a corridor drawn through the towns the organiser
named. The generated caption says so, and each stage links out to genuine
Google Maps directions (`/maps/dir/?api=1`, no key, ≤ 9 waypoints, one link per
stage) for anyone who wants turn-by-turn. When a client sends a GPX, replace
each stage's `points` and re-run — the line becomes the real thing and nothing
else changes.

Three things it learned the hard way, all of which will recur on the next map:

- **Two towns 20 km apart print their names on top of each other.** There is a
  placement pass that tries six positions per label; its vertical steps must
  clear a whole line box or a "lower" candidate lands on the label it was
  dodging. Every marker is seeded as an obstacle first, so a name is never
  printed across another town's dot.
- **A phone needs its own framing, not smaller type.** SVG units scale with
  width, so a 1000-unit viewBox at 390px renders 15px type at under 6px. The
  generator emits a second, portrait viewBox — computed from the route *and*
  the labels that will print — and the script swaps it under 700px. Minor
  labels drop out there; the stage chips carry those names.
- **A scale bar outside the panned group lies the moment anyone zooms.** It is
  recomputed on every transform from a `data-km-per-unit` the generator writes.

## Deployment

Cloudflare Pages, framework preset **None** (no build step runs on their side).
Direct Upload of `dist/`, or `npx wrangler pages deploy sites/<name>/dist
--project-name=<project>`. README.md has the Git-integration settings and the
free-tier limits.

## Fonts

**One face per script, never one family for both.** A family covering Thai and
Latin is usually only good at one of them — Thai has no serif tradition, so a
Thai serif comes out thin and awkward while its Latin looks fine. Fetch the
Latin families with subset `latin`, then `--append` the Thai families with
subset `thai` into the same `fonts.css`; each face keeps its own
`unicode-range`, so the browser picks per character from a stack that lists
Latin first: `'Noto Serif', 'Kanit', serif`.

Add `:lang(th)` adjustments where Latin defaults do not suit Thai — more
line-height (vowels and tone marks stack above and below), much less
letter-spacing (wide tracking pulls marks away from their consonants), and
watch any underline or bottom border for collisions with below-vowels (ุ ู).

Loopless geometric Thai faces (Prompt, Kanit, Bai Jamjuree) read as modern
business; looped ones (Sarabun) read as government paperwork. Match the
register the client is after — the operator has rejected a Thai serif and
Sarabun on sight, and picked from a rendered comparison sheet both times.
Build one before guessing again: it is faster than a second wrong answer.

In use: demo-cleaning is Mitr + Anuphan; demo-cleaning-biz is Noto Serif +
Kanit (display) and IBM Plex Sans + Anuphan (body); demo-cleaning-pro is
Archivo + Prompt (display) and Source Sans 3 + IBM Plex Sans Thai (body);
spm-pest and its two colour variants reuse demo-cleaning-biz's `fonts.css`
unchanged. All OFL.
