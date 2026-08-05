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

## Deployment

Cloudflare Pages, framework preset **None** (no build step runs on their side).
Direct Upload of `dist/`, or `npx wrangler pages deploy sites/<name>/dist
--project-name=<project>`. README.md has the Git-integration settings and the
free-tier limits.

## Fonts

Default pairing: Mitr (display, 500/600) + Anuphan (body, 400–600), both OFL.
Change per client via the css2 URL passed to `fetch-fonts.mjs`.
