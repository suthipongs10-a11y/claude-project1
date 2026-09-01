#!/usr/bin/env node
// Generate an inline SVG route map from <site>/route.json and write it into
// src/body.html between the route-map markers. Re-runnable: run it again after
// editing route.json and the map is replaced in place.
//
//   node tools/route-map.mjs sites/<name>
//
// Why we draw our own map instead of embedding Google's:
//
//   1. Rule 4 of CLAUDE.md — a deliverable makes zero external requests, so it
//      works from the zip, offline, and in an artifact preview. A Maps iframe
//      is a third-party request on every page load.
//   2. An embed sets Google's cookies on the client's domain, which drags a
//      consent bar and a PDPA disclosure into a 990 THB page.
//   3. The Maps Embed API wants an API key. Keys are secrets (rule 2) and a
//      static site has nowhere to hide one.
//
// What we give up: Google's road geometry. This map draws a smoothed line
// through the towns the organiser named, which is a corridor overview, not a
// surveyed track. The caption says so, and every stage links out to real
// Google Maps directions for anyone who wants the roads.
//
// Province outlines are real: tools/geo/th-provinces.json, MIT, see its README.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node tools/route-map.mjs sites/<name>');
  process.exit(1);
}

const here = resolve(new URL('.', import.meta.url).pathname);
const route = JSON.parse(readFileSync(join(dir, 'route.json'), 'utf8'));
const geo = JSON.parse(readFileSync(join(here, 'geo', 'th-provinces.json'), 'utf8'));

// ---------------------------------------------------------------- projection

const W = 1000;
const H = 760;
const PAD = 26;

// Equirectangular with a cos(lat) correction. Over three degrees of latitude
// the error against a proper conic is well under the width of the route line,
// and it keeps the inverse trivial for the scale bar.
const all = [];
for (const s of route.stages) for (const p of s.points) all.push([p.lat, p.lon]);
const latMid = all.reduce((a, [la]) => a + la, 0) / all.length;
const kx = Math.cos((latMid * Math.PI) / 180);

const wanted = new Set([...route.provinces, ...(route.context ?? [])]);
const shapes = geo.features
  .filter(f => wanted.has(f.properties.name))
  .map(f => ({
    name: f.properties.name,
    onRoute: route.provinces.includes(f.properties.name),
    rings: f.geometry.type === 'Polygon'
      ? f.geometry.coordinates
      : f.geometry.coordinates.flat(),
  }));

const missing = [...wanted].filter(n => !shapes.some(s => s.name === n));
if (missing.length) {
  console.error(`route.json names provinces not in the GeoJSON: ${missing.join(', ')}`);
  process.exit(1);
}

// Fit to the route's own bounding box, padded, rather than to the provinces —
// the context provinces exist to give the route somewhere to sit, and letting
// them drive the frame would shrink the route to a squiggle in the middle.
const lats = all.map(([la]) => la);
const lons = all.map(([, lo]) => lo);
const m = 0.55; // degrees of breathing room around the route
const box = {
  w: Math.min(...lons) - m, e: Math.max(...lons) + m,
  s: Math.min(...lats) - m, n: Math.max(...lats) + m,
};
const scale = Math.min(
  (W - PAD * 2) / ((box.e - box.w) * kx),
  (H - PAD * 2) / (box.n - box.s),
);
const offX = (W - (box.e - box.w) * kx * scale) / 2;
const offY = (H - (box.n - box.s) * scale) / 2;

const X = lon => offX + (lon - box.w) * kx * scale;
const Y = lat => offY + (box.n - lat) * scale;
const r2 = n => Math.round(n * 10) / 10;
const pt = (lat, lon) => [r2(X(lon)), r2(Y(lat))];

// ------------------------------------------------------------------- shapes

function ringPath(ring) {
  // ring is [lon, lat] pairs, GeoJSON order
  let d = '';
  let prev = null;
  for (const [lon, lat] of ring) {
    const [x, y] = pt(lat, lon);
    // drop points that land on the same tenth of a unit as the last one
    if (prev && prev[0] === x && prev[1] === y) continue;
    d += `${d ? 'L' : 'M'}${x} ${y}`;
    prev = [x, y];
  }
  return d + 'Z';
}

