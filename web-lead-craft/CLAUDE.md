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

## Veiling a photograph without veiling its caption

A client can ask for the pictures to sit back like a ground rather than stand
forward like exhibits — SPM asked for it twice, and the second time for every
photograph on the page. It is one `::after` over each picture, but the pin is
the whole job:

- **`inset: 0 0 auto 0` plus the picture's own `aspect-ratio`, never
  `inset: 0`.** A `<figure>` is taller than its image the moment it has a
  caption, and `inset: 0` draws the veil over the words too. This was got wrong
  once, spotted by eye, and got wrong again in the same file a day later.
- **Match the radius**, or the veil's square corners show outside the picture's
  rounded ones. Each component declares `--ph-ratio` and `--ph-radius`; the
  veil rule itself is written once.
- **Not the certification seals, not the logo.** A tint over a printed mark on
  white reads as a rendering fault, not a treatment.
- **Measure it, do not look at it.** `z-check`-style: for every figure, the
  `::after` box must equal the `<img>` box to the pixel and the radii must be
  equal strings. Ten pictures, four components, three viewports — the eye
  passes the one that is 33px too tall.

Strength is subjective and the operator will iterate, so keep it in **one
token** (`--photo-veil`, `--photo-fade`) and send a rendered comparison sheet
of two or three strengths rather than guessing. The same argument as the font
sheet above: it is faster than a second wrong answer.

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
