#!/usr/bin/env node
// Generate a colour variant of an existing site folder.
//
// A client who likes the layout but not the palette is a normal request, and
// hand-editing forty hex values across five files is how a theme ends up 95%
// swapped — which looks like a bug rather than a decision. So the swap is a
// declared map, applied to every file at once, and the result is checked two
// ways before it is written off as done:
//
//   1. no colour from the source palette may survive anywhere in the output
//   2. every contrast pair the theme declares must clear WCAG AA
//
// The source site must keep its colours in a small set of literals, which is
// what the token block at the top of its styles.css is for. Token names there
// say what a colour does (--brand, --highlight) rather than what it looks
// like, precisely so this tool can leave them alone.
//
// Usage: node tools/theme-variant.mjs [name ...]      (default: all themes)
import { cpSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FILES = ['site.json', 'src/styles.css', 'src/body.html', 'src/head.html', 'src/privacy.html', 'src/favicon.svg'];

/** WCAG relative luminance, so a palette is measured rather than admired. */
const lum = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
};

const BASE_PROSE = `     Green is the claim this industry has to make — controlled chemicals,
     handled safely — and the cream keeps it from reading as camouflage. The
     butterfly blue appears only on the mark and the equipment band, so it
     stays the logo's colour rather than becoming a third theme colour.`;

/** Prose and identity swaps. Applied before the colour map, because these
 *  keys quote the source palette's own words and hexes. */
const wording = (project, theme, prose, label) => ({
  'web-pest-demo.pages.dev': project,
  '   THEME: forest & cream': `   THEME: ${theme}`,
  [BASE_PROSE]: prose,
  'sites/spm-pest-navy and sites/spm-pest-amber were made that way.':
    'This site is one of those variants; sites/spm-pest is the original.',
  'เดโม่แพ็กเกจ Business 1,990.- สำหรับ Scientific Pest Management (Thailand)':
    `เดโม่แพ็กเกจ Business 1,990.- สำหรับ Scientific Pest Management (Thailand) — ธีมสี ${label}`,
});

