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
3. One folder per site under `sites/<name>/` with the same `src/` contract:
   `head.html` (meta only), `styles.css`, `body.html` (markup + script),
   `fonts.css` (generated). Build with `node tools/build-site.mjs sites/<name>`.
4. Deliverables are **self-contained**: fonts embedded as data URIs
   (`tools/fetch-fonts.mjs`, thai+latin subsets only), icons as an inline SVG
   sprite, zero external requests. This is what makes the same page work both
   deployed and as a claude.ai artifact preview (artifact CSP blocks CDNs),
   and what makes PageSpeed trivially green.
5. Demo sites: fictional brand + fictional contact details, a footer
   disclaimer saying so, and the Web Lead Craft credit strip
   (LINE: kitty4uu · 099-151-4049). A demo doubles as an ad.
6. "LINE แจ้งเตือน" features must use the LINE Messaging API with a LINE
   Official Account. LINE Notify was discontinued March 2025 — never quote it.
7. Reveal-on-scroll must be gated behind a JS-added `.anim` class so content
   is never hidden when scripts don't run (this bug was already made and
   fixed once — see demo-cleaning).

## Fonts

Default pairing: Mitr (display, 500/600) + Anuphan (body, 400–600), both OFL.
Change per client via the css2 URL passed to `fetch-fonts.mjs`.
