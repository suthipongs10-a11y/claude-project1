// EPISODE: BEEP at HOME — The Cat Who Broke My Brain. One living room (x 0..2000), ground G=860, camera pans along it.
(function () {
  const { S, K, step, sq, clamp, lerp, E, at, show } = MS, G = 860, PL = MS.PL, OL = MS.OL(6), OL4 = MS.OL(4);
  const R = (a, b, t) => clamp((t - a) / (b - a));
  const TR = (x, y, r = 0, s = 1) => `translate(${x},${y}) rotate(${r}) scale(${s})`;
  const V = MS.VERTICAL;
  let beep, mochi, winSky, moon, stars, night, dawn, dock, bedP, boxFront, boxBack, plantStool, puddle, petals, icepack;
  const items = [];

  // ---------------- timelines (pure functions of t) ----------------
  const gF = t => K([[0, 0], [12.3, 0], [12.9, 1, 'out'], [34.2, 1], [35.0, 0, 'out'], [91.8, 0], [92.4, 1, 'out'], [93.8, 1], [94.4, 0, 'out'], [99.0, 0], [99.0, 1], [106.0, 1], [106.4, 0, 'out'], [116.2, 0], [117, 1, 'out'], [150, 1]], t);
  const bxF = t => K([[3.2, 520], [4.4, 520], [5.6, 720, 'io'], [7.0, 560, 'io'], [8.0, 430, 'io'], [11.2, 430], [12.4, 560, 'io'], [34.0, 560], [36.0, 820, 'io'], [40.6, 960, 'io'], [44.0, 1440, 'io'], [68.0, 1440], [71.2, 1560, 'io'], [73.0, 1620, 'io'], [84.0, 1650], [85.4, 1800, 'io'], [87.0, 1800], [89.4, 1620, 'io'], [91.6, 1490, 'io'], [98.8, 1490], [98.8, 560], [106.0, 560], [108.5, 900, 'io'], [110, 420, 'io'], [112, 820, 'io'], [113.4, 300, 'in'], [115, 560, 'io'], [150, 560]], t);
  const byF = t => {
    const g = gF(t), hover = G - 180 + Math.sin(t * 3.2) * 7 + K([[3.2, -900], [4.1, 0, 'in'], [4.4, 0]], t);
    const lift = K([[85.2, 0], [86.2, -40, 'io'], [88.8, -40], [89.6, 0, 'io']], t);
    return lerp(hover + lift, G - 98, g);
  };
  const stackIdx = [{ h: 76 }, { h: 76 }, { h: 90 }]; // glass, mug, plant stacked on BEEP's head

  // ---------------- builders ----------------
  function itemShape(kind, parent) {
    const g = S('g', {}, parent);
    if (kind === 'glass') { S('path', { d: 'M-24,-38 L24,-38 L18,38 L-18,38 Z', fill: '#DFF4FF', ...OL4 }, g); S('path', { d: 'M-20,-6 L20,-6 L17,36 L-17,36 Z', fill: '#4DB6FF' }, g); }
    if (kind === 'mug') { S('path', { d: 'M24,-22 q34,4 24,30 q-4,12 -24,10', fill: 'none', ...MS.OL(9) }, g); S('path', { d: 'M24,-22 q34,4 24,30 q-4,12 -24,10', fill: 'none', stroke: '#E63946', 'stroke-width': 4 }, g); S('rect', { x: -28, y: -38, width: 56, height: 76, rx: 10, fill: '#E63946', ...OL4 }, g); S('rect', { x: -28, y: -10, width: 56, height: 14, fill: '#FFFDF7' }, g); }
    if (kind === 'plant') { [[-22, -46, -30], [0, -62, 0], [22, -46, 30]].forEach(([x, y, r]) => S('ellipse', { cx: x, cy: y, rx: 12, ry: 30, fill: '#5DB561', transform: `rotate(${r} ${x} ${y + 24})`, ...OL4 }, g)); S('path', { d: 'M-34,-14 L34,-14 L26,44 L-26,44 Z', fill: '#D9723B', ...OL4 }, g); S('rect', { x: -38, y: -20, width: 76, height: 14, rx: 5, fill: '#E9884F', ...OL4 }, g); }
    if (kind === 'vase') { S('line', { x1: 0, y1: -50, x2: 0, y2: -80, stroke: '#3E9B5A', 'stroke-width': 6 }, g); [0, 72, 144, 216, 288].forEach(a => S('ellipse', { cx: Math.cos(a * Math.PI / 180) * 16, cy: -94 + Math.sin(a * Math.PI / 180) * 16, rx: 12, ry: 12, fill: '#FFE14D', ...MS.OL(3) }, g)); S('circle', { cx: 0, cy: -94, r: 9, fill: '#E39B3C', ...MS.OL(3) }, g); S('path', { d: 'M-18,-40 Q-34,0 -22,48 L22,48 Q34,0 18,-40 Z', fill: '#5AA9FF', ...OL4 }, g); }
    return g;
  }

  window.EP = {
    build(L) {
      // ---- wall + floor ----
      S('rect', { x: -600, y: -1600, width: 3400, height: 2320, fill: '#FFE3C2' }, L.sky);
      for (let x = -600; x < 2800; x += 120) S('rect', { x, y: -1600, width: 60, height: 2320, fill: '#FFD6A8', opacity: .55 }, L.sky);
      S('rect', { x: -600, y: 700, width: 3400, height: 1500, fill: '#D9A66C' }, L.set);
      for (let y = 740; y < 1400; y += 70) S('rect', { x: -600, y, width: 3400, height: 5, fill: '#C48F57' }, L.set);
      for (let i = 0; i < 40; i++) S('rect', { x: -500 + i * 140 + (i % 2) * 70, y: 712 + (i % 5) * 70, width: 5, height: 70, fill: '#C48F57' }, L.set);
      S('rect', { x: -600, y: 690, width: 3400, height: 24, fill: '#FFFDF7', stroke: PL, 'stroke-width': 4 }, L.set);
      // ---- window (x 400..640) ----
      winSky = S('rect', { x: 410, y: 270, width: 220, height: 280, fill: '#BFE6F5' }, L.sky);
      moon = S('g', {}, L.sky); S('circle', { cx: 570, cy: 340, r: 28, fill: '#FFF7C2' }, moon); S('circle', { cx: 582, cy: 332, r: 24, fill: '#1B2350' }, moon);
      stars = S('g', {}, L.sky); [[450, 320], [500, 400], [600, 440], [470, 480], [540, 300]].forEach(([x, y]) => S('circle', { cx: x, cy: y, r: 4, fill: '#FFF7C2' }, stars));
      S('rect', { x: 400, y: 260, width: 240, height: 300, fill: 'none', stroke: '#FFFDF7', 'stroke-width': 14 }, L.sky); S('line', { x1: 520, y1: 260, x2: 520, y2: 560, stroke: '#FFFDF7', 'stroke-width': 10 }, L.sky); S('line', { x1: 400, y1: 410, x2: 640, y2: 410, stroke: '#FFFDF7', 'stroke-width': 10 }, L.sky);
      S('path', { d: 'M370,240 L410,240 Q430,400 392,590 L370,590 Z', fill: '#FF9EB5', ...OL4 }, L.sky); S('path', { d: 'M670,240 L630,240 Q610,400 648,590 L670,590 Z', fill: '#FF9EB5', ...OL4 }, L.sky);
      // wall pictures
      [[760, 330, 120, 150, '#FFC145'], [920, 360, 110, 110, '#7FD0E8'], [1580, 340, 140, 170, '#9BD78A'], [1790, 380, 120, 120, '#FF9EB5']].forEach(([x, y, w, h, c]) => { S('rect', { x, y, width: w, height: h, fill: '#FFFDF7', ...OL }, L.sky); S('rect', { x: x + 14, y: y + 14, width: w - 28, height: h - 28, fill: c }, L.sky); S('circle', { cx: x + w / 2, cy: y + h / 2, r: Math.min(w, h) / 5, fill: '#FFFDF7', opacity: .7 }, L.sky); });
      // ---- sofa (x 70..430) ----
      const sf = S('g', {}, L.set);
      S('rect', { x: 80, y: 520, width: 350, height: 190, rx: 40, fill: '#6F8FE0', ...OL }, sf); S('rect', { x: 60, y: 600, width: 70, height: 200, rx: 30, fill: '#5F7FD0', ...OL }, sf); S('rect', { x: 380, y: 600, width: 70, height: 200, rx: 30, fill: '#5F7FD0', ...OL }, sf);
      S('rect', { x: 120, y: 660, width: 270, height: 110, rx: 26, fill: '#7D9CE8', ...OL }, sf); S('rect', { x: 110, y: 780, width: 14, height: 80, fill: '#6B4423' }, sf); S('rect', { x: 386, y: 780, width: 14, height: 80, fill: '#6B4423' }, sf);
      // ---- dock (BEEP charger) ----
      dock = S('g', {}, L.set); S('ellipse', { cx: 560, cy: 862, rx: 90, ry: 16, fill: '#3D405B', ...OL }, dock); S('ellipse', { cx: 560, cy: 858, rx: 60, ry: 9, fill: '#7FF6FF' }, dock); S('path', { d: 'M650,862 Q760,900 820,850', stroke: PL, 'stroke-width': 8, fill: 'none', 'stroke-linecap': 'round' }, dock);
      // ---- plant stool (x 800) ----
      plantStool = S('g', {}, L.set); S('rect', { x: 770, y: 800, width: 60, height: 60, fill: '#8C5A2B', ...OL4 }, plantStool);
      const pl = itemShape('plant', plantStool); pl.setAttribute('transform', 'translate(800,756) scale(1.3)'); plantStool._p = pl;
      // ---- table (x 1090..1330, top y 706) ----
      const tb = S('g', {}, L.set);
      S('rect', { x: 1090, y: 706, width: 250, height: 22, rx: 8, fill: '#D9A25F', ...OL }, tb); S('rect', { x: 1110, y: 728, width: 18, height: 132, fill: '#6B4423', ...OL4 }, tb); S('rect', { x: 1300, y: 728, width: 18, height: 132, fill: '#6B4423', ...OL4 }, tb);
      // ---- box (x 1800) + bed ----
      boxBack = S('g', {}, L.set);
      S('rect', { x: 1715, y: 720, width: 170, height: 140, fill: '#B98A50', ...OL }, boxBack); S('path', { d: 'M1715,720 L1690,680 L1760,690 L1760,720 Z', fill: '#C79A60', ...OL4 }, boxBack); S('path', { d: 'M1885,720 L1910,680 L1840,690 L1840,720 Z', fill: '#C79A60', ...OL4 }, boxBack);
      bedP = S('g', {}, L.set); S('ellipse', { cx: 0, cy: -20, rx: 90, ry: 40, fill: '#FF9EB5', ...OL }, bedP); S('ellipse', { cx: 0, cy: -26, rx: 62, ry: 22, fill: '#FFD1DC' }, bedP); S('path', { d: 'M-90,-20 Q-90,10 0,12 Q90,10 90,-20', fill: '#FF9EB5', ...OL }, bedP);
      // ---- characters (BEEP first so MOCHI can sit on top of him) ----
      beep = MS.makeBeep(L.mid, L.back);
      mochi = MS.makeCat(L.mid, L.back);
      // ---- props ----
      ['glass', 'mug', 'plant', 'vase'].forEach(k => items.push({ k, g: itemShape(k, L.mid) }));
      puddle = S('g', {}, L.set); S('ellipse', { cx: 1330, cy: 856, rx: 62, ry: 9, fill: '#7FD8FF', opacity: .85, ...OL4 }, puddle); [[1280, 850], [1370, 852], [1310, 846]].forEach(([x, y]) => S('circle', { cx: x, cy: y, r: 9, fill: '#FFE14D', ...MS.OL(3) }, puddle));
      icepack = S('g', {}, L.mid); S('rect', { x: -50, y: -26, width: 100, height: 52, rx: 16, fill: '#8FD8FF', ...OL4 }, icepack); S('rect', { x: -34, y: -14, width: 22, height: 22, rx: 4, fill: '#E8F9FF', transform: 'rotate(12)' }, icepack); S('rect', { x: 6, y: -8, width: 22, height: 22, rx: 4, fill: '#E8F9FF', transform: 'rotate(-10)' }, icepack);
      boxFront = S('g', {}, L.front); S('rect', { x: -85, y: -70, width: 170, height: 140, fill: '#C79A60', ...OL }, boxFront); S('rect', { x: -85, y: -70, width: 170, height: 24, fill: '#B98A50', ...OL4 }, boxFront); MS.T(boxFront, 0, 22, 'PET BED', 30, '#7A4A2A', { style: 'font-family:FR,sans-serif;font-weight:700' }); S('rect', { x: -40, y: 40, width: 80, height: 14, fill: '#E8D3A8', stroke: PL, 'stroke-width': 3 }, boxFront);
      // night + dawn overlays (world space, above characters, under UI)
      dawn = S('rect', { x: -600, y: -1600, width: 3400, height: 3200, fill: '#FF9A3C', opacity: 0, 'pointer-events': 'none' }, L.fxl);
      night = S('rect', { x: -600, y: -1600, width: 3400, height: 3200, fill: '#0B1030', opacity: 0, 'pointer-events': 'none' }, L.fxl);
      // ---- FX cues ----
      L.fx.puff(4.15, 520, G - 10, 8);
      L.fx.sparkle(5.6, 700, 560); L.fx.sparkle(6.5, 640, 520); L.fx.sparkle(10.7, 440, 560);
      L.fx.zzzOn(13.2, 24.0, t => [bxF(t) + 40, G - 280]);
      L.fx.bang(22.9, '?', t => [bxF(t) + 70, 500], .9, '#2EC4B6');
      L.fx.bang(24.4, '!', t => [bxF(t) - 60, 480], .8, '#E63946');
      L.fx.dizzy(31.6, 33.6, t => [bxF(t), 520]);
      L.fx.bang(30.0, '?', t => [bxF(t), 470], .8, '#2EC4B6');
      L.fx.sparkle(50.5, 1380, 680); L.fx.sparkle(55.9, 1400, 620);
      L.fx.bang(54.6, '!', t => [bxF(t) - 60, 520], .6, '#FFC145', 70);
      L.fx.bang(63.0, '!', t => [bxF(t) - 40, 450], .9, '#E63946');
      L.fx.puff(63.7, 1330, 840, 10);
      L.fx.dizzy(64.4, 66.0, t => [bxF(t), 460]);
      L.fx.sparkle(72.3, 1480, 760); L.fx.sparkle(72.6, 1620, 600);
      L.fx.bang(79.5, '?', t => [bxF(t), 470], .9, '#2EC4B6');
      L.fx.puff(81.7, 1800, 760, 8);
      L.fx.bang(89.6, '...', t => [bxF(t), 470], 1.2, '#7A4A2A', 60);
      L.fx.zzzOn(100.4, 105.0, t => [bxF(t) + 40, G - 280]);
      L.fx.puff(105.4, 800, 840, 12, '#8C5A2B');
      L.fx.bang(106.1, '!', t => [bxF(t) + 30, 440], .9, '#E63946');
      L.fx.dizzy(108.5, 111.0, t => [bxF(t), 460]);
      L.fx.puff(113.4, 300, 760, 10);
      L.fx.dizzy(113.8, 116.2, t => [bxF(t), 520]);
      L.fx.sparkle(117.2, 600, 540);
      L.fx.sparkle(138.3, 560, 560); L.fx.sparkle(139.4, 600, 520); L.fx.sparkle(142.2, 560, 620); L.fx.sparkle(142.8, 520, 580);
    },
    camera(t) {
      const keys = V ? [
        [3.2, [520, 640, 1.5]], [12, [540, 640, 1.5]], [14, [540, 640, 1.8]], [25, [570, 620, 1.95]], [31, [650, 640, 1.7]], [36, [760, 640, 1.65]], [41, [1100, 640, 1.6]], [45, [1260, 640, 1.8]], [62, [1280, 650, 1.75]], [67, [1380, 650, 1.65]],
        [72, [1580, 660, 1.6]], [84, [1680, 660, 1.65]], [90, [1600, 660, 1.65]], [97, [1560, 640, 1.7]], [98.8, [1300, 640, 1.4]], [99.2, [640, 640, 1.2]], [103, [650, 640, 1.15]], [116, [620, 640, 1.2]], [120, [600, 640, 1.35]], [130, [560, 630, 1.7]], [141, [540, 630, 1.9]],
      ] : [[3.2, [700, 560, 1.0]], [60, [1300, 560, 1.15]], [100, [800, 560, 1.0]], [141, [560, 560, 1.3]]];
      const v = K(keys, t); return { x: v[0], y: v[1], z: v[2] };
    },
    iris(t) { if (t < 143.6 || t >= 146) return null; const r = K([[143.6, 1500], [145.3, 170, 'io'], [146, 0, 'in']], t), c = this.camera(t); return { r, x: (bxF(t) - c.x) * c.z + MS.W / 2, y: (byF(t) - c.y) * c.z + MS.H / 2 }; },
    update(t, L) {
      const bx = bxF(t), by = byF(t), g = gF(t), vx = (bxF(t + .03) - bxF(t - .03)) / .06;
      // ---- overlays: night / dawn / window ----
      night.setAttribute('opacity', K([[12.0, 0], [13.4, .45, 'io'], [14.4, .45], [16, 0, 'io'], [97.6, 0], [98.8, 1, 'io'], [99.0, 1], [99.5, .45, 'io'], [129.4, .45], [131, 0, 'io']], t));
      dawn.setAttribute('opacity', K([[14.4, 0], [15.2, .18], [22, .18], [25, 0], [130.5, 0], [131.5, .14], [140, .14], [143, 0]], t));
      const night1 = (t > 12.6 && t < 15.5) || (t > 98.8 && t < 130.5);
      winSky.setAttribute('fill', night1 ? '#1B2350' : t > 15.5 && t < 24 ? '#FFC9A0' : t >= 130.5 && t < 141 ? '#FFC9A0' : '#BFE6F5'); show(moon, night1); show(stars, night1);
      // ---- BEEP ----
      let rot = 0, armL = [-92, 88], armR = [92, 88], look = .5, lookY = 0, blink;
      rot += Math.sin(t * 11) * 3.5 * K([[18, 0], [19, 1], [24.6, 1], [25, 0]], t);
      rot += Math.sin(t * 5) * K([[57.5, 0], [60.3, 3], [63.0, 6], [63.6, 8], [66.4, 1], [67, 0]], t);
      rot += K([[113.4, 0], [113.7, -34, 'out'], [114.3, 14], [115, 0, 'el']], t) + K([[104.7, 0], [105.0, 10, 'out'], [105.6, 0, 'el']], t);
      // intro arms
      if (t >= 5.0 && t < 8.0) armL = [K([[5.0, -92], [5.6, -150, 'out'], [7.0, -150], [7.6, -92, 'io']], t), K([[5.0, 88], [5.6, -50, 'out'], [7.0, -50], [7.6, 88, 'io']], t)];
      if (t >= 8.0 && t < 10.5) armL = [-150, -30];
      if (t >= 8.0 && t < 11.0) look = -.9;
      // gag 1: swat antenna wobble handled by antX; awake arms flail
      if (t >= 26 && t < 31.5) { armL = [-100 + Math.sin(t * 9) * 25, 20 + Math.cos(t * 7) * 20]; armR = [100 + Math.sin(t * 8) * 25, 10 + Math.cos(t * 9) * 20]; }
      // gag 2: reach toward table edge / hold tower
      if (t >= 45 && t < 50.6) armL = [-100, K([[45, 88], [45.8, 40, 'out'], [49.5, 40], [50.5, 90, 'in']], t)];
      if (t >= 50.8 && t < 66.4) armL = [-78, -50 - Math.sin(t * 5) * 6], armR = [78, -50 + Math.sin(t * 5) * 6];
      // gag 3: carry bed, carry box
      if (t >= 69.4 && t < 72.2) { armL = [-70, 70]; armR = [70, 70]; }
      if (t >= 85.4 && t < 89.8) { armL = [-96, 96]; armR = [96, 96]; }
      if (t >= 80 && t < 84) { armR = [120, -20 + Math.sin(t * 6) * 12]; }
      // gag 4 + payoff
      if (t >= 117 && t < 150) armL = [-60, -90 - 10 * Math.sin(t * 1.5)]; // holds ice pack
      if (t >= 132 && t < 140) { armL = [-60, -88]; armR = [92, 88]; }
      if (t >= 140.4) { armR = [70, 40]; }
      const face = step([[0, 'neutral'], [4.1, 'happy'], [5.4, 'stars'], [7.2, 'happy'], [8.3, 'wink'], [9.0, 'happy'], [11.2, 'battery'], [12.9, 'sleep'], [20.0, 'static'], [21.0, 'sleep'], [23.0, 'wide'], [25.0, 'static'], [27.0, 'wide'], [29, 'annoyed'], [31.5, 'x'], [33.0, 'angry'], [34.5, 'battery'], [38, 'sad'], [40.8, 'happy'], [45, 'neutral'], [46.0, 'question'], [49.5, 'wide'], [50.4, 'happy'], [53, 'neutral'], [54.2, 'wide'], [55.2, 'annoyed'], [57, 'neutral'], [59, 'exclaim'], [62.5, 'wide'], [63.2, 'x'], [64.5, 'swirl'], [66.2, 'sad'], [69, 'neutral'], [70, 'happy'], [72.5, 'stars'], [74, 'happy'], [80, 'question'], [81.5, 'wide'], [82.5, 'suspicious'], [85, 'neutral'], [87, 'annoyed'], [89.5, 'sad'], [92.4, 'x'], [95, 'sad'], [99.9, 'sleep'], [106.0, 'wide'], [107.5, 'exclaim'], [108.5, 'swirl'], [110, 'static'], [112, 'wide'], [113.4, 'x'], [114.5, 'static'], [117, 'sad'], [120, 'static'], [121.2, 'sad'], [123, 'static'], [124.2, 'sad'], [130.5, 'sad'], [132.5, 'question'], [135.2, 'learning'], [138.2, 'check'], [139.2, 'sleep'], [140.2, 'neutral'], [140.6, 'heart']], t);
      let fp = 0, label = '';
      if (face === 'battery') fp = t < 13 ? K([[11.2, .8], [12.9, .25]], t) : t < 40 ? K([[34.5, .3], [38, .12]], t) : .5;
      if (face === 'learning') { fp = clamp((t - 135.2) / 2.8); label = 'BLINK'; }
      look = look + step([[0, 0], [20, 0], [59, .3], [63, 0], [133, -.1]], t);
      if (t >= 44.5 && t < 63) look = -.7; // looks left at MOCHI on the table
      if (t >= 130.5) look = -.8;
      blink = t >= 135.4 && t < 138 ? 0 : undefined;
      const s = sq([[4.1, .22], [17.8, .08], [31.2, .3], [50.5, .1], [55.3, .1], [63.7, .3], [72.0, .1], [81.6, .12], [92.4, .35], [105.3, .22], [113.4, .35], [141.0, .12]], t);
      const sit = K([[92.4, 0], [93.0, 1], [93.8, 1], [94.4, 0]], t);
      const bst = { x: bx, y: by, rot, sx: (1 + s * .6) * (1 + .15 * sit), sy: (1 - s) * (1 - .22 * sit), face, fp, label, look, lookY, blink, thrust: 1 - g, talk: MS.mouth('B', t), antX: MS.beepAntenna(vx, t, [[31.2, 1.3], [63.7, 1.3], [113.4, 1.2], [105.3, 1]]) + (t >= 25 && t < 30.5 ? Math.sin(t * 8) * 38 : 0), acc: {}, armL, armR };
      const bs = beep.draw(bst, t, G);
      const hwL = bs.hwL, hwR = bs.hwR, pr = rot * Math.PI / 180, headX = bx + Math.sin(pr) * 198 * bst.sy, headY = by - Math.cos(pr) * 198 * bst.sy;
      // ---- MOCHI ----
      let mx = 250, my = 696, mflip = 1, mpose = 'sit', meyes = 'half', mst = { mouth: 'w', tailAmp: 1 }, mlook = 0;
      const jumpArc = (a, b, x0, x1, y0, y1, peak, t) => { const p = R(a, b, t); return [lerp(x0, x1, p), lerp(y0, y1, p) - Math.sin(p * Math.PI) * peak]; };
      let sofaEyes = t > 9.4 && t < 10.5 ? 'closed' : 'half';
      if (t < 14) { mx = 250; my = 696; mflip = 1; mpose = 'sit'; meyes = sofaEyes; mlook = t > 8 ? -.2 : 0; }
      else if (t < 14.9) { [mx, my] = jumpArc(14.0, 14.9, 250, 340, 696, 860, 140, t); mpose = 'stretch'; meyes = 'open'; }
      else if (t < 17.0) { mx = lerp(340, 480, R(14.9, 17.0, t)); my = 860; mpose = 'walk'; meyes = 'open'; }
      else if (t < 17.8) { [mx, my] = jumpArc(17.0, 17.8, 480, 565, 860, 566, 300, t); mpose = t < 17.2 ? 'crouch' : 'stretch'; meyes = 'wide'; }
      else if (t < 25.2) { mx = 565; my = 566 + Math.sin(t * 12) * 4; mpose = 'crouch'; mst.wiggle = 1; meyes = 'happy'; mst.mouth = 'tongue'; }
      else if (t < 30.4) { mx = 612; my = 566; mflip = -1; mpose = 'sit'; meyes = 'wide'; mst.paw = t >= 26 ? .55 + .45 * Math.sin(t * 8) : 0; mst.pawT = [78, -86]; mlook = .8; }
      else if (t < 31.2) { [mx, my] = jumpArc(30.4, 31.2, 612, 800, 566, 860, 90, t); mpose = 'stretch'; meyes = 'open'; mflip = 1; }
      else if (t < 40.0) { mx = 800; my = 860; mflip = -1; mpose = 'sit'; meyes = t > 33 ? 'half' : 'open'; mst.mouth = 'smirk'; }
      else if (t < 43.4) { mx = lerp(800, 1060, R(40, 43.4, t)); my = 860; mflip = 1; mpose = 'walk'; meyes = 'open'; }
      else if (t < 44.3) { [mx, my] = jumpArc(43.4, 44.3, 1060, 1215, 860, 706, 160, t); mpose = 'stretch'; mflip = 1; meyes = 'wide'; }
      else if (t < 68.0) {
        mx = 1215; my = 706; mflip = 1; mpose = 'sit'; meyes = 'open'; mlook = .8; mst.mouth = 'smirk';
        const pushes = [49.8, 54.6, 59.0, 63.0];
        let pw = 0; pushes.forEach(p => { pw = Math.max(pw, K([[p - 2.0, 0], [p - .6, .85, 'io'], [p - .05, 1, 'in'], [p + .35, .2, 'out'], [p + .8, 0]], t)); });
        mst.paw = pw; mst.pawT = [100, -46];
        if (t >= 63.8) { meyes = 'happy'; mst.paw = .75 + .1 * Math.sin(t * 7); mst.pawT = [14, -128]; mst.mouth = 'tongue'; mlook = 0; }
      }
      else if (t < 68.9) { [mx, my] = jumpArc(68.0, 68.9, 1215, 1180, 706, 860, 120, t); mpose = 'stretch'; meyes = 'open'; }
      else if (t < 75.5) { mx = lerp(1180, 1400, R(68.9, 75.5, t)); my = 860; mpose = 'walk'; meyes = 'open'; }
      else if (t < 79.3) { mx = 1400; my = 860; mpose = 'sit'; meyes = 'half'; mst.paw = t >= 76.4 && t < 78.4 ? .8 : 0; mst.pawT = [78, -8]; mst.headDy = t >= 76 && t < 78.6 ? 22 : 0; mst.mouth = 'w'; }
      else if (t < 80.6) { mx = lerp(1400, 1700, R(79.3, 80.6, t)); my = 860; mpose = 'walk'; meyes = 'open'; mst.mouth = 'smirk'; }
      else if (t < 81.6) { [mx, my] = jumpArc(80.6, 81.6, 1700, 1800, 860, 872, 170, t); mpose = t < 80.9 ? 'crouch' : 'stretch'; meyes = 'wide'; }
      else if (t < 85.4) { mx = 1800; my = 872; mflip = -1; mpose = 'sit'; meyes = t > 82.4 ? 'happy' : 'open'; mst.mouth = 'tongue'; }
      else if (t < 89.8) { const cb = boxPos(t); mx = cb[0]; my = cb[1] + 82; mflip = -1; mpose = 'sit'; meyes = 'happy'; mst.mouth = 'tongue'; }
      else if (t < 98.8) { mx = 1620; my = 872; mflip = -1; mpose = 'sit'; meyes = t > 94 ? 'happy' : 'half'; mst.mouth = 'smirk'; mst.eyesLook = 0; }
      else if (t < 103.0) { mx = 950; my = G; mflip = -1; mpose = t >= 101.6 ? 'crouch' : 'sit'; meyes = t >= 101.6 ? 'dilated' : 'half'; mst.wiggle = t >= 101.6 ? 1 : 0; mst.mouth = 'smirk'; }
      else {
        // zoomies [t0, t1, x0, x1, jump]
        const Z = [[103.0, 103.8, 950, 300, 0], [104.4, 105.3, 300, 900, 380], [106.2, 107.0, 900, 280, 0], [107.6, 108.6, 280, 1000, 0], [109.4, 110.4, 1000, 250, 0], [111.6, 112.7, 250, 1000, 400], [113.0, 113.9, 1000, 300, 0]];
        let zz = Z.find(z => t >= z[0] && t < z[1]);
        if (zz) { const p = R(zz[0], zz[1], t); mx = lerp(zz[2], zz[3], p); my = G; mflip = zz[3] > zz[2] ? 1 : -1; mpose = 'run'; meyes = 'dilated'; mst.mouth = 'open'; mst.tailAmp = 2;
          if (zz[4]) { const mid = (zz[2] + zz[3]) / 2, j = clamp(1 - Math.abs(mx - 560) / 170); my = G - zz[4] * Math.sin(j * Math.PI / 2) * (zz[0] === 104.4 ? 1 : 0) - (zz[0] === 111.6 ? zz[4] * Math.sin(p * Math.PI) : 0); }
          if (zz[0] === 109.4 && p > .9) { my = lerp(G, 696, R(110.2, 110.4, t)); } }
        else if (t >= 110.4 && t < 111.6) { mx = 250; my = 696; mflip = 1; mpose = 'crouch'; meyes = 'dilated'; mst.wiggle = 1; }
        else if (t >= 113.9 && t < 126.4) { mx = lerp(300, 330, R(113.9, 114.6, t)); my = G; mflip = 1; mpose = t < 114.6 ? 'crouch' : 'sit'; meyes = t < 116 ? 'dilated' : 'open'; mst.wiggle = t < 114.6 ? 1 : 0; mst.mouth = 'smirk'; mlook = .8; }
        else if (t >= 103.8 && t < 104.4 || t >= 105.3 && t < 106.2 || t >= 107.0 && t < 107.6 || t >= 108.6 && t < 109.4) { const prev = Z.filter(z => z[1] <= t).pop(); mx = prev ? prev[3] : 950; my = G; mflip = prev && prev[3] > prev[2] ? 1 : -1; mpose = 'crouch'; meyes = 'dilated'; mst.wiggle = 1; mst.mouth = 'open'; }
        else if (t >= 126.4 && t < 130.6) { mx = lerp(330, 470, R(126.4, 130.2, t)); my = G; mflip = 1; mpose = 'walk'; meyes = 'half'; }
        else if (t < 140.8) { mx = 470; my = G; mflip = 1; mpose = 'sit'; meyes = t > 132.5 && t < 135.4 ? (t < 133.4 ? 'half' : 'closed') : 'open'; mlook = 0; mst.mouth = 'w'; if (t >= 135.4 && t < 136.2) meyes = 'half'; }
        else if (t < 141.7) { [mx, my] = jumpArc(140.8, 141.7, 470, 440, G, G, 90, t); mpose = 'stretch'; meyes = 'happy'; }
        else { mx = 440; my = G; mflip = 1; mpose = 'sit'; meyes = 'happy'; mst.mouth = 'tongue'; mst.tilt = 8; }
      }
      const mh = mochi.draw(Object.assign({ x: mx, y: my, flip: mflip, pose: mpose, eyes: meyes, look: mlook, shadow: my > 840 && !(t > 80.6 && t < 98.8), acc: {} }, mst), t);
      // ---- box + bed ----
      function boxPos(tt) { return [bxF(tt) + 6, byF(tt) + 110]; }
      let boxX = 1800, boxY = 790;
      if (t >= 85.4 && t < 89.8) { [boxX, boxY] = boxPos(t); } else if (t >= 89.8) { boxX = 1620; boxY = 790; }
      boxBack.setAttribute('transform', `translate(${boxX - 1800},${boxY - 790})`);
      boxFront.setAttribute('transform', `translate(${boxX},${boxY})`);
      let bedX = 1500, bedY = 860;
      show(bedP, t >= 72.2); bedP.setAttribute('transform', `translate(${bedX},${bedY}) scale(${1 + .25 * (t >= 72.2 && t < 72.7 ? 1 - E.out(R(72.2, 72.7, t)) : 0)})`);
      // carried bed (69.4..72.2)
      let carry = null; if (t >= 69.4 && t < 72.2) carry = [bx, by + 70];
      if (carry) { bedP.setAttribute('transform', `translate(${carry[0]},${carry[1]}) scale(.9)`); show(bedP, true); }
      show(boxBack, true); show(boxFront, true);
      // BEEP sinking into bed: nothing extra (squash handled by `sit`)
      // ---- items ----
      const spec = [{ k: 'glass', spawn: 45.8, push: 49.8, land: 50.5, toss: 51.1, half: 38, slot: 0 }, { k: 'mug', spawn: 52.5, push: 54.6, land: 55.3, toss: 55.9, half: 38, slot: 1 }, { k: 'plant', spawn: 57.0, push: 59.0, land: 59.7, toss: 60.3, half: 45, slot: 2 }, { k: 'vase', spawn: 61.5, push: 63.0, land: 63.7, half: 50, floor: true }];
      const slotPos = (slot, hx, hy, r) => { let d = 0; for (let i = 0; i < slot; i++) d += stackIdx[i].h; d += stackIdx[slot].h / 2 + 4; return [hx + Math.sin(r) * d, hy - Math.cos(r) * d]; };
      items.forEach((it, i) => {
        const sp = spec[i], gg = it.g;
        if (t < sp.spawn) { show(gg, false); return; }
        show(gg, true);
        const edgeX = 1298, edgeY = 706 - sp.half;
        let x, y, r = 0;
        if (t < sp.spawn + .5) { const p = E.out(R(sp.spawn, sp.spawn + .5, t)); x = lerp(hwL[0], edgeX, p); y = lerp(hwL[1], edgeY, p) - Math.sin(p * Math.PI) * 30; }
        else if (t < sp.push) { x = edgeX; y = edgeY; r = K([[sp.push - .5, 0], [sp.push - .05, -6]], t) + Math.sin(t * 3) * 0; }
        else if (t < sp.land) { const p = E.in(R(sp.push, sp.land, t)); x = lerp(edgeX, sp.floor ? 1332 : 1344, p); y = lerp(edgeY, sp.floor ? 860 - sp.half : 765, p); r = lerp(-6, sp.floor ? 140 : 40, p); }
        else if (sp.floor) { x = 1332; y = 860 - sp.half; r = 140; show(gg, t < sp.land); }
        else if (t < sp.toss) { const p = E.io(R(sp.land, sp.toss, t)), sl = slotPos(sp.slot, headX, headY, pr); x = lerp(1344, sl[0], p); y = lerp(765, sl[1], p) - Math.sin(p * Math.PI) * 90; r = lerp(40, rot, p); }
        else if (t < 66.8 + sp.slot * .25) { const sl = slotPos(sp.slot, headX, headY, pr); x = sl[0]; y = sl[1]; r = rot; }
        else { const a = 66.8 + sp.slot * .25, b = a + .6, p = E.io(R(a, b, t)), sl = slotPos(sp.slot, headX, headY, pr), tx = 1140 + sp.slot * 62, ty = 706 - sp.half; x = lerp(sl[0], tx, p); y = lerp(sl[1], ty, p) - Math.sin(p * Math.PI) * 120; r = lerp(rot, 0, p); }
        gg.setAttribute('transform', TR(x, y, r, 1));
      });
      show(puddle, t >= 63.7);
      // stool plant knocked over by zoomies
      const pk = R(105.3, 106.0, t);
      plantStool._p.setAttribute('transform', pk > 0 ? `translate(${800 + 60 * E.out(pk)},${lerp(756, 830, E.in(pk))}) rotate(${95 * E.out(pk)}) scale(1.3)` : 'translate(800,756) scale(1.3)');
      // ice pack
      show(icepack, t >= 117 && t < 138.3); icepack.setAttribute('transform', TR(headX - 20, headY - 6, rot - 14, 1));
    },
  };
})();