export const THEMES = {
  // The most-used palette in business anywhere — and here not merely the safe
  // pick: the company's real mark is a blue butterfly, so this is the closest
  // of the three to the brand they already own.
  'spm-pest-navy': {
    from: 'sites/spm-pest',
    colours: {
      '#0F2A1A': '#0E1E38', '#55635A': '#566076', '#83907F': '#8A93A6',
      '#1D4429': '#17386B', '#14331D': '#0F2647', '#16351F': '#0F2647',
      '#0C2113': '#0A1A33', '#E7EFE6': '#E6EDF9', '#2F6B3B': '#2B5FA8',
      '#EAF2E6': '#E8EFFA', '#EFECA6': '#9FD0FF', '#F6F4CE': '#C7E4FF',
      '#F6F3BE': '#B8DEFF', '#FAF9E4': '#EEF6FF', '#F4F7F0': '#F3F6FB',
      '#F4F6F0': '#F3F6FB', '#DFE6DA': '#DDE3EE',
      '#3E8FCB': '#F5B843',  // butterfly body: amber, so the mark is not one flat blue
      '#1C5E96': '#8F5410',  // equipment band accent, kept off-theme on purpose
      'rgba(15, 42, 26': 'rgba(14, 30, 56',
      'rgba(12, 33, 19': 'rgba(10, 26, 51',
      'rgba(29, 68, 41': 'rgba(23, 56, 107',
      'rgba(239, 236, 166': 'rgba(159, 208, 255',
    },
    wording: wording('web-pest-navy.pages.dev', 'navy & azure',
`     Blue is the most-used colour in business anywhere, and here it is not
     merely the safe choice: the company's own mark is a blue butterfly, so
     this is the closest of the three themes to the brand they already own.
     The amber on the equipment band is the one warm note, kept off-theme so
     that band reads as a separate offer rather than more of the same page.`,
      'Navy & Azure'),
    check: [
      ['#17386B', '#FFFFFF', 'primary on white (links, buttons)', 4.5],
      ['#2B5FA8', '#FFFFFF', 'accent on white (labels, icons)', 4.5],
      ['#9FD0FF', '#0F2647', 'highlight on the dark panel', 4.5],
      ['#0A1A33', '#9FD0FF', 'dark text on the highlight button', 4.5],
      ['#566076', '#FFFFFF', 'body copy on white', 4.5],
      ['#8F5410', '#EEF6FF', 'equipment band accent on its ground', 4.5],
    ],
  },

  // Pest control for a hotel is a compliance business: the buyer is filing
  // your paperwork for an inspection. Graphite and amber is the visual
  // language of inspection and safety equipment.
  'spm-pest-amber': {
    from: 'sites/spm-pest',
    colours: {
      '#0F2A1A': '#1A1F23', '#55635A': '#5C646B', '#83907F': '#8E959B',
      '#1D4429': '#2E363D', '#14331D': '#1E252B', '#16351F': '#1E252B',
      '#0C2113': '#14191E', '#E7EFE6': '#EDEFF1', '#2F6B3B': '#8F5C0C',
      '#EAF2E6': '#FBF0DC', '#EFECA6': '#F2B544', '#F6F4CE': '#F7CE7E',
      '#F6F3BE': '#F7C463', '#FAF9E4': '#FDF6E8', '#F4F7F0': '#F5F6F7',
      '#F4F6F0': '#F5F6F7', '#DFE6DA': '#E1E4E7',
      '#3E8FCB': '#4FA3D9',  // butterfly body stays blue — a nod to the real mark
      // #1C5E96 is deliberately absent: the equipment band keeps its blue,
      // which is exactly what makes it carry against graphite and amber.
      'rgba(15, 42, 26': 'rgba(26, 31, 35',
      'rgba(12, 33, 19': 'rgba(20, 25, 30',
      'rgba(29, 68, 41': 'rgba(46, 54, 61',
      'rgba(239, 236, 166': 'rgba(242, 181, 68',
    },
    wording: wording('web-pest-amber.pages.dev', 'graphite & amber',
`     Pest control for a hotel is a compliance business: the buyer is filing
     your paperwork for an inspection. Graphite and amber is the visual
     language of inspection and safety equipment, it reads technical rather
     than horticultural, and the glue board in the light-trap illustration was
     already exactly this amber. The mark keeps its blue body as a nod to the
     real logo, and blue against amber is what makes the mark carry.`,
      'Graphite & Amber'),
    check: [
      ['#2E363D', '#FFFFFF', 'primary on white (links, buttons)', 4.5],
      ['#8F5C0C', '#FFFFFF', 'accent on white (labels, icons)', 4.5],
      ['#F2B544', '#1E252B', 'highlight on the dark panel', 4.5],
      ['#14191E', '#F2B544', 'dark text on the highlight button', 4.5],
      ['#5C646B', '#FFFFFF', 'body copy on white', 4.5],
      ['#1C5E96', '#FDF6E8', 'equipment band accent on its ground', 4.5],
    ],
  },
};

function generate(name, theme) {
  const dir = `sites/${name}`;
  if (!existsSync(theme.from)) throw new Error(`no source site at ${theme.from}`);
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  // dist/, .qa/ and preview.html are build output, not source
  cpSync(theme.from, dir, {
    recursive: true,
    filter: src => !src.includes('/dist') && !src.includes('/.qa') && !src.endsWith('preview.html'),
  });

  for (const f of FILES) {
    const p = join(dir, f);
    let text = readFileSync(p, 'utf8');
    for (const [from, to] of Object.entries(theme.wording)) text = text.replaceAll(from, to);
    for (const [from, to] of Object.entries(theme.colours)) text = text.replaceAll(from, to);
    writeFileSync(p, text);
  }

  const problems = [];
  for (const f of FILES) {
    const text = readFileSync(join(dir, f), 'utf8');
    for (const from of Object.keys(theme.colours)) {
      if (text.includes(from)) problems.push(`${f} still contains the source colour ${from}`);
    }
  }
  const rows = theme.check.map(([a, b, label, min]) => {
    const r = contrast(a, b);
    if (r < min) problems.push(`${label}: ${r.toFixed(2)}:1, want ${min}:1`);
    return `    ${r >= min ? 'ok  ' : 'FAIL'} ${r.toFixed(2)}:1  ${label}`;
  });
  return { rows, problems };
}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(THEMES);
let failed = false;
for (const name of wanted) {
  const theme = THEMES[name];
  if (!theme) {
    console.error(`unknown theme "${name}" — known: ${Object.keys(THEMES).join(', ')}`);
    process.exitCode = 1;
    continue;
  }
  const { rows, problems } = generate(name, theme);
  console.log(`sites/${name}/  from ${theme.from}`);
  console.log(rows.join('\n'));
  for (const p of problems) console.log(`    ! ${p}`);
  if (problems.length) failed = true;
  console.log(`    build: node tools/build-site.mjs sites/${name}`);
}
if (failed) process.exitCode = 1;
