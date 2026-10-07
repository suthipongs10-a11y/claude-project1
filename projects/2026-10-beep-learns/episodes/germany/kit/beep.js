// LOCKED CHARACTER: BEEP — small hover robot, TV-box head with screen face, egg body, noodle arms, springy antenna.
// Never redesign. Origin = body centre. Head top = y-198, thruster bottom = y+114.
// Hovering: y = ground - 180 (+ bob). Grounded (sitting/sleeping): y = ground - 98.
// state: {x,y,sx,sy,rot, face, fp(0..1 progress for loading/battery/learning), label, look(-1..1), lookY, blink(0..1),
//         armL:[x,y], armR:[x,y] (hand pos rel. to origin; rest ≈ [-92,88]/[92,88]), antX (antenna tip offset), thrust(0..1),
//         sparks(bool), aura(0..1), talk(0..1 mouth open from lip-sync), acc:{headband,gloves,hat,scarf,backpack,camera}}
(function (root) {
  const MS = root.MS;
  MS.BEEP_COLORS = { body: '#FFFDF7', teal: '#2EC4B6', screen: '#1E2A3A', eye: '#7FF6FF', antenna: '#FF6B8B', heart: '#FF7AA2', yellow: '#FFE14D' };
  MS.makeBeep = function (parent, shadowParent) {
    const { S, at, show, T } = MS, C = MS.BEEP_COLORS, OL = MS.OL(6), id = MS.uid('bp');
    const svg = parent.ownerSVGElement || parent; let defs = svg.querySelector('defs') || S('defs', {}, svg);
    S('radialGradient', { id: id + 'glow' }, defs).innerHTML = `<stop offset="0" stop-color="${C.eye}" stop-opacity=".9"/><stop offset="1" stop-color="${C.eye}" stop-opacity="0"/>`;
    S('filter', { id: id + 'f', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs).innerHTML = '<feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>';
    S('clipPath', { id: id + 'c' }, defs).innerHTML = '<rect x="-90" y="-178" width="180" height="128" rx="30"/>';
    const B = {};
    B.shadow = S('ellipse', { cx: 0, cy: 0, rx: 80, ry: 14, fill: '#000', opacity: .18 }, shadowParent || parent);
    B.aura = S('ellipse', { cx: 0, cy: -40, rx: 200, ry: 230, fill: `url(#${id}glow)`, opacity: 0 }, parent);
    B.outer = S('g', {}, parent); B.root = S('g', {}, B.outer);
    const R = B.root;
    B.backpack = S('g', {}, R); S('rect', { x: -60, y: -20, width: 120, height: 110, rx: 26, fill: '#FFC145', ...OL }, B.backpack); S('rect', { x: -40, y: 20, width: 80, height: 40, rx: 12, fill: '#FFD86B', ...OL, 'stroke-width': 4 }, B.backpack);
    B.thr = S('ellipse', { cx: 0, cy: 112, rx: 34, ry: 18, fill: `url(#${id}glow)` }, R);
    B.armOut = [0, 1].map(() => S('path', { fill: 'none', stroke: MS.PL, 'stroke-width': 18, 'stroke-linecap': 'round' }, R));
    B.armIn = [0, 1].map(() => S('path', { fill: 'none', stroke: '#DDE3EE', 'stroke-width': 8, 'stroke-linecap': 'round' }, R));
    S('path', { d: 'M-22,96 L22,96 L14,114 L-14,114 Z', fill: '#BFC7D5', ...OL, 'stroke-width': 5 }, R);
    S('ellipse', { cx: 0, cy: 40, rx: 66, ry: 62, fill: C.body, ...OL }, R);
    S('path', { d: 'M-63,28 Q0,50 63,28 L62,46 Q0,68 -62,46 Z', fill: C.teal, stroke: MS.PL, 'stroke-width': 4 }, R);
    B.chest = S('circle', { cx: 0, cy: 78, r: 9, fill: C.eye, stroke: MS.PL, 'stroke-width': 3 }, R);
    B.scarf = S('g', {}, R); S('path', { d: 'M-46,-24 Q0,-6 46,-24 L48,-8 Q0,10 -48,-8 Z', fill: '#E63946', ...OL, 'stroke-width': 4 }, B.scarf); S('path', { d: 'M30,-10 L48,40 L26,36 Z', fill: '#E63946', ...OL, 'stroke-width': 4 }, B.scarf);
    S('rect', { x: -20, y: -40, width: 40, height: 22, fill: '#BFC7D5', ...OL, 'stroke-width': 5 }, R);
    B.ant = S('path', { fill: 'none', stroke: MS.PL, 'stroke-width': 7, 'stroke-linecap': 'round' }, R);
    B.antTip = S('circle', { r: 15, fill: C.antenna, ...OL, 'stroke-width': 5 }, R);
    B.tails = [S('path', { fill: 'none', stroke: MS.PL, 'stroke-width': 20, 'stroke-linecap': 'round' }, R), S('path', { fill: 'none', stroke: '#E63946', 'stroke-width': 11, 'stroke-linecap': 'round' }, R)];
    B.head = S('g', {}, R);
    S('rect', { x: -114, y: -198, width: 228, height: 166, rx: 46, fill: C.body, ...OL }, B.head);
    B.band = S('path', { d: 'M-104,-176 Q0,-196 104,-176 L110,-158 Q0,-178 -110,-158 Z', fill: '#E63946', stroke: MS.PL, 'stroke-width': 4 }, B.head);
    S('circle', { cx: -116, cy: -114, r: 15, fill: C.teal, ...OL, 'stroke-width': 5 }, B.head); S('circle', { cx: 116, cy: -114, r: 15, fill: C.teal, ...OL, 'stroke-width': 5 }, B.head);
    S('rect', { x: -90, y: -178, width: 180, height: 128, rx: 30, fill: C.screen, stroke: MS.PL, 'stroke-width': 5 }, B.head);
    const face = S('g', { 'clip-path': `url(#${id}c)` }, B.head), fin = S('g', { filter: `url(#${id}f)` }, face);
    S('path', { d: 'M-72,-160 Q-40,-172 -10,-170', stroke: '#fff', 'stroke-width': 6, opacity: .18, fill: 'none', 'stroke-linecap': 'round' }, B.head);
    // hats (choose via acc.hat)
    B.hats = {};
    B.hats.cap = S('g', {}, B.head); S('path', { d: 'M-90,-196 Q0,-262 90,-196 Z', fill: '#E63946', ...OL }, B.hats.cap); S('path', { d: 'M40,-200 L150,-196 Q150,-186 40,-188 Z', fill: '#C1121F', ...OL, 'stroke-width': 4 }, B.hats.cap);
    B.hats.straw = S('g', {}, B.head); S('ellipse', { cx: 0, cy: -196, rx: 160, ry: 26, fill: '#F2D27A', ...OL }, B.hats.straw); S('path', { d: 'M-70,-198 Q-60,-262 0,-262 Q60,-262 70,-198 Z', fill: '#F2D27A', ...OL }, B.hats.straw); S('rect', { x: -70, y: -216, width: 140, height: 14, fill: '#E63946' }, B.hats.straw);
    B.hats.beanie = S('g', {}, B.head); S('path', { d: 'M-100,-190 Q0,-290 100,-190 Z', fill: '#5AA9FF', ...OL }, B.hats.beanie); S('rect', { x: -104, y: -200, width: 208, height: 22, rx: 10, fill: '#3E7FD0', ...OL, 'stroke-width': 4 }, B.hats.beanie); S('circle', { cx: 0, cy: -262, r: 18, fill: '#fff', ...OL, 'stroke-width': 4 }, B.hats.beanie);
    B.hats.party = S('g', {}, B.head); S('path', { d: 'M-50,-196 L0,-320 L50,-196 Z', fill: '#FF7AA2', ...OL }, B.hats.party); S('circle', { cx: 0, cy: -322, r: 14, fill: '#FFE14D', ...OL, 'stroke-width': 4 }, B.hats.party);
    // faces
    const F = B.F = {}; const fc = n => (F[n] = S('g', {}, fin)); const E = C.eye;
    fc('neutral'); F.neutral.eyes = [-36, 36].map(x => S('rect', { x: x - 14, y: -134, width: 28, height: 44, rx: 13, fill: E }, F.neutral));
    F.neutral.mouth = S('ellipse', { cx: 0, cy: -76, rx: 12, ry: 0, fill: E }, F.neutral);
    fc('happy'); [-36, 36].forEach(x => S('path', { d: `M${x - 20},-100 Q${x},-138 ${x + 20},-100`, stroke: E, 'stroke-width': 10, fill: 'none', 'stroke-linecap': 'round' }, F.happy)); F.happy.mouth = S('path', { d: 'M-16,-78 Q0,-66 16,-78', stroke: E, 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round' }, F.happy);
    fc('wide'); [-38, 38].forEach(x => { S('circle', { cx: x, cy: -114, r: 26, fill: 'none', stroke: E, 'stroke-width': 8 }, F.wide); S('circle', { cx: x, cy: -114, r: 8, fill: E }, F.wide); });
    fc('angry'); [-36, 36].forEach((x, i) => S('path', { d: i ? `M${x - 22},-116 L${x + 22},-132 L${x + 20},-98 L${x - 20},-98 Z` : `M${x + 22},-116 L${x - 22},-132 L${x - 20},-98 L${x + 20},-98 Z`, fill: E }, F.angry));
    fc('suspicious'); [-36, 36].forEach((x, i) => S('rect', { x: x - 20, y: -114, width: 40, height: 14, rx: 7, fill: E, transform: `rotate(${i ? -8 : 8} ${x} -107)` }, F.suspicious));
    fc('annoyed'); [-36, 36].forEach(x => S('line', { x1: x - 20, y1: -110, x2: x + 20, y2: -110, stroke: E, 'stroke-width': 10, 'stroke-linecap': 'round' }, F.annoyed)); S('line', { x1: -14, y1: -78, x2: 14, y2: -78, stroke: E, 'stroke-width': 6, 'stroke-linecap': 'round' }, F.annoyed);
    fc('sad'); [-36, 36].forEach(x => S('path', { d: `M${x - 20},-104 Q${x},-90 ${x + 20},-104`, stroke: E, 'stroke-width': 9, fill: 'none', 'stroke-linecap': 'round' }, F.sad)); S('path', { d: 'M-16,-72 Q0,-84 16,-72', stroke: E, 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, F.sad); F.sad.tear = S('path', { d: 'M-50,-96 q-6,12 0,16 q6,-4 0,-16 Z', fill: E }, F.sad);
    const big = (n, s, size = 100, y = -78) => { fc(n); T(F[n], 0, y, s, size, E, { style: 'font-family:FR,sans-serif;font-weight:700' }); };
    big('exclaim', '!'); big('question', '?');
    fc('dots'); F.dots.c = [-34, 0, 34].map(x => S('circle', { cx: x, cy: -112, r: 10, fill: E }, F.dots));
    fc('loading'); S('rect', { x: -66, y: -124, width: 132, height: 24, rx: 12, fill: 'none', stroke: E, 'stroke-width': 5 }, F.loading); F.loading.bar = S('rect', { x: -60, y: -118, width: 0, height: 12, rx: 6, fill: E }, F.loading); F.loading.lab = T(F.loading, 0, -74, 'SCANNING', 20, E, { style: 'font-family:FR,sans-serif;font-weight:700', 'letter-spacing': 2 });
    fc('learning'); S('rect', { x: -66, y: -124, width: 132, height: 24, rx: 12, fill: 'none', stroke: C.yellow, 'stroke-width': 5 }, F.learning); F.learning.bar = S('rect', { x: -60, y: -118, width: 0, height: 12, rx: 6, fill: C.yellow }, F.learning); T(F.learning, 0, -74, 'LEARNING', 20, C.yellow, { style: 'font-family:FR,sans-serif;font-weight:700', 'letter-spacing': 2 }); F.learning.lab = T(F.learning, 0, -144, '', 18, C.yellow, { style: 'font-family:FR,sans-serif;font-weight:700' });
    fc('check'); S('path', { d: 'M-34,-112 L-8,-86 L40,-138', stroke: E, 'stroke-width': 14, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, F.check);
    fc('static'); F.static.ls = []; for (let i = 0; i < 14; i++) F.static.ls.push(S('rect', { x: -90, y: -178 + i * 9.2, width: 180, height: 5, fill: E }, F.static));
    fc('swirl'); [-36, 36].forEach(x => S('path', { d: `M${x},-114 a4,4 0 1,1 8,0 a10,10 0 1,1 -18,0 a16,16 0 1,1 30,0 a22,22 0 1,1 -42,0`, stroke: E, 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, F.swirl));
    fc('x'); [-38, 38].forEach(x => S('path', { d: `M${x - 18},-132 L${x + 18},-96 M${x + 18},-132 L${x - 18},-96`, stroke: E, 'stroke-width': 10, 'stroke-linecap': 'round' }, F.x));
    fc('heart'); ['01100110', '11111111', '11111111', '01111110', '00111100', '00011000'].forEach((row, r) => row.split('').forEach((c, i) => c === '1' && S('rect', { x: -48 + i * 12, y: -150 + r * 12, width: 11, height: 11, fill: C.heart }, F.heart)));
    fc('idea'); S('circle', { cx: 0, cy: -124, r: 30, fill: C.yellow }, F.idea); S('rect', { x: -14, y: -98, width: 28, height: 22, rx: 4, fill: E }, F.idea); [0, 1, 2, 3, 4].forEach(i => { const a = -Math.PI + i * Math.PI / 4; S('line', { x1: Math.cos(a) * 42, y1: -124 + Math.sin(a) * 42, x2: Math.cos(a) * 56, y2: -124 + Math.sin(a) * 56, stroke: C.yellow, 'stroke-width': 6, 'stroke-linecap': 'round' }, F.idea); });
    fc('battery'); S('rect', { x: -56, y: -136, width: 104, height: 50, rx: 10, fill: 'none', stroke: E, 'stroke-width': 6 }, F.battery); S('rect', { x: 50, y: -120, width: 10, height: 18, rx: 3, fill: E }, F.battery); F.battery.fill = S('rect', { x: -48, y: -128, width: 0, height: 34, rx: 5, fill: '#9BFF6A' }, F.battery); S('path', { d: 'M4,-134 L-12,-108 L2,-108 L-6,-88 L14,-116 L0,-116 Z', fill: C.yellow, stroke: C.screen, 'stroke-width': 3 }, F.battery);
    fc('sleep'); [-36, 36].forEach(x => S('path', { d: `M${x - 20},-114 Q${x},-92 ${x + 20},-114`, stroke: E, 'stroke-width': 9, fill: 'none', 'stroke-linecap': 'round' }, F.sleep)); F.sleep.z = T(F.sleep, 60, -140, 'z', 26, E, { style: 'font-family:FR,sans-serif;font-weight:700' });
    fc('wink'); S('path', { d: 'M-56,-100 Q-36,-138 -16,-100', stroke: E, 'stroke-width': 10, fill: 'none', 'stroke-linecap': 'round' }, F.wink); S('line', { x1: 16, y1: -110, x2: 56, y2: -110, stroke: E, 'stroke-width': 10, 'stroke-linecap': 'round' }, F.wink); S('path', { d: 'M-16,-80 Q4,-64 22,-84', stroke: E, 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round' }, F.wink);
    fc('stars'); [-36, 36].forEach(x => S('path', { d: `M${x},-136 L${x + 7},-120 L${x + 24},-118 L${x + 11},-106 L${x + 15},-90 L${x},-98 L${x - 15},-90 L${x - 11},-106 L${x - 24},-118 L${x - 7},-120 Z`, fill: C.yellow }, F.stars)); S('path', { d: 'M-18,-76 Q0,-60 18,-76 Z', fill: E }, F.stars);
    fc('text'); F.text.t = T(F.text, 0, -100, '', 40, E, { style: 'font-family:FR,sans-serif;font-weight:700' });
    // gloves / mitts
    B.mitts = [0, 1].map(() => S('circle', { r: 21, fill: C.body, ...OL, 'stroke-width': 5 }, R));
    B.gloves = [0, 1].map(() => { const g = S('g', {}, R); S('rect', { x: -18, y: 14, width: 36, height: 16, rx: 6, fill: C.body, ...OL, 'stroke-width': 4 }, g); S('circle', { r: 30, fill: '#FF4D6D', ...OL, 'stroke-width': 5 }, g); S('circle', { cx: -20, cy: 4, r: 12, fill: '#FF4D6D', ...OL, 'stroke-width': 4 }, g); return g; });
    B.camera = S('g', {}, R); S('rect', { x: -34, y: -22, width: 68, height: 44, rx: 8, fill: '#3D405B', ...OL, 'stroke-width': 4 }, B.camera); S('circle', { r: 14, fill: '#9FD8F5', ...OL, 'stroke-width': 4 }, B.camera);
    B.sparks = S('g', {}, R); for (let i = 0; i < 7; i++) S('path', { d: '', stroke: '#FFE14D', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }, B.sparks);
    let rs = 1; const rnd = () => ((rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296);

    B.draw = function (s, t, ground) {
      const acc = s.acc || {}, sx = s.sx ?? 1, sy = s.sy ?? 1, thrust = s.thrust ?? 1;
      B.outer.setAttribute('transform', `translate(${s.x},${s.y}) rotate(${s.rot || 0}) scale(${sx},${sy})`);
      const G = ground ?? (s.y + 180), hgt = G - (s.y + 112);
      at(B.shadow, { cx: s.x, cy: G + 4, rx: 80 * (1 - Math.min(.6, Math.max(0, hgt) / 600)) }); show(B.shadow, s.shadow !== false);
      B.thr.setAttribute('opacity', thrust * (.7 + .3 * Math.sin(t * 40)));
      const sway = i => Math.sin(t * 3 + i) * 4 * thrust;
      const arms = [s.armL || [-92, 88], s.armR || [92, 88]];
      arms.forEach((h, i) => { const hx = h[0], hy = h[1] + sway(i), x0 = i ? 50 : -50, y0 = 20, mx = (x0 + hx) / 2, my = (y0 + hy) / 2 + 24, d = `M${x0},${y0} Q${mx},${my} ${hx},${hy}`; B.armOut[i].setAttribute('d', d); B.armIn[i].setAttribute('d', d); at(B.mitts[i], { cx: hx, cy: hy }); B.gloves[i].setAttribute('transform', `translate(${hx},${hy}) scale(${i ? -1 : 1},1)`); show(B.mitts[i], !acc.gloves); show(B.gloves[i], !!acc.gloves); });
      show(B.camera, !!acc.camera); if (acc.camera) { const h = arms[1]; B.camera.setAttribute('transform', `translate(${h[0] - 10},${h[1] - 30})`); }
      const ax = s.antX || 0, tipy = -262 + Math.abs(ax) * .3; B.ant.setAttribute('d', `M0,-198 Q${ax * .2},-232 ${ax},${tipy}`); at(B.antTip, { cx: ax, cy: tipy });
      show(B.band, !!acc.headband); B.tails.forEach(p => show(p, !!acc.headband));
      if (acc.headband) { const w = Math.sin(t * 12) * 10, d = `M110,-172 Q150,${-170 + w} 180,${-150 - w} M110,-168 Q140,${-140 + w} 160,${-118 - w}`; B.tails.forEach(p => p.setAttribute('d', d)); }
      Object.keys(B.hats).forEach(k => show(B.hats[k], acc.hat === k)); show(B.scarf, !!acc.scarf); show(B.backpack, !!acc.backpack);
      const face = s.face || 'neutral'; Object.keys(F).forEach(k => show(F[k], k === face));
      const blink = s.blink ?? ((t % 3.7) < .14 ? Math.sin((t % 3.7) / .14 * Math.PI) : 0);
      if (face === 'neutral') { F.neutral.eyes.forEach((e, i) => e.setAttribute('transform', `translate(${(s.look || 0) * 14},${(s.lookY || 0) * 8}) translate(${i ? 36 : -36},-112) scale(1,${1 - .9 * blink}) translate(${i ? -36 : 36},112)`)); at(F.neutral.mouth, { ry: (s.talk || 0) * 12 }); }
      if (face === 'happy') F.happy.mouth.setAttribute('transform', `translate(0,${-78 * 0}) scale(1,${1 + (s.talk || 0) * 1.5})`);
      if (face === 'loading') { F.loading.bar.setAttribute('width', 120 * (s.fp || 0)); F.loading.lab.textContent = s.label || 'SCANNING'; }
      if (face === 'learning') { F.learning.bar.setAttribute('width', 120 * (s.fp || 0)); F.learning.lab.textContent = s.label || ''; }
      if (face === 'battery') { F.battery.fill.setAttribute('width', 92 * (s.fp || 0)); F.battery.fill.setAttribute('fill', (s.fp || 0) < .3 ? '#FF5A5A' : (s.fp || 0) < .6 ? C.yellow : '#9BFF6A'); }
      if (face === 'dots') F.dots.c.forEach((c, i) => c.setAttribute('opacity', (t * 3 - i * .33) % 1 < .6 ? 1 : .25));
      if (face === 'static') { rs = Math.floor(t * 30); F.static.ls.forEach(l => { l.setAttribute('x', -90 + rnd() * 60); l.setAttribute('width', 40 + rnd() * 140); l.setAttribute('opacity', rnd()); }); }
      if (face === 'sleep') F.sleep.z.setAttribute('transform', `translate(0,${-((t * 12) % 14)})`);
      if (face === 'text') F.text.t.textContent = s.label || '';
      F.heart.setAttribute('transform', `translate(0,-114) scale(${1 + .08 * Math.sin(t * 9)}) translate(0,114)`);
      B.chest.setAttribute('fill', face === 'heart' ? C.heart : C.eye);
      show(B.sparks, !!s.sparks); if (s.sparks) { rs = Math.floor(t * 30); [...B.sparks.children].forEach(p => { const a = rnd() * 6.28, r1 = 60 + rnd() * 40, r2 = r1 + 30 + rnd() * 40; p.setAttribute('d', `M${Math.cos(a) * r1},${-114 + Math.sin(a) * r1} L${Math.cos(a + .2) * (r1 + r2) / 2},${-114 + Math.sin(a + .3) * (r1 + r2) / 2} L${Math.cos(a) * r2},${-114 + Math.sin(a) * r2}`); }); }
      B.aura.setAttribute('opacity', (s.aura || 0) * (.7 + .3 * Math.sin(t * 10))); at(B.aura, { cx: s.x, cy: s.y - 40 });
      // world-space helpers for props
      return { hwL: [s.x + arms[0][0] * sx, s.y + arms[0][1] * sy], hwR: [s.x + arms[1][0] * sx, s.y + arms[1][1] * sy], headTop: [s.x, s.y - 198 * sy], screen: [s.x, s.y - 114 * sy] };
    };
    return B;
  };
  // helper: standard antenna wobble from impulse list + velocity
  MS.beepAntenna = (vx, t, impulses = []) => -MS.clamp(vx * .05, -60, 60) + Math.sin(t * 2.3) * 6 + MS.wobble(impulses.map(([a, k]) => [a, 55 * k]), t);
})(typeof window !== 'undefined' ? window : globalThis);
