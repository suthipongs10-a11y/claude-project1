# CLAUDE.md — Web Lead Craft (client website production line)

Context file for work inside `web-lead-craft/`. The operator speaks Thai —
respond in Thai; keep code, comments and commits in English.

## What this is

A Thai freelance web-building business. Packages sold: 990 THB (one-page),
1,990 THB (one-page, 2 languages + LINE notify), 4,990 THB (multi-page + CMS).
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
7. Reveal-on-scroll must be gated behind a JS-added `.anim` class so content
   is never hidden when scripts don't run (this bug was already made and
   fixed once — see demo-cleaning).
8. **`node tools/qa-site.mjs sites/<name>` must print PASS before any site is
   shown to a client.** Every check in it corresponds to something that has
   already shipped broken here: invisible sections, sideways scroll, 20px-tall
   footer links, an over-long `<title>`. Do not hand over on a red run, and do
   not weaken a check to make it green — fix the site.

## Multi-language sites (Business package and up)

`site.json` lists the languages; `{{t|ไทย|English}}` in `head.html`/`body.html`
carries both phrases; `{{lang:en}}` resolves to that language's URL. The build
emits **one real page per language** (`dist/index.html`, `dist/en/index.html`)
with correct `lang`, `hreflang`, canonical and sitemap entries — not a
hidden-DOM toggle, which would give Google one URL for two languages and leave
`alt`/`placeholder` stuck in the wrong one. A token missing a phrase fails the
build rather than shipping an empty heading.

Sizing rule that this package makes load-bearing: **grid tracks holding
translated copy must be `minmax(0, Nfr)`, never bare `Nfr`.** A bare `fr` will
not shrink below its content's min-content width, so the longer language steals
width from its neighbour. `qa-site.mjs` compares container widths across
language pages and reports any that move with the copy.

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

In use: demo-cleaning is Mitr + Anuphan; demo-cleaning-biz is Noto Serif +
Kanit (display) and IBM Plex Sans + Anuphan (body). All OFL.
