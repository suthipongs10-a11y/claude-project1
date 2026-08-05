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