/**
 * Catmull-Rom through the waypoints, emitted as cubic beziers.
 *
 * A polyline between district towns reads as a survey diagram; a road on a map
 * curves. This is cosmetic and it is the one place the map is deliberately not
 * literal, so the smoothing is kept tight (a sixth of each span) — enough to
 * lose the hard corners, not enough to bow the line off the corridor.
 */
function smooth(points) {
  const p = points.map(({ lat, lon }) => pt(lat, lon));
  if (p.length < 3) return p.map(([x, y], i) => (i ? `L${x} ${y}` : `M${x} ${y}`)).join('');
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] ?? p2;
    const c1 = [r2(p1[0] + (p2[0] - p0[0]) / 6), r2(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [r2(p2[0] - (p3[0] - p1[0]) / 6), r2(p2[1] - (p3[1] - p1[1]) / 6)];
    d += `C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// --------------------------------------------------------------- deep links

// Google Maps' URL API takes an origin, a destination and at most nine
// waypoints, which is why this links one stage at a time rather than the whole
// loop. It also suits the rider better: a stage is a day.
function gmapsUrl(points) {
  const q = ([...points].map(p => `${p.lat},${p.lon}`));
  const origin = q.shift();
  const destination = q.pop();
  const via = q.filter((_, i, a) => a.length <= 9 || i % Math.ceil(a.length / 9) === 0).slice(0, 9);
  const u = new URL('https://www.google.com/maps/dir/');
  u.searchParams.set('api', '1');
  u.searchParams.set('origin', origin);
  u.searchParams.set('destination', destination);
  if (via.length) u.searchParams.set('waypoints', via.join('|'));
  u.searchParams.set('travelmode', 'bicycling');
  return u.toString();
}

// -------------------------------------------------------------- scale bar

// Pick a round number of kilometres that lands near 130 px at zoom 1.
const kmPerUnit = 111.32 / scale; // one SVG unit north-south, in km
const targetKm = 130 * kmPerUnit;
const barKm = [25, 50, 100, 150, 200, 250, 500].reduce(
  (best, k) => (Math.abs(k - targetKm) < Math.abs(best - targetKm) ? k : best), 50);
const barUnits = r2(barKm / kmPerUnit);

// ----------------------------------------------------------------- markers

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const stops = [];
for (const s of route.stages) {
  for (const p of s.points) {
    if (!p.stop) continue;
    if (p.name === route.start.name) continue; // the pin already labels it
    if (stops.some(q => q.name === p.name)) continue;
    stops.push({ ...p, stage: s.no });  // `key` rides along: it drives the phone label set
  }
}
const startAt = pt(route.start.lat, route.start.lon);

// ---------------------------------------------------------------- assemble

const provinceLayer = shapes
  .sort((a, b) => Number(a.onRoute) - Number(b.onRoute))
  .map(s => `<path class="pv${s.onRoute ? ' pv-on' : ''}" d="${s.rings.map(ringPath).join('')}"/>`)
  .join('');

const riverLayer = route.river
  ? `<path class="mekong" d="${smooth(route.river.points.map(([lat, lon]) => ({ lat, lon })))}"/>`
  : '';

const stageLayer = route.stages.map(s =>
  `<path class="rt-case" data-stage="${s.no}" d="${smooth(s.points)}"/>`).join('')
  + route.stages.map(s =>
  `<path class="rt-line" data-stage="${s.no}" d="${smooth(s.points)}"/>`).join('');

// Label decluttering. Two towns 20 km apart print their names on top of each
// other at this scale — Phitsanulok and Wang Thong did exactly that. Try the
// four placements a cartographer would try, in order of preference, and take
// the first that hits nothing already placed.
const CH = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/; // Thai marks stack, they take no width
const labelWidth = (s, size) => [...s].filter(c => !CH.test(c)).length * size * 0.62;

// The vertical steps have to clear a whole line box (18 units) or a "lower"
// candidate still lands on the label it was trying to avoid — which is how
// Phitsanulok and Wang Thong exhausted all five of the first attempt's
// placements and fell back to the default, on top of each other.
const PLACES = [
  { dx: 9, dy: 4, anchor: 'start' },
  { dx: -9, dy: 4, anchor: 'end' },
  { dx: 9, dy: -22, anchor: 'start' },
  { dx: -9, dy: -22, anchor: 'end' },
  { dx: 9, dy: 28, anchor: 'start' },
  { dx: -9, dy: 28, anchor: 'end' },
];
const hits = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Seed the obstacle list with every marker, so a label can never be printed
// across another town's dot. It also makes the placement order stop mattering:
// whoever goes first still has to dodge the neighbour that has not been
// placed yet.
const keyBoxes = [];   // where the labels a phone still prints ended up
const placed = stops.map(s => {
  const [x, y] = pt(s.lat, s.lon);
  return { x: x - 7, y: y - 7, w: 14, h: 14 };
});

const stopLayer = stops.map(p => {
  const [x, y] = pt(p.lat, p.lon);
  const size = 15;
  const w = labelWidth(p.name, size);
  let spot = PLACES[0];
  for (const c of PLACES) {
    const box = {
      x: x + (c.anchor === 'end' ? c.dx - w : c.dx),
      y: y + c.dy - size,
      w, h: size + 3,
    };
    if (!placed.some(q => hits(box, q))) { spot = c; placed.push(box); break; }
    if (c === PLACES[PLACES.length - 1]) placed.push(box); // give up, keep the default
  }
  if (p.key) keyBoxes.push({
    x: x + (spot.anchor === 'end' ? spot.dx - w : spot.dx),
    y: y + spot.dy - size, w, h: size + 3,
  });
  return `<g class="mk${p.key ? ' mk-key' : ''}" data-stage="${p.stage}" transform="translate(${x} ${y})">`
    + `<circle class="mk-dot" r="5.5"/>`
    + `<text class="mk-tx" x="${spot.dx}" y="${spot.dy}"`
    + `${spot.anchor === 'end' ? ' text-anchor="end"' : ''}>${esc(p.name)}</text>`
    + `</g>`;
}).join('');

const startLayer =
  `<g class="mk-start" transform="translate(${startAt[0]} ${startAt[1]})">`
  + `<path class="pin-sh" d="M0 0c0 0 11-13.5 11-21a11 11 0 1 0-22 0c0 7.5 11 21 11 21z"/>`
  + `<circle class="pin-in" cy="-21" r="4.4"/>`
  + `<text class="mk-tx mk-tx-start" x="15" y="-18">${esc(route.start.name)}</text>`
  + `</g>`;

// Portrait framing: same projection, a window cropped to phone proportions
// around the route itself. The script swaps the viewBox below 700px.
const rp = all.map(([la, lo]) => pt(la, lo));
const spans = rp.map(q => ({ x: q[0], y: q[1], w: 0, h: 0 }))
  .concat(keyBoxes)
  .concat([{ x: startAt[0], y: startAt[1] - 30, w: 120, h: 30 }]); // the pin and its name
const rb = {
  x0: Math.min(...spans.map(q => q.x)), x1: Math.max(...spans.map(q => q.x + q.w)),
  y0: Math.min(...spans.map(q => q.y)), y1: Math.max(...spans.map(q => q.y + q.h)),
};
const TALL_ASPECT = 0.70;
const tallH = Math.max((rb.y1 - rb.y0) + 60, ((rb.x1 - rb.x0) + 30) / TALL_ASPECT);
const tallW = tallH * TALL_ASPECT;
const tallBox = [
  r2((rb.x0 + rb.x1) / 2 - tallW / 2),
  r2((rb.y0 + rb.y1) / 2 - tallH / 2),
  r2(tallW), r2(tallH),
].join(' ');

const svg = `<svg class="map-svg" viewBox="0 0 ${W} ${H}"
        data-vb-wide="0 0 ${W} ${H}" data-vb-tall="${tallBox}" role="img"
        aria-label="แผนที่เส้นทางปั่น 1,200 กิโลเมตร เริ่มและจบที่ข่วงเมืองปัว จังหวัดน่าน วนผ่านแพร่ อุตรดิตถ์ พิษณุโลก เพชรบูรณ์ และเลย ก่อนเลียบแม่น้ำโขงแล้ววนกลับ">
        <g class="map-pan">
          <g class="lyr-land">${provinceLayer}</g>
          <g class="lyr-water">${riverLayer}</g>
          <g class="lyr-route">${stageLayer}</g>
          <g class="lyr-stops">${stopLayer}${startLayer}</g>
        </g>
        <g class="map-scale" transform="translate(24 ${H - 26})">
          <path d="M0 -7V0h${barUnits}v-7" />
          <text x="${r2(barUnits / 2)}" y="-12">${barKm} กม.</text>
        </g>
      </svg>`;

const chips = route.stages.map(s =>
  `<div class="mc" data-stage="${s.no}">`
  + `<button type="button" class="mc-pick" aria-pressed="false">`
  + `<span class="mc-no">${s.no}</span>`
  + `<span class="mc-tx"><b>${esc(s.title)}</b><span>${esc(s.note)}</span></span>`
  + `</button>`
  + `<a class="mc-go" href="${esc(gmapsUrl(s.points))}" target="_blank" rel="noopener noreferrer">`
  + `เปิดเส้นทางช่วงที่ ${s.no} ใน Google Maps ↗</a>`
  + `</div>`).join('\n        ');

const block = `<!-- route-map:start — generated by tools/route-map.mjs from route.json, do not edit by hand -->
    <div class="mapwrap rv">
      <div class="map" data-map data-km-per-unit="${kmPerUnit.toFixed(5)}">
        ${svg}
        <div class="map-ui">
          <button type="button" class="map-btn" data-zoom="in" aria-label="ขยายแผนที่">+</button>
          <button type="button" class="map-btn" data-zoom="out" aria-label="ย่อแผนที่">−</button>
          <button type="button" class="map-btn map-btn-w" data-zoom="reset">ทั้งเส้นทาง</button>
        </div>
        <p class="map-hint">ลากเพื่อเลื่อน · เลื่อนล้อหรือใช้สองนิ้วเพื่อซูม</p>
      </div>
      <div class="map-legend">
        ${chips}
      </div>
      <p class="map-note">แผนที่นี้เป็นภาพรวมเส้นทางตามลำดับอำเภอที่ผู้จัดระบุ เส้นที่ลากยังไม่ใช่แนวถนนที่วัดจริง ระยะทางและแนวถนนของแต่ละช่วงจะยืนยันอีกครั้งพร้อมไฟล์ GPX · เส้นขอบจังหวัดจาก thailand.json (MIT)</p>
    </div>
    <!-- route-map:end -->`;

const bodyPath = join(dir, 'src', 'body.html');
if (!existsSync(bodyPath)) {
  console.error(`no ${bodyPath}`);
  process.exit(1);
}
const body = readFileSync(bodyPath, 'utf8');
const re = /<!-- route-map:start[\s\S]*?<!-- route-map:end -->/;
if (!re.test(body)) {
  console.error('body.html has no <!-- route-map:start --> … <!-- route-map:end --> block to replace');
  process.exit(1);
}
writeFileSync(bodyPath, body.replace(re, block), 'utf8');

const kb = n => `${Math.round(n / 1024)} KB`;
console.log(`route map → ${bodyPath}`);
console.log(`  ${shapes.length} provinces (${route.provinces.length} on route), `
  + `${route.stages.length} stages, ${stops.length} stops, ${kb(block.length)} of markup`);
console.log(`  scale bar ${barKm} km = ${barUnits} units`);
