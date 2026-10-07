// EPISODE: BEEP in GERMANY — The Bottle Bank. One long street (x 0..4400), ground G=860, camera pans along it.
(function () {
  const { S, K, step, sq, clamp, lerp, E, at, show } = MS, G = 860, PL = MS.PL, OL = MS.OL(6), OL4 = MS.OL(4);
  const R = (a, b, t) => clamp((t - a) / (b - a));
  const TR = (x, y, r = 0, s = 1) => `translate(${x},${y}) rotate(${r}) scale(${s})`;
  let beep, mochi, klara, jonas, lena, opa, hat;
  let bottle, can, mug, glass, saucer, coin, receipt, scr, bin, car1, car2, ampR, ampG, ampR2, ampG2, drops, bunting;
  const V = MS.VERTICAL;

  // ---------------- timelines ----------------
  const beepX = t => K([[3.2, 620], [10.8, 620], [14.0, 900, 'io'], [17.2, 940, 'io'], [27.4, 940], [29.4, 1255, 'io'], [31.0, 1255], [31.5, 1185, 'out'], [34.5, 1185], [35.2, 1255, 'io'], [43.6, 1255], [46.0, 1290], [58.5, 2500, 'io'], [61.8, 2900, 'io'], [72.5, 2900], [74, 2790, 'io'], [78.5, 2790], [79.6, 2900, 'io'], [91.8, 2900], [96.2, 3400, 'io'], [97.4, 3400], [98.5, 3700, 'in'], [99.2, 3400, 'out'], [106.5, 3400], [111.0, 4220, 'io']], t);
  const beepY = t => G - 180 + Math.sin(t * 3.2) * 7 + K([[3.2, -900], [4.1, 0, 'in'], [4.4, 0]], t) + K([[62, 0], [63, -30, 'io'], [92, -30], [93, 0]], t) + K([[73.5, 0], [75, -70, 'io'], [78, -70], [79.4, 0, 'io']], t);
  const mochiX = t => K([[3.4, 60], [4.6, 520, 'out'], [11, 520], [14.5, 830, 'io'], [19, 850], [28.4, 980, 'io'], [34.0, 990], [36.4, 1470, 'io'], [38.0, 1500], [46.0, 1500], [58, 2440, 'io'], [60.6, 2800, 'io'], [61.5, 2840], [91.6, 2840], [96.2, 3300, 'io'], [106.8, 3310], [111, 4120, 'io']], t);
  const mochiY = t => K([[60, G], [60.9, G], [61.5, 640, 'out'], [62.0, 705, 'in'], [91.6, 705], [92.0, 640, 'out'], [92.6, G, 'in']], t) + K([[36.3, 0], [36.9, -170, 'out'], [37.5, 0, 'in'], [38, 0]], t);
  const klX = t => K([[0, 1580], [20.3, 1580], [23.0, 1150, 'io'], [46, 1150], [49, 1150]], t);

  // ---------------- helpers ----------------
  function house(p, x, w, h, wall, roof, shutter) {
    const g = S('g', {}, p), top = G - h;
    S('rect', { x, y: top, width: w, height: h + 40, fill: wall, ...OL }, g);
    for (let i = 1; i < 3; i++) S('line', { x1: x, y1: top + i * h / 3, x2: x + w, y2: top + i * h / 3, stroke: '#7A4A2A', 'stroke-width': 9 }, g);
    for (let i = 1; i < 4; i++) S('line', { x1: x + i * w / 4, y1: top, x2: x + i * w / 4, y2: G, stroke: '#7A4A2A', 'stroke-width': 9 }, g);
    S('path', { d: `M${x - 24},${top + 8} L${x + w / 2},${top - 150} L${x + w + 24},${top + 8} Z`, fill: roof, ...OL }, g);
    [0, 1].forEach(r => [0, 1].forEach(c => { const wx = x + w * (.18 + c * .5), wy = top + 28 + r * (h / 2.6); S('rect', { x: wx, y: wy, width: w * .24, height: h * .22, fill: '#FFF2B8', ...OL4 }, g); S('rect', { x: wx - 14, y: wy, width: 14, height: h * .22, fill: shutter, ...OL4 }, g); S('rect', { x: wx + w * .24, y: wy, width: 14, height: h * .22, fill: shutter, ...OL4 }, g); }));
    S('rect', { x: x + w * .42, y: G - 100, width: w * .16, height: 100, rx: 6, fill: '#8C5A2B', ...OL4 }, g);
    return g;
  }
  function tree(p, x, s, trunk = '#7A4A2A', leaf = '#6CC36A') { const g = S('g', {}, p); S('rect', { x: x - 26 * s, y: G - 300 * s, width: 52 * s, height: 300 * s + 20, rx: 10, fill: trunk, ...OL }, g); [[0, -330, 150], [-110, -270, 110], [110, -270, 110], [-50, -420, 100], [60, -400, 100]].forEach(([dx, dy, r]) => S('circle', { cx: x + dx * s, cy: G + dy * s, r: r * s, fill: leaf, ...OL }, g)); return g; }
  function bottleProp(parent) {
    const g = S('g', {}, parent);
    S('rect', { x: -15, y: -40, width: 30, height: 80, rx: 10, fill: '#DFF4FF', ...OL4 }, g);
    const w = S('rect', { x: -11, y: -4, width: 22, height: 40, rx: 7, fill: '#4DB6FF' }, g);
    S('rect', { x: -7, y: -58, width: 14, height: 20, rx: 3, fill: '#DFF4FF', ...OL4 }, g); S('rect', { x: -9, y: -66, width: 18, height: 10, rx: 3, fill: '#2EC4B6', ...OL4 }, g);
    S('rect', { x: -15, y: -12, width: 30, height: 16, fill: '#FFFDF7', stroke: PL, 'stroke-width': 2 }, g);
    return { g, water: w };
  }
  function mugProp(parent, juice) {
    const g = S('g', {}, parent), liq = juice ? '#FFD65A' : '#F5B83D';
    S('path', { d: 'M24,-26 q34,6 24,36 q-4,14 -24,12', fill: 'none', ...MS.OL(9) }, g); S('path', { d: 'M24,-26 q34,6 24,36 q-4,14 -24,12', fill: 'none', stroke: '#fff', 'stroke-width': 3 }, g);
    S('rect', { x: -28, y: -38, width: 56, height: 76, rx: 10, fill: liq, ...OL4 }, g);
    const foam = S('g', {}, g); [-18, 0, 18].forEach(x => S('circle', { cx: x, cy: -40, r: 15, fill: '#fff', ...MS.OL(3) }, foam));
    return { g, foam };
  }
  function tirolHat(parent) {
    const g = S('g', {}, parent);
    S('ellipse', { cx: 0, cy: 0, rx: 92, ry: 16, fill: '#3E7D4A', ...OL }, g);
    S('path', { d: 'M-52,-4 Q-46,-62 0,-60 Q46,-62 52,-4 Z', fill: '#4E9A5B', ...OL }, g);
    S('rect', { x: -52, y: -22, width: 104, height: 14, fill: '#8C5A2B', stroke: PL, 'stroke-width': 3 }, g);
    S('path', { d: 'M30,-34 Q62,-110 92,-96 Q70,-70 40,-30 Z', fill: '#FF6B8B', ...OL4 }, g);
    return g;
  }
  function ampel(parent, x) {
    const g = S('g', { transform: `translate(${x},0)` }, parent);
    S('rect', { x: -8, y: 470, width: 16, height: 400, fill: '#8A8FA0', ...OL4 }, g);
    S('rect', { x: -40, y: 390, width: 80, height: 130, rx: 16, fill: '#2B2B35', ...OL }, g);
    const red = S('g', {}, g), grn = S('g', {}, g);
    // red: standing Ampelmann (arms out)
    S('circle', { cx: 0, cy: 424, r: 12, fill: '#FF3B3B' }, red); S('ellipse', { cx: 0, cy: 413, rx: 20, ry: 5, fill: '#FF3B3B' }, red); S('path', { d: 'M-8,411 Q0,396 8,411 Z', fill: '#FF3B3B' }, red);
    S('rect', { x: -10, y: 440, width: 20, height: 44, rx: 6, fill: '#FF3B3B' }, red); S('rect', { x: -32, y: 442, width: 64, height: 9, rx: 4, fill: '#FF3B3B' }, red); S('rect', { x: -9, y: 480, width: 8, height: 30, fill: '#FF3B3B' }, red); S('rect', { x: 1, y: 480, width: 8, height: 30, fill: '#FF3B3B' }, red);
    // green: walking Ampelmann
    S('circle', { cx: 0, cy: 424, r: 12, fill: '#4CFF7A' }, grn); S('ellipse', { cx: 0, cy: 413, rx: 20, ry: 5, fill: '#4CFF7A' }, grn); S('path', { d: 'M-8,411 Q0,396 8,411 Z', fill: '#4CFF7A' }, grn);
    S('rect', { x: -10, y: 440, width: 20, height: 44, rx: 6, fill: '#4CFF7A' }, grn);
    const arms = S('path', { fill: 'none', stroke: '#4CFF7A', 'stroke-width': 8, 'stroke-linecap': 'round' }, grn), legs = S('path', { fill: 'none', stroke: '#4CFF7A', 'stroke-width': 9, 'stroke-linecap': 'round' }, grn);
    return { red, grn, arms, legs };
  }
  function carProp(parent, col) {
    const g = S('g', {}, parent);
    S('rect', { x: -110, y: -130, width: 220, height: 110, rx: 34, fill: col, ...OL }, g);
    S('path', { d: 'M-80,-124 Q0,-176 80,-124 Z', fill: '#BFE6F5', ...OL }, g);
    S('rect', { x: -96, y: -64, width: 192, height: 24, rx: 10, fill: '#2B2340' }, g);
    S('circle', { cx: -72, cy: -56, r: 18, fill: '#FFF2B8', ...OL4 }, g); S('circle', { cx: 72, cy: -56, r: 18, fill: '#FFF2B8', ...OL4 }, g);
    S('rect', { x: -100, y: -26, width: 36, height: 42, rx: 8, fill: '#2B2340' }, g); S('rect', { x: 64, y: -26, width: 36, height: 42, rx: 8, fill: '#2B2340' }, g);
    return g;
  }

  window.EP = {
    build(L) {
      // ---- sky + far hills + castle ----
      S('rect', { x: -1500, y: -1600, width: 8000, height: 2400, fill: '#BFE6F5' }, L.sky);
      S('rect', { x: -1500, y: -1600, width: 8000, height: 1000, fill: '#9FD3F2', opacity: .6 }, L.sky);
      S('circle', { cx: 700, cy: 120, r: 70, fill: '#FFE38A' }, L.sky);
      [[300, 140, 1], [1500, 60, 1.3], [2700, 180, 1], [3700, 90, 1.2]].forEach(([x, y, s]) => { const c = S('g', { transform: `translate(${x},${y}) scale(${s})` }, L.sky); [[0, 0, 50], [50, -18, 62], [112, 0, 48]].forEach(([dx, dy, r]) => S('circle', { cx: dx, cy: dy, r, fill: '#fff', opacity: .9 }, c)); });
      S('path', { d: 'M-200,720 L200,430 L520,640 L900,380 L1400,700 L1800,470 L2300,700 L2800,420 L3300,690 L3800,460 L4600,720 Z', fill: '#8EB8E8', ...OL }, L.sky);
      S('path', { d: 'M-200,760 Q400,560 900,700 Q1500,520 2100,720 Q2800,540 3400,720 Q4000,560 4600,760 Z', fill: '#8FD18A', ...OL }, L.sky);
      // fairytale castle on the hill (distant)
      const cs = S('g', { transform: 'translate(1880,0)' }, L.sky); S('rect', { x: -60, y: 500, width: 120, height: 190, fill: '#F4EEE6', ...OL4 }, cs); S('path', { d: 'M-70,500 L0,400 L70,500 Z', fill: '#4DA3E0', ...OL4 }, cs); S('rect', { x: 70, y: 540, width: 50, height: 150, fill: '#F4EEE6', ...OL4 }, cs); S('path', { d: 'M62,540 L95,470 L128,540 Z', fill: '#4DA3E0', ...OL4 }, cs);
      // ---- ground ----
      S('rect', { x: -1500, y: 700, width: 8000, height: 1500, fill: '#E9D9C0' }, L.set);
      for (let x = -1500; x < 6500; x += 160) S('rect', { x, y: 760 + (x / 160 % 2) * 10, width: 150, height: 60, rx: 10, fill: '#DDCAAD' }, L.set);
      S('rect', { x: -1500, y: 690, width: 8000, height: 20, fill: '#B9A48A' }, L.set);
      // ---- houses (arrival) ----
      house(L.set, 140, 250, 330, '#FFF1D6', '#C1443D', '#3E8E7E'); house(L.set, 430, 280, 420, '#FFE2E8', '#8A4B3C', '#5A7BD1'); house(L.set, 750, 240, 360, '#E8F3D6', '#C1443D', '#E39B3C');
      tree(L.set, 70, .8);
      // ---- supermarket ----
      const sm = S('g', {}, L.set);
      S('rect', { x: 1130, y: 460, width: 560, height: 420, fill: '#FFF1B8', ...OL }, sm);
      S('rect', { x: 1110, y: 460, width: 600, height: 80, rx: 8, fill: '#E63946', ...OL }, sm); MS.T(sm, 1410, 520, 'MARKT', 60, '#FFFDF7', { stroke: PL, 'stroke-width': 8, style: 'font-family:FR,sans-serif;font-weight:700' });
      S('rect', { x: 1500, y: 570, width: 150, height: 290, fill: '#7FD0E8', ...OL }, sm); S('line', { x1: 1575, y1: 570, x2: 1575, y2: 860, stroke: PL, 'stroke-width': 5 }, sm);
      S('rect', { x: 1150, y: 580, width: 150, height: 130, rx: 10, fill: '#A8E1F0', ...OL }, sm);
      S('rect', { x: 1320, y: 480, width: 170, height: 36, rx: 8, fill: '#FFFDF7', ...OL4 }, sm); MS.T(sm, 1405, 508, 'PFAND', 28, '#2EC4B6', { style: 'font-family:FR,sans-serif;font-weight:700' });
      // Pfandautomat
      const pm = S('g', {}, L.set);
      S('rect', { x: 1340, y: 530, width: 140, height: 330, rx: 18, fill: '#2EC4B6', ...OL }, pm); S('rect', { x: 1356, y: 550, width: 108, height: 56, rx: 10, fill: '#1E2A3A', ...OL4 }, pm);
      scr = { idle: MS.T(pm, 1410, 590, 'PFAND', 30, '#7FF6FF', { style: 'font-family:FR,sans-serif;font-weight:700' }), x: S('path', { d: 'M1390,560 L1430,598 M1430,560 L1390,598', stroke: '#FF5A5A', 'stroke-width': 10, 'stroke-linecap': 'round' }, pm), ok: S('path', { d: 'M1388,580 L1405,598 L1434,558', stroke: '#9BFF6A', 'stroke-width': 10, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, pm) };
      S('circle', { cx: 1410, cy: 670, r: 34, fill: '#12303A', ...OL }, pm); S('rect', { x: 1376, y: 730, width: 68, height: 14, rx: 6, fill: '#12303A', ...OL4 }, pm);
      receipt = S('g', {}, pm); S('rect', { x: 1384, y: 736, width: 52, height: 86, fill: '#fff', stroke: PL, 'stroke-width': 3 }, receipt); [750, 764, 778, 792].forEach(y => S('line', { x1: 1392, y1: y, x2: 1428, y2: y, stroke: '#9AA', 'stroke-width': 4 }, receipt));
      // trash bin
      bin = S('g', {}, L.set); S('rect', { x: 1010, y: 740, width: 80, height: 120, rx: 10, fill: '#3E9B5A', ...OL }, bin); S('rect', { x: 1000, y: 724, width: 100, height: 24, rx: 8, fill: '#2E7D46', ...OL }, bin); MS.T(bin, 1050, 810, '♻', 40, '#fff', {});
      // ---- beer garden ----
      tree(L.set, 2330, 1.1, '#7A4A2A', '#5DB561');
      const bg = S('g', {}, L.set);
      S('rect', { x: 2170, y: 520, width: 150, height: 56, rx: 10, fill: '#8C5A2B', ...OL }, bg); MS.T(bg, 2245, 558, 'BIERGARTEN', 22, '#FFF2B8', { style: 'font-family:FR,sans-serif;font-weight:700' });
      S('rect', { x: 2560, y: 700, width: 150, height: 16, rx: 6, fill: '#8C5A2B', ...OL4 }, bg); // (bench seat left)
      S('rect', { x: 2590, y: 716, width: 14, height: 144, fill: '#6B4423', ...OL4 }, bg); S('rect', { x: 2670, y: 716, width: 14, height: 144, fill: '#6B4423', ...OL4 }, bg);
      // bench seat actually at y=810 (re-draw): seat for Jonas
      S('rect', { x: 2590, y: 806, width: 130, height: 16, rx: 6, fill: '#B07A3E', ...OL4 }, bg); S('rect', { x: 2610, y: 822, width: 12, height: 38, fill: '#6B4423', ...OL4 }, bg); S('rect', { x: 2690, y: 822, width: 12, height: 38, fill: '#6B4423', ...OL4 }, bg);
      S('rect', { x: 2720, y: 704, width: 190, height: 18, rx: 6, fill: '#D9A25F', ...OL }, bg); S('rect', { x: 2736, y: 722, width: 14, height: 138, fill: '#6B4423', ...OL4 }, bg); S('rect', { x: 2880, y: 722, width: 14, height: 138, fill: '#6B4423', ...OL4 }, bg);
      S('path', { d: 'M2720,704 L2910,704', stroke: '#fff', 'stroke-width': 5, opacity: .5 }, bg);
      // pretzel on table
      S('path', { d: 'M2850,700 q-14,-26 0,-26 q14,0 0,26 q-14,26 -28,0 q0,-22 14,-4', fill: 'none', stroke: '#B5722E', 'stroke-width': 9, 'stroke-linecap': 'round' }, bg);
      // ---- crosswalk area ----
      house(L.set, 3340, 250, 380, '#FFE2E8', '#8A4B3C', '#5A7BD1'); tree(L.set, 3290, .8);
      S('rect', { x: 3720, y: 700, width: 380, height: 700, fill: '#4B4F5C' }, L.set); S('rect', { x: 3720, y: 700, width: 380, height: 8, fill: '#2B2340' }, L.set);
      for (let i = 0; i < 6; i++) S('path', { d: `M${3750 + i * 60},722 L${3780 + i * 60},722 L${3790 + i * 64},1300 L${3750 + i * 64},1300 Z`, fill: '#fff', opacity: .92 }, L.set);
      [[3560, '#FFE2E8'], [3620, '#E8F3D6']].forEach(() => 0);
      const a1 = ampel(L.set, 3690), a2 = ampel(L.set, 4130); ampR = [a1.red, a2.red]; ampG = [a1.grn, a2.grn]; ampR2 = [a1.arms, a2.arms]; ampG2 = [a1.legs, a2.legs];
      house(L.set, 4200, 250, 340, '#E8F3D6', '#C1443D', '#E39B3C');
      // ---- characters ----
      klara = MS.makePerson(L.mid, { skin: '#F6CFAE', hair: 'bun', hairColor: '#BFBFBF', top: '#2E8B57', bottom: '#3D405B', acc: { apron: true } }, L.back);
      jonas = MS.makePerson(L.mid, { skin: '#F2C29B', hair: 'short', hairColor: '#8A5A2B', top: '#C0392B', bottom: '#3D5A80', acc: { beard: true } }, L.back);
      opa = MS.makePerson(L.mid, { skin: '#F2C29B', hair: 'bald', hairColor: '#C9C9C9', top: '#8C6B4A', bottom: '#3D405B', acc: { mustache: true, glasses: true, hat: 'cap', hatColor: '#6B8E4E' } }, L.back);
      lena = MS.makePerson(L.mid, { skin: '#F6CFAE', hair: 'pony', hairColor: '#C98A4B', top: '#FFC145', bottom: '#5A7BD1', scale: .72 }, L.back);
      mochi = MS.makeCat(L.mid, L.back);
      beep = MS.makeBeep(L.mid, L.back);
      hat = tirolHat(L.mid);
      // props
      saucer = S('g', {}, L.mid); S('ellipse', { cx: 0, cy: 0, rx: 34, ry: 8, fill: '#FFFDF7', ...OL4 }, saucer); S('ellipse', { cx: 0, cy: -2, rx: 24, ry: 4, fill: '#fff' }, saucer);
      const b = bottleProp(L.mid); bottle = b;
      can = S('g', {}, L.mid); S('rect', { x: -15, y: -22, width: 30, height: 44, rx: 6, fill: '#C9D1D9', ...OL4 }, can); S('rect', { x: -15, y: -8, width: 30, height: 14, fill: '#E63946' }, can);
      mug = mugProp(L.mid, false); glass = mugProp(L.mid, true);
      coin = S('g', {}, L.mid); S('ellipse', { cx: 0, cy: 0, rx: 22, ry: 22, fill: '#FFD23F', ...OL4 }, coin); MS.T(coin, 0, 8, '€', 26, PL, { style: 'font-family:FR,sans-serif;font-weight:700' });
      // cars (front view, drawn in front)
      car1 = carProp(L.front, '#E63946'); car2 = carProp(L.front, '#5AA9FF');
      // sweat drops
      drops = [0, 1, 2].map(() => S('path', { d: 'M0,-14 Q10,2 0,10 Q-10,2 0,-14 Z', fill: '#7FD8FF', ...OL4 }, L.fxl));
      // bunting
      bunting = S('g', {}, L.set);
      const cols = ['#5AA9FF', '#FFFDF7']; for (let i = 0; i < 16; i++) { const x = 2230 + i * 52, y = 440 + Math.sin(i / 15 * Math.PI) * 60; S('path', { d: `M${x - 20},${y - 12} L${x + 20},${y - 12} L${x},${y + 36} Z`, fill: cols[i % 2], ...OL4 }, bunting); }
      S('path', { d: 'M2210,430 Q2640,540 3070,430', stroke: PL, 'stroke-width': 4, fill: 'none' }, bunting);
      // FX cues
      L.fx.bang(6.6, '?', t => [beepX(t) + 60, 390], .9, '#2EC4B6');
      L.fx.bang(8.0, '!', t => [beepX(t) + 70, 380], .8, '#FFC145');
      L.fx.puff(4.15, 620, G - 10, 8);
      L.fx.bang(25.9, '?', t => [beepX(t) + 60, 400], .9, '#2EC4B6');
      L.fx.puff(31.3, 1300, 640, 8);
      L.fx.dizzy(31.6, 33.6, t => [beepX(t), 480]);
      L.fx.sparkle(38.4, 1400, 600); L.fx.sparkle(41.9, 1400, 600);
      L.fx.sparkle(44.7, 1330, 560); L.fx.sparkle(45.6, 1330, 520);
      L.fx.puff(61.9, 2840, 700, 6);
      L.fx.bang(67.8, '?', t => [beepX(t) - 70, 380], .9, '#2EC4B6');
      L.fx.puff(80.5, 2800, 640, 12);
      L.fx.dizzy(80.9, 82.6, t => [beepX(t), 420]);
      L.fx.sparkle(86.2, 2800, 640); L.fx.sparkle(89.1, 2790, 620);
      L.fx.bang(98.8, '!', t => [beepX(t), 360], .9, '#E63946');
      L.fx.bang(100.0, '!', t => [3640, 470], .8, '#E63946', 70);
      L.fx.sparkle(109.8, 3900, 560);
    },
    camera(t) {
      const z = V ? 1 : 0;
      const keys = V ? [
        [3.2, [700, 640, 1.45]], [11, [800, 640, 1.5]], [14.5, [880, 640, 1.55]], [19.5, [1010, 640, 1.65]], [24, [1090, 640, 1.65]], [28, [1230, 630, 1.7]], [31, [1340, 620, 1.78]],
        [37, [1370, 620, 1.75]], [44.5, [1350, 600, 1.85]], [47, [1450, 630, 1.55]], [58.5, [2440, 630, 1.55]], [62, [2740, 630, 1.78]], [78.5, [2760, 600, 1.9]], [84, [2760, 620, 1.8]], [91, [2770, 620, 1.78]],
        [96.5, [3480, 630, 1.6]], [98.8, [3590, 630, 1.6]], [106, [3560, 630, 1.62]], [110.8, [3980, 630, 1.55]], [113, [4180, 620, 1.55]],
      ] : [
        [3.2, [800, 560, 1.0]], [14, [960, 560, 1.05]], [28, [1250, 560, 1.15]], [46, [1450, 560, 1.1]], [58, [2450, 560, 1.1]], [62, [2700, 560, 1.3]], [92, [2760, 560, 1.3]], [97, [3500, 560, 1.15]], [112, [4100, 560, 1.1]],
      ];
      const v = K(keys, t); return { x: v[0], y: v[1], z: v[2] };
    },
    iris(t) { if (t < 111.8 || t >= 114.5) return null; const r = K([[111.8, 1500], [113.7, 170, 'io'], [114.5, 0, 'in']], t), c = this.camera(t); return { r, x: (beepX(t) - c.x) * c.z + MS.W / 2, y: (G - 180 - c.y) * c.z + MS.H / 2 }; },
    update(t, L) {
      const bx = beepX(t), by = beepY(t), vx = (beepX(t + .03) - beepX(t - .03)) / .06;
      // ------------ BEEP state ------------
      let rot = 0, armL, armR, face = 'neutral', fp = 0, look = .5, lookY = 0, blink;
      const faces = [[0, 'neutral'], [4.1, 'happy'], [5.4, 'wide'], [6.6, 'question'], [7.6, 'wide'], [8.0, 'idea'], [9.0, 'happy'], [12.4, 'stars'], [13.4, 'happy'], [15.2, 'sad'], [17.2, 'idea'], [19.4, 'happy'], [20.6, 'neutral'], [25.9, 'question'], [27.2, 'happy'], [30.2, 'loading'], [31.0, 'x'], [31.6, 'swirl'], [33.4, 'sad'], [34.8, 'neutral'], [38.4, 'wide'], [39.4, 'learning'], [41.0, 'neutral'], [41.9, 'check'], [43.4, 'happy'], [44.6, 'stars'], [47, 'happy'], [58, 'wide'], [62, 'happy'], [65.6, 'happy'], [67.0, 'wide'], [67.9, 'question'], [71.0, 'exclaim'], [72.0, 'learning'], [74.0, 'wide'], [79.6, 'angry'], [80.5, 'x'], [80.9, 'swirl'], [82.6, 'sad'], [84.5, 'learning'], [88.0, 'neutral'], [89.1, 'heart'], [92.5, 'happy'], [96.8, 'neutral'], [97.4, 'exclaim'], [98.5, 'wide'], [98.9, 'x'], [99.8, 'sad'], [101.0, 'question'], [102.0, 'learning'], [103.8, 'dots'], [106.4, 'wide'], [107.0, 'happy'], [109.2, 'heart']];
      face = step(faces, t);
      if (face === 'learning') fp = t < 41 ? clamp((t - 39.4) / 1.4) : t < 80 ? clamp((t - 72) / 4) : t < 90 ? clamp((t - 84.5) / 3) : clamp((t - 102) / 1.4);
      if (face === 'loading') fp = clamp((t - 30.2) / .8);
      look = step([[0, .6], [5.4, -.9], [6.0, .8], [7.0, -.5], [8.0, .6], [61.5, -.9], [66.5, 1], [67.6, -.9], [74, 0], [79.6, -.6], [88, -.4], [96.8, .7], [97.1, -.8], [97.6, .8]], t);
      lookY = step([[0, 0], [66.4, -1], [67.4, 0]], t);
      blink = (t > 74 && t < 79.4) ? 0 : undefined;
      // arms
      const idleR = [92, 88], idleL = [-92, 88];
      // bottle hold / drink (right hand)
      const drinkK = K([[9.4, 0], [10.0, 1, 'out'], [12.0, 1], [12.5, 0, 'io']], t);
      armR = [lerp(92, 78, drinkK), lerp(88, -60, drinkK)];
      if (t > 14 && t < 17) armR = [92 + Math.sin(t * 20) * 10, 60]; // shake empty bottle
      if (t >= 19.0 && t < 19.5) armR = [K([[19.0, 92], [19.35, 140, 'out']], t), K([[19.0, 88], [19.35, -30, 'out']], t)];
      if (t >= 27.4 && t < 31.1) armR = [K([[27.4, 92], [29.6, 92], [30.4, 152, 'io'], [31.0, 142]], t), K([[27.4, 88], [29.6, 40], [30.4, -45, 'io'], [31.0, -40]], t)];
      if (t >= 40.0 && t < 41.8) armR = [K([[40.0, 92], [40.9, 152, 'io']], t), K([[40.0, 88], [40.9, -38, 'io']], t)];
      if (t >= 41.8 && t < 43.4) armR = [92, 60];
      if (t >= 43.4 && t < 46) armR = [lerp(92, 74, K([[43.4, 0], [44.2, 1]], t)), 20 - 70 * K([[44.2, 0], [45.2, 1, 'out']], t)];
      armL = idleL;
      // gag 2 hands
      if (t >= 65.2 && t < 92) {
        const raise = K([[65.2, 0], [65.9, 1, 'out']], t), over = t > 74.2 && t < 79.4 ? K([[74.2, 0], [75, 1]], t) : 0;
        let hx = -126, hy = -52;
        if (t >= 80.0 && t < 83.5) { hx = -124; hy = -56; }
        if (t >= 86 && t < 87.2) { hy = -52; }
        armL = [lerp(-92, hx, raise), lerp(88, hy, raise)];
        if (t >= 91) armL = idleL;
      }
      if (t >= 100 && t < 106.5) { armR = idleR; armL = idleL; }
      // beep rotation
      rot = K([[30.8, 0], [31.2, -18, 'out'], [31.7, 22], [32.4, 0, 'el']], t) + K([[80.4, 0], [80.7, -24, 'out'], [81.2, 18], [81.8, 0, 'el']], t);
      const s = sq([[4.1, .22], [20.1, .06], [31.3, .3], [38.4, .1], [80.4, .3], [98.95, .28], [99.3, .15]], t);
      const flipX = 1;
      let sxv = (1 + s * .6) * 1, syv = 1 - s;
      const thr = 1;
      const bst = { x: bx, y: by, rot, sx: sxv, sy: syv, face, fp, label: face === 'loading' ? 'SCAN' : face === 'learning' ? (t < 41 ? 'PFAND' : t < 85 ? 'EYES' : t < 91 ? 'EYES' : 'ROT') : '', look: look * flipX, lookY, blink, thrust: thr, talk: MS.mouth('B', t), antX: MS.beepAntenna(vx, t, [[31.3, 1.3], [80.4, 1.3], [98.95, 1.2]]), acc: { scarf: true }, armL, armR };
      const bs = beep.draw(bst, t, G);
      // the draw returns world points for props
      const hwR = bs.hwR, hwL = bs.hwL;
      // Tyrolean hat on BEEP's head
      const pr = rot * Math.PI / 180, hX = bx + Math.sin(pr) * 198 * syv, hY = by - Math.cos(pr) * 198 * syv + 16;
      hat.setAttribute('transform', TR(hX, hY, rot, .9));
      show(hat, !(t < 4.0) && !(t > 111.7));

      // ------------ MOCHI ------------
      const mx = mochiX(t), my = mochiY(t), mvx = (mochiX(t + .05) - mochiX(t - .05)) / .1;
      const mflipBase = step([[0, 1], [36.8, -1], [46.2, 1], [61.4, -1], [91.5, 1]], t);
      const mflip = Math.abs(mvx) > 8 ? Math.sign(mvx) : mflipBase;
      let mpose = Math.abs(mvx) > 330 ? 'run' : Math.abs(mvx) > 12 ? 'walk' : 'sit';
      if (t > 36.2 && t < 37.6) mpose = t < 36.5 ? 'crouch' : 'stretch';
      if ((t > 60.4 && t < 62.1) || (t > 91.8 && t < 92.7)) mpose = t < 60.8 || (t > 91.8 && t < 92.0) ? 'crouch' : 'stretch';
      const cb = K([[86.0, 0], [86.4, 1, 'out'], [87.2, 1], [87.8, 0]], t);
      const mEyes = t > 85.8 && t < 88 ? (t > 86.8 ? 'closed' : 'open') : t > 98.8 && t < 99.6 ? 'wide' : t > 38.5 && t < 40 ? 'half' : t > 106.6 ? 'happy' : 'open';
      const mst = { x: mx, y: my, flip: mflip, pose: mpose, eyes: mEyes, look: t > 85.8 && t < 87 ? .8 : 0, mouth: 'w', tilt: cb * 12, headDy: cb * 14, tailAmp: 1, acc: { scarf: true } };
      if (t > 34.2 && t < 36.4) mst.mouth = 'open';
      const mh = mochi.draw(mst, t);

      // ------------ people ------------
      // KLARA
      const kx = klX(t), kfl = step([[0, -1], [26.2, 1], [46.2, 1]], t);
      let kpose = t > 20.3 && t < 23.0 ? 'walk' : 'stand', kbow = 0, karm = {};
      if (t >= 23.3 && t < 24.0) { kpose = 'bow'; kbow = K([[23.3, 0], [23.6, .55, 'out'], [24.0, 0]], t); }
      if (t >= 24.0 && t < 26.4) karm.armR = [58, -218];
      if (t >= 26.4 && t < 28.2) kpose = 'point';
      if (t >= 43.0 && t < 44.6) karm.armR = [70, -150];
      if (t >= 46.0 && t < 49) kpose = 'wave';
      klara.draw(Object.assign({ x: kx, y: G, flip: kfl, pose: kpose, bowAmt: kbow, talk: MS.mouth('K', t), eyes: t > 44 ? 'happy' : 'open' }, karm), t);

      // JONAS (sits at bench, faces right)
      let jarm = {}, jeyes = 'open', jpose = 'sit', jhead = 0;
      if (t >= 61.6 && t < 64.8) jarm.armR = [70 + Math.sin(t * 12) * 18, -250]; // wave
      const jraise = K([[64.6, 0], [65.2, 1, 'out']], t);
      let jr = [lerp(46, 120, jraise), lerp(-110, -112, jraise)];
      if (t >= 65.2) jarm.armR = jr;
      if (t >= 67.6 && t < 70.0) { jarm.armR = [K([[67.6, 120], [68.4, 46, 'io']], t), K([[67.6, -112], [68.4, -110, 'io']], t)]; jeyes = 'sad'; }
      if (t >= 69.2 && t < 72.6) { jarm.armR = [K([[69.2, 46], [69.8, 14, 'out']], t), K([[69.2, -110], [69.8, -258, 'out']], t)]; jeyes = 'open'; } // points at own eyes
      if (t >= 72.6 && t < 74.2) { jarm.armR = [K([[72.6, 14], [73.4, 120, 'io']], t), K([[72.6, -258], [73.4, -112, 'io']], t)]; }
      if (t >= 74.2 && t < 79.2) { jarm.armR = [118, -112]; jeyes = 'wide'; jhead = K([[74.2, 0], [75, -10]], t); }
      if (t >= 79.2 && t < 80.3) { jarm.armR = [K([[79.2, 118], [80.3, 128]], t), -112]; jeyes = 'wide'; }
      if (t >= 80.3 && t < 83.6) { jarm.armR = [128, -112]; jeyes = 'closed'; }
      if (t >= 83.6 && t < 86.0) { jarm.armR = [K([[83.6, 128], [84.4, 60, 'io']], t), -112]; jeyes = 'happy'; }
      if (t >= 86.0 && t < 87.6) { jarm.armR = [110, K([[86.0, -112], [86.4, -80, 'out']], t)]; jeyes = 'happy'; }
      if (t >= 87.6 && t < 88.4) jarm.armR = [K([[87.6, 110], [88.4, 120, 'io']], t), -112];
      if (t >= 88.4 && t < 91) { jarm.armR = [120, -112]; jeyes = 'happy'; }
      if (t >= 91) { jarm.armR = [46, -110]; jeyes = 'happy'; }
      jarm.armL = [-46, -110];
      jonas.draw(Object.assign({ x: 2650, y: G, flip: 1, pose: jpose, talk: MS.mouth('J', t), eyes: jeyes, headRot: jhead, blush: t > 80 }, jarm), t);

      // OPA + LENA (waiting at curb)
      const wait = t > 92;
      const oFlip = 1, oy = G;
      let opaPose = 'stand', opaArm = {}, opaHead = 0;
      if (t >= 99.2 && t < 101.6) { opaHead = 6; opaArm.armR = [70, -150]; }
      const cross = K([[107.4, 0], [111, 1]], t);
      const ox = t < 92 ? 3590 : 3590 + (t > 107.4 ? lerp(0, 700, E.io(cross)) : 0);
      const lx = t < 92 ? 3670 : 3670 + (t > 107.6 ? lerp(0, 700, E.io(R(107.6, 111.2, t))) : 0);
      const walkO = t > 107.4 && t < 111;
      opa.draw(Object.assign({ x: ox - 20, y: oy, flip: 1, pose: walkO ? 'walk' : 'stand', headRot: opaHead, eyes: t > 109 ? 'happy' : 'open', talk: 0, shadow: t >= 92 }, opaArm), t);
      let lPose = t > 107.6 && t < 111.2 ? 'walk' : 'stand', lArm = {};
      if (t >= 99.9 && t < 101.4) { lPose = 'point'; }
      lena.draw(Object.assign({ x: lx, y: G, flip: 1, pose: lPose, talk: MS.mouth('C', t), eyes: t > 109.2 ? 'happy' : 'open', shadow: t >= 92 }, lArm), t);
      show(opa.root, t >= 91.5); show(lena.root, t >= 91.5); show(opa.shadow, t >= 91.5); show(lena.shadow, t >= 91.5);

      // ------------ props ------------
      // bottle
      let bpos = null;
      const fly = (a, b, p0, p1, h, t) => { const p = clamp((t - a) / (b - a)); return [lerp(p0[0], p1[0], p), lerp(p0[1], p1[1], p) - Math.sin(p * Math.PI) * h]; };
      let bq = 0.1, brot = 0;
      if (t < 19.3) { bpos = [hwR[0] + 6, hwR[1] - 6]; brot = lerp(10, 125, drinkK) * 1; bq = t < 10 ? 1 : K([[10.0, 1], [11.8, 0.05]], t); if (t >= 12.5 && t < 19.3) bq = .05; }
      else if (t < 20.1) { bpos = fly(19.35, 20.1, hwR, [1050, 735], 120, t); brot = (t - 19.35) * 720; bq = .05; }
      else if (t < 24.0) bpos = null;
      else if (t < 27.2) { const kx2 = kx + kfl * 58; bpos = [kx2, G - 218]; brot = 0; bq = .05; if (t < 24.3) bpos = [1050, 740 - (t - 24.0) * 150]; }
      else if (t < 27.7) { bpos = fly(27.2, 27.7, [kx + 58, G - 218], hwR, 40, t); bq = .05; }
      else if (t < 31.0) { bpos = [hwR[0] + 6, hwR[1] - 4]; brot = 90 * R(29.6, 30.4, t); bq = .05; }
      else if (t < 32.2) { bpos = fly(31.0, 32.2, [1420, 640], [1210, G - 20], 130, t); brot = 90 + (t - 31) * 400; bq = .05; if (t > 32.1) brot = 90; }
      else if (t < 40.0) { bpos = [1210, G - 18]; brot = 90; bq = .05; }
      else if (t < 41.0) { bpos = [lerp(1210, hwR[0] + 4, E.io(R(40.0, 40.7, t))), lerp(G - 18, hwR[1] - 4, E.io(R(40.0, 40.7, t)))]; brot = lerp(90, 90, 1); bq = .05; }
      else if (t < 41.8) { bpos = [hwR[0] + 8 + (t - 41) * 20, hwR[1] - 2]; brot = 90; bq = .05; }
      show(bottle.g, !!bpos); if (bpos) { bottle.g.setAttribute('transform', TR(bpos[0], bpos[1], brot, 1)); at(bottle.water, { y: -4 + 40 * (1 - bq), height: 40 * bq + .01 }); }
      // can (Mochi)
      let cpos = null;
      if (t > 34.4 && t < 36.8) cpos = [mh.head[0] + mflip * 56, mh.head[1] + 24];
      else if (t >= 36.8 && t < 37.5) { cpos = fly(36.8, 37.5, [mh.head[0] + mflip * 56, mh.head[1] + 24], [1410, 665], 60, t); }
      show(can, !!cpos); if (cpos) can.setAttribute('transform', TR(cpos[0], cpos[1], (t - 36.8) * 900 * (t > 36.8), 1));
      // machine screen + receipt
      const accept1 = t >= 38.0 && t < 39.6, accept2 = t >= 41.7 && t < 43.0, rej = t >= 31.0 && t < 32.6;
      show(scr.idle, !(accept1 || accept2 || rej)); show(scr.x, rej && (Math.floor(t * 6) % 2 === 0)); show(scr.ok, accept1 || accept2);
      const rp = t >= 38.4 && t < 39.8 ? E.out(R(38.4, 39.2, t)) : t >= 39.8 && t < 41.8 ? 1 - E.in(R(39.8, 40.6, t)) : t >= 41.9 && t < 43.4 ? E.out(R(41.9, 42.7, t)) : t >= 43.4 && t < 44.4 ? 1 - E.in(R(43.4, 44.2, t)) : 0;
      show(receipt, rp > .01); receipt.setAttribute('transform', `translate(0,${-86 + rp * 86 - 0}) `);
      // coin
      let cop = null;
      if (t >= 44.3 && t < 45.0) cop = fly(44.3, 45.0, [kx + 70, G - 150], [bx + 74, by - 100], 40, t);
      else if (t >= 45.0 && t < 47.5) cop = [bx + 74, by - 100 - Math.abs(Math.sin((t - 45) * 4)) * 70];
      else if (t >= 47.5 && t < 58) cop = [bx + 40, by - 250 + Math.sin(t * 3) * 20];
      show(coin, !!cop); if (cop) coin.setAttribute('transform', `translate(${cop[0]},${cop[1]}) scale(${Math.cos(t * 9)},1)`);
      // mugs / saucer
      const clink1 = t > 65.4 && t < 68.0, hmx = 2650 + hwRel(jarm.armR);
      function hwRel(a) { return a ? a[0] : 46; }
      const jHand = jarm.armR || [46, -110];
      let mugPos = [2650 + jHand[0], G + jHand[1] - 20];
      const mugOn = t >= 61.0;
      show(mug.g, mugOn); mug.g.setAttribute('transform', TR(mugPos[0], mugPos[1], t >= 83.6 && t < 91 ? K([[83.6, 0], [84.4, 0], [86.0, 0], [86.4, 26, 'out'], [87.4, 26], [88.0, 0, 'io']], t) : 0, .8));
      const foamPop = t >= 80.3 && t < 82.2 ? 1 + E.out(R(80.3, 80.8, t)) * 1.1 : 1;
      mug.foam.setAttribute('transform', `translate(0,-40) scale(${foamPop}) translate(0,40)`);
      // BEEP's glass: sits in BEEP hand (visible left hand at table, mirrored)
      show(glass.g, t >= 61.0 && t < 92);
      if (t >= 61.0 && t < 92) {
        const gh = t >= 65.2 ? hwL : [bx - 70, by + 60];
        glass.g.setAttribute('transform', TR(gh[0], gh[1] - 22, 0, .62));
        glass.foam.setAttribute('transform', `translate(0,-40) scale(${t >= 80.3 && t < 82 ? 2 : .8}) translate(0,40)`);
      }
      show(saucer, t >= 62 && t < 92); saucer.setAttribute('transform', TR(2792, 704, 0, 1));
      // sweat drops on Jonas while BEEP stares
      drops.forEach((d, i) => { const on = t > 75.2 && t < 79.4, p = ((t * .9 + i / 3) % 1); show(d, on); if (on) d.setAttribute('transform', `translate(${2650 + 20 + i * 24},${G - 330 + p * 60}) scale(${1 - p * .3})`); });

      // ------------ cars + ampel ------------
      const carFn = (c, a, b, x0) => { const k = (t - a) / (b - a); show(c, k > 0 && k < 1); if (k > 0 && k < 1) { const e = E.in(k); c.setAttribute('transform', TR(x0 + 20 * k, lerp(730, 1560, e), 0, lerp(.28, 2.4, e))); } };
      carFn(car1, 94.3, 95.1, 3910); carFn(car2, 98.35, 99.15, 3910);
      const green = t >= 106.5;
      [0, 1].forEach(i => { show(ampR[i], !green); show(ampG[i], green); show(ampR2[i], false); show(ampG2[i], green); const ph = Math.sin((t - 106.5) * 8); ampG2[i].setAttribute('d', `M${-9 + ph * 7},510 L${-3},482 L${9 - ph * 7},510`); ampR2[i].setAttribute('d', ''); });
      ampG2.forEach((_, i) => { /* arms */ });
      // bunting is foreground only in the beer garden region
    },
  };
})();
