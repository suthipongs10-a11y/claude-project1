// EPISODE: BEEP & MOCHI at the ZOO — Partners in Crime. One long zoo path (x 0..5300), ground G=860.
(function () {
  const { S, K, step, sq, clamp, lerp, E, at, show } = MS, G = 860, PL = MS.PL, OL = MS.OL(6), OL4 = MS.OL(4);
  const R = (a, b, t) => clamp((t - a) / (b - a));
  const TR = (x, y, r = 0, s = 1) => `translate(${x},${y}) rotate(${r}) scale(${s})`;
  const V = MS.VERTICAL;
  let beep, mochi, dana, sun, moon, nightRect, shadesB, shadesM, capP, star, slime, nest, bird, web, butterfly, rings = [], later, mk = [], giraffe, lion, sloth;

  // ---------------- timelines ----------------
  const bxF = t => K([[3.2, 200], [14.5, 640], [19.5, 1100], [34.0, 1100], [36.5, 1178, 'io'], [38.0, 1100, 'out'], [46, 1100], [52.5, 2310, 'io'], [60.0, 2310], [60.5, 2284, 'out'], [62, 2310], [78, 2310], [82.5, 3240, 'io'], [84.5, 3240], [86.0, 3090, 'out'], [92, 3100], [97.5, 3330, 'io'], [108, 3330], [112.5, 4440, 'io'], [114, 4540, 'io'], [136.5, 4540], [141, 4560], [145, 4900, 'io']], t);
  const byF = t => G - 180 + Math.sin(t * 3.2) * 7 + K([[0, -900], [3.2, 0]], t) + K([[112.5, 0], [113.6, -40, 'io'], [133, -40], [134, 0, 'io']], t) + K([[84.5, 0], [85.5, -30, 'out'], [87, 0, 'in']], t);
  const mxF = t => K([[3.2, 110], [14.5, 470], [19.5, 1010, 'io'], [46, 1010], [52, 2210, 'io'], [78, 2230], [82.5, 3170, 'io'], [88.5, 3170], [91.5, 3520, 'io'], [108, 3520], [112.5, 4360, 'io'], [114, 4440, 'io'], [136.5, 4440], [141, 4480], [145, 4800, 'io']], t);

  // ---------------- builders ----------------
  function shades(parent, w = 1) {
    const g = S('g', {}, parent);
    [-1, 1].forEach(s => S('rect', { x: s * 42 - 40, y: -30, width: 80, height: 56, rx: 18, fill: '#1A1A24', ...OL4 }, g));
    S('line', { x1: -6, y1: -6, x2: 6, y2: -6, ...OL4 }, g); S('path', { d: 'M-66,-14 L-80,-16 M66,-14 L80,-16', ...OL4 }, g);
    [-1, 1].forEach(s => S('path', { d: `M${s * 42 - 24},-18 L${s * 42 - 8},-18`, stroke: '#fff', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: .8 }, g));
    return g;
  }
  function meerkatBuilder(parent) {
    const g = S('g', {}, parent), tail = S('path', { d: 'M-10,-20 Q-70,-18 -76,-70', fill: 'none', ...MS.OL(14) }, g), tailI = S('path', { d: 'M-10,-20 Q-70,-18 -76,-70', fill: 'none', stroke: '#D9B38C', 'stroke-width': 7, 'stroke-linecap': 'round' }, g);
    const body = S('g', {}, g);
    S('ellipse', { cx: 0, cy: -60, rx: 28, ry: 54, fill: '#D9B38C', ...OL4 }, body); S('ellipse', { cx: 6, cy: -52, rx: 17, ry: 38, fill: '#F1DDBF' }, body);
    S('ellipse', { cx: -10, cy: -6, rx: 14, ry: 8, fill: '#C79A6A', ...OL4 }, g); S('ellipse', { cx: 14, cy: -6, rx: 14, ry: 8, fill: '#C79A6A', ...OL4 }, g);
    const head = S('g', { }, g);
    S('circle', { cx: 0, cy: -124, r: 26, fill: '#D9B38C', ...OL4 }, head); S('circle', { cx: -22, cy: -140, r: 9, fill: '#5A4630', ...OL4 }, head); S('circle', { cx: 22, cy: -140, r: 9, fill: '#5A4630', ...OL4 }, head);
    [-11, 11].forEach(x => S('ellipse', { cx: x, cy: -126, rx: 9, ry: 12, fill: '#5A4630' }, head));
    const eyes = [-11, 11].map(x => S('circle', { cx: x, cy: -127, r: 4.5, fill: '#fff' }, head)), pup = [-11, 11].map(x => S('circle', { cx: x, cy: -127, r: 2.4, fill: PL }, head));
    S('ellipse', { cx: 0, cy: -112, rx: 6, ry: 4, fill: '#3A2A20' }, head);
    const arms = [S('ellipse', { cx: -16, cy: -86, rx: 7, ry: 16, fill: '#C79A6A', ...MS.OL(3) }, g), S('ellipse', { cx: 16, cy: -86, rx: 7, ry: 16, fill: '#C79A6A', ...MS.OL(3) }, g)];
    return {
      g, draw(s, t) {
        g.setAttribute('transform', `translate(${s.x},${s.y}) scale(${(s.flip ?? 1) * (s.s ?? 1)},${s.s ?? 1})`);
        head.setAttribute('transform', `translate(0,${-(s.dy || 0)}) rotate(${(s.nod || 0) * 12 + Math.sin(t * 2 + (s.ph || 0)) * (s.idle ?? 1)} 0 -110)`);
        pup.forEach((p, i) => at(p, { cx: (i ? 11 : -11) + (s.look || 0) * 3, cy: -127 + (s.lookY || 0) * 2 }));
        eyes.forEach(e => at(e, { r: s.eyes === 'wide' ? 6 : s.eyes === 'closed' ? .5 : 4.5 }));
        const sal = s.salute || 0; at(arms[1], { cx: lerp(16, 20, sal), cy: lerp(-86, -146, sal) });
        tail.setAttribute('transform', `rotate(${Math.sin(t * 2) * 4} -10 -20)`); tailI.setAttribute('transform', `rotate(${Math.sin(t * 2) * 4} -10 -20)`);
        body.setAttribute('transform', `translate(0,${-(s.dy || 0)})`);
      }
    };
  }
  function lionBuilder(parent) {
    const g = S('g', {}, parent);
    const tail = S('path', { fill: 'none', ...MS.OL(18) }, g), tailI = S('path', { fill: 'none', stroke: '#E8A64A', 'stroke-width': 10, 'stroke-linecap': 'round' }, g), tuft = S('circle', { r: 16, fill: '#B5651D', ...MS.OL(4) }, g);
    S('ellipse', { cx: 40, cy: -96, rx: 100, ry: 96, fill: '#E8A64A', ...OL }, g); S('ellipse', { cx: -48, cy: -14, rx: 34, ry: 15, fill: '#F0B85A', ...OL4 }, g); S('ellipse', { cx: 6, cy: -12, rx: 34, ry: 15, fill: '#F0B85A', ...OL4 }, g); S('ellipse', { cx: 120, cy: -14, rx: 36, ry: 15, fill: '#F0B85A', ...OL4 }, g);
    const head = S('g', {}, g);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; S('circle', { cx: Math.cos(a) * 78, cy: Math.sin(a) * 78 - 190, r: 38, fill: i % 2 ? '#B5651D' : '#9A5416', ...OL4 }, head); }
    S('circle', { cx: 0, cy: -190, r: 74, fill: '#B5651D', ...OL4 }, head);
    S('circle', { cx: 0, cy: -190, r: 58, fill: '#F0B85A', ...OL4 }, head); [-1, 1].forEach(s => S('circle', { cx: s * 46, cy: -246, r: 16, fill: '#F0B85A', ...OL4 }, head));
    S('ellipse', { cx: 0, cy: -170, rx: 32, ry: 24, fill: '#F7DFAE', ...OL4 }, head); S('path', { d: 'M-10,-186 L10,-186 L0,-174 Z', fill: '#C45B5B', ...MS.OL(3) }, head);
    const eyeL = [-24, 24].map(x => ({ w: S('ellipse', { cx: x, cy: -206, rx: 11, ry: 12, fill: '#fff', ...MS.OL(3) }, head), p: S('circle', { cx: x, cy: -204, r: 5, fill: PL }, head), lid: S('rect', { x: x - 12, y: -219, width: 24, height: 12, fill: '#F0B85A', ...MS.OL(3) }, head) }));
    const mouth = S('path', { d: 'M-18,-158 Q0,-148 18,-158', fill: 'none', ...MS.OL(4) }, head), jaw = S('g', {}, head); S('path', { d: 'M-32,-160 Q0,-110 32,-160 Z', fill: '#7A2E4A', ...MS.OL(4) }, jaw); S('path', { d: 'M-22,-158 l5,12 l5,-12 M12,-158 l5,12 l5,-12', fill: '#fff', ...MS.OL(2) }, jaw);
    return {
      g, mouthXY: s => [s.x - 0 * 0, s.y - 160 * (s.s || 1)],
      draw(s, t) {
        const sc = s.s ?? 1, jr = s.roar || 0, shake = jr > .1 ? Math.sin(t * 60) * 3 : 0;
        g.setAttribute('transform', `translate(${s.x + shake},${s.y}) scale(${-sc * (s.flip ?? 1)},${sc})`);
        head.setAttribute('transform', `translate(${-(s.nuz || 0) * 30},${(s.bow || 0) * 50 - jr * 12}) rotate(${(s.bow || 0) * 14 - jr * 6} 0 -190) scale(${1 + jr * .08})`);
        show(jaw, jr > .1); jaw.setAttribute('transform', `scale(${1 + jr * .2},${.4 + jr * 1.1}) translate(0,${-(-160) * 0})`); show(mouth, jr <= .1);
        const e = s.eyes || 'half', lid = e === 'closed' ? 1 : e === 'half' ? .55 : e === 'wide' ? 0 : .12;
        eyeL.forEach(q => { at(q.lid, { height: 24 * lid, y: -219 }); at(q.w, { ry: e === 'wide' ? 15 : 12 }); at(q.p, { cx: Number(q.w.getAttribute('cx')) + (s.look || 0) * 4, r: e === 'wide' ? 3 : 5 }); });
        const tw = Math.sin(t * 2) * 6; const d = `M130,-60 Q190,-60 ${180 + tw},-150`; tail.setAttribute('d', d); tailI.setAttribute('d', d); at(tuft, { cx: 180 + tw, cy: -158 });
      }
    };
  }
  function slothBuilder(parent) {
    const g = S('g', {}, parent), arm2 = { o: S('path', { fill: 'none', ...MS.OL(30) }, g), i: S('path', { fill: 'none', stroke: '#A08462', 'stroke-width': 20, 'stroke-linecap': 'round' }, g) }, arm1 = { o: S('path', { d: 'M18,120 Q40,60 36,2', fill: 'none', ...MS.OL(30) }, g), i: S('path', { d: 'M18,120 Q40,60 36,2', fill: 'none', stroke: '#A08462', 'stroke-width': 20, 'stroke-linecap': 'round' }, g) };
    S('ellipse', { cx: 6, cy: 190, rx: 46, ry: 74, fill: '#A08462', ...OL }, g); S('ellipse', { cx: 6, cy: 196, rx: 30, ry: 50, fill: '#BFA27C' }, g);
    S('path', { d: 'M-8,250 Q-10,290 -22,300 M22,250 Q26,290 38,300', fill: 'none', ...MS.OL(18) }, g);
    S('path', { d: 'M-8,250 Q-10,290 -22,300 M22,250 Q26,290 38,300', fill: 'none', stroke: '#A08462', 'stroke-width': 8, 'stroke-linecap': 'round' }, g);
    const head = S('g', {}, g);
    S('circle', { cx: 0, cy: 100, r: 44, fill: '#A08462', ...OL }, head); S('ellipse', { cx: 0, cy: 106, rx: 34, ry: 30, fill: '#E8D8B8', ...MS.OL(3) }, head);
    [-1, 1].forEach(s => S('path', { d: `M${s * 6},98 Q${s * 22},82 ${s * 32},108 Q${s * 22},120 ${s * 6},98 Z`, fill: '#5A4632' }, head));
    const eyes = [-1, 1].map(s => S('circle', { cx: s * 18, cy: 102, r: 4.5, fill: '#fff' }, head)), pup = [-1, 1].map(s => S('circle', { cx: s * 18, cy: 102, r: 2.6, fill: PL }, head)), lids = [-1, 1].map(s => S('rect', { x: s * 18 - 7, y: 96, width: 14, height: 6, fill: '#5A4632' }, head));
    S('ellipse', { cx: 0, cy: 116, rx: 7, ry: 5, fill: '#3A2A20' }, head); const smile = S('path', { d: 'M-12,126 Q0,134 12,126', fill: 'none', stroke: PL, 'stroke-width': 4, 'stroke-linecap': 'round' }, head);
    const claws = S('path', { fill: 'none', stroke: '#5A4632', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
    return {
      g, draw(s, t) {
        g.setAttribute('transform', `translate(${s.x},${s.y}) rotate(${Math.sin(t * .8) * 1.5} 36 0)`);
        const rp = s.reach || 0, h = [lerp(-8, s.hx ?? -90, rp), lerp(120, s.hy ?? 130, rp)], d = `M-18,118 Q${(h[0] - 18) / 2 - 20},${(h[1] + 118) / 2 + 10} ${h[0]},${h[1]}`;
        arm2.o.setAttribute('d', d); arm2.i.setAttribute('d', d); claws.setAttribute('d', `M${h[0] - 8},${h[1] - 6} l-10,-12 M${h[0] - 2},${h[1] - 8} l-4,-14 M${h[0] + 5},${h[1] - 6} l4,-12`);
        const open = s.eyes === 'open'; lids.forEach(l => at(l, { height: open ? 2 : 6 })); eyes.forEach(e => at(e, { r: open ? 6 : 4.5 }));
        pup.forEach((p, i) => at(p, { cx: (i ? 18 : -18) + (s.look || 0) * 2 }));
        smile.setAttribute('d', s.grin ? 'M-16,124 Q0,142 16,124' : 'M-12,126 Q0,134 12,126');
        head.setAttribute('transform', `rotate(${Math.sin(t * .5) * 2} 0 100)`);
      }, hand: s => { const rp = s.reach || 0; return [s.x + lerp(-8, s.hx ?? -90, rp), s.y + lerp(120, s.hy ?? 130, rp)]; }
    };
  }
  function giraffeBuilder(parent, front, BX, BY) {
    const g = S('g', {}, parent), B = [BX, BY];
    S('ellipse', { cx: BX + 160, cy: BY + 70, rx: 170, ry: 96, fill: '#F2C14E', ...OL }, g);
    [60, 120, 210, 270].forEach(x => S('rect', { x: BX + x - 14, y: BY + 100, width: 28, height: 160, rx: 12, fill: '#F2C14E', ...OL4 }, g));
    [[40, 20], [110, 60], [190, 40], [250, 90], [150, 100], [80, 100]].forEach(([x, y]) => S('circle', { cx: BX + x + 40, cy: BY + y + 20, r: 18, fill: '#C98524' }, g));
    S('path', { d: `M${BX + 320},${BY + 50} Q${BX + 370},${BY + 70} ${BX + 350},${BY + 150}`, fill: 'none', ...MS.OL(12) }, g);
    const f = S('g', {}, front);
    const neckO = S('path', { fill: 'none', stroke: PL, 'stroke-width': 78, 'stroke-linecap': 'round' }, f), neckI = S('path', { fill: 'none', stroke: '#F2C14E', 'stroke-width': 66, 'stroke-linecap': 'round' }, f);
    const spots = [0, 1, 2, 3, 4, 5].map(() => S('circle', { r: 11, fill: '#C98524' }, f));
    const tongue = S('path', { fill: 'none', stroke: PL, 'stroke-width': 26, 'stroke-linecap': 'round' }, f), tongueI = S('path', { fill: 'none', stroke: '#4A5FD0', 'stroke-width': 16, 'stroke-linecap': 'round' }, f);
    const head = S('g', {}, f);
    S('path', { d: 'M20,-26 L24,-62 M2,-28 L-2,-62', stroke: PL, 'stroke-width': 7, 'stroke-linecap': 'round' }, head); S('circle', { cx: 24, cy: -64, r: 8, fill: '#6B4423', ...MS.OL(3) }, head); S('circle', { cx: -2, cy: -64, r: 8, fill: '#6B4423', ...MS.OL(3) }, head);
    S('ellipse', { cx: 12, cy: -8, rx: 20, ry: 14, fill: '#F2C14E', ...MS.OL(4), transform: 'rotate(-40 12 -8)' }, head);
    S('ellipse', { cx: 0, cy: 0, rx: 50, ry: 32, fill: '#F2C14E', ...OL4 }, head); S('ellipse', { cx: -42, cy: 10, rx: 22, ry: 20, fill: '#F7DFAE', ...OL4 }, head);
    S('circle', { cx: 6, cy: -8, r: 9, fill: '#fff', ...MS.OL(3) }, head); const pupil = S('circle', { cx: 4, cy: -7, r: 4.5, fill: PL }, head);
    S('circle', { cx: -50, cy: 4, r: 3, fill: '#6B4423' }, head);
    const mouth = S('path', { d: 'M-60,20 Q-44,28 -26,22', fill: 'none', stroke: PL, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, head);
    const bez = (a, c, b, p) => [(1 - p) * (1 - p) * a[0] + 2 * (1 - p) * p * c[0] + p * p * b[0], (1 - p) * (1 - p) * a[1] + 2 * (1 - p) * p * c[1] + p * p * b[1]];
    return {
      g, base: B,
      draw(s, t) {
        const H = [s.hx, s.hy], C = [lerp(B[0], H[0], .1) + 30 + (s.bend || 0), Math.min(B[1], H[1]) - 20 + (H[1] > 500 ? 80 : 0)];
        const d = `M${B[0]},${B[1]} Q${C[0]},${C[1]} ${H[0]},${H[1]}`; neckO.setAttribute('d', d); neckI.setAttribute('d', d);
        spots.forEach((sp, i) => { const p = bez(B, C, H, .15 + i * .15); at(sp, { cx: p[0], cy: p[1] }); });
        head.setAttribute('transform', `translate(${H[0]},${H[1]}) rotate(${s.rot || 0})`);
        pupil.setAttribute('cx', 4 + (s.look || 0) * 3);
        const rr = (s.rot || 0) * Math.PI / 180, loc = (x, y) => [H[0] + Math.cos(rr) * x - Math.sin(rr) * y, H[1] + Math.sin(rr) * x + Math.cos(rr) * y];
        const m0 = loc(-52, 16), tl = s.tongue || 0; show(tongue, tl > .02); show(tongueI, tl > .02); show(mouth, tl <= .02);
        let tip = m0;
        if (tl > .02) { const L2 = tl * 170, lift = s.lift || 0; tip = [m0[0] - L2 * Math.cos(rr) * .96, m0[1] - L2 * Math.sin(rr) * .3 - lift * 100 + 30 * (1 - lift)]; const c = [(m0[0] + tip[0]) / 2, (m0[1] + tip[1]) / 2 + 40 * (1 - lift)]; const dd = `M${m0[0]},${m0[1]} Q${c[0]},${c[1]} ${tip[0]},${tip[1]}`; tongue.setAttribute('d', dd); tongueI.setAttribute('d', dd); }
        return { mouth: m0, tip, head: H };
      }
    };
  }
  function nestBird(parent) {
    const g = S('g', {}, parent);
    S('ellipse', { cx: 0, cy: 0, rx: 56, ry: 16, fill: '#8C5A2B', ...OL4 }, g); [-30, -10, 14, 32].forEach((x, i) => S('line', { x1: x, y1: -8, x2: x + 12, y2: 6, stroke: '#6B4423', 'stroke-width': 4 }, g));
    const b = S('g', {}, parent); S('ellipse', { cx: 0, cy: -16, rx: 22, ry: 18, fill: '#5AA9FF', ...OL4 }, b); S('circle', { cx: -12, cy: -34, r: 12, fill: '#5AA9FF', ...OL4 }, b); S('path', { d: 'M-22,-34 L-34,-30 L-22,-27 Z', fill: '#FFC145', ...MS.OL(3) }, b); S('circle', { cx: -14, cy: -36, r: 2.5, fill: PL }, b);
    return { nest: g, bird: b };
  }

  window.EP = {
    build(L) {
      // ---- sky, hills, ground ----
      S('rect', { x: -1500, y: -1600, width: 9000, height: 2400, fill: '#BFE6F5' }, L.sky);
      [[300, 140, 1], [1700, 80, 1.3], [3000, 170, 1], [4300, 100, 1.2], [5200, 150, 1]].forEach(([x, y, s]) => { const c = S('g', { transform: `translate(${x},${y}) scale(${s})` }, L.sky); [[0, 0, 50], [50, -18, 62], [112, 0, 48]].forEach(([dx, dy, r]) => S('circle', { cx: dx, cy: dy, r, fill: '#fff', opacity: .9 }, c)); });
      S('path', { d: 'M-300,720 Q300,520 900,700 Q1500,500 2200,700 Q2900,520 3600,700 Q4300,500 5000,700 Q5500,580 5800,720 Z', fill: '#8FD18A', ...OL }, L.sky);
      sun = S('g', {}, L.sky); S('circle', { r: 60, fill: '#FFE38A' }, sun); moon = S('g', {}, L.sky); S('circle', { r: 46, fill: '#FFF7C2' }, moon); S('circle', { cx: 14, cy: -8, r: 40, fill: '#BFE6F5' }, moon); at(moon.lastChild, { fill: '#2B3A6B' });
      S('rect', { x: -1500, y: 700, width: 9000, height: 1500, fill: '#8FD18A' }, L.set);
      S('rect', { x: -1500, y: 770, width: 9000, height: 1400, fill: '#E9D9C0' }, L.set);
      for (let x = -1500; x < 6500; x += 120) S('rect', { x, y: 780 + (x / 120 % 2) * 14, width: 100, height: 40, rx: 10, fill: '#DDCAAD' }, L.set);
      S('rect', { x: -1500, y: 760, width: 9000, height: 16, fill: '#6FBF74' }, L.set);
      const sign = (x, txt, col) => { S('rect', { x: x - 8, y: 560, width: 16, height: 220, fill: '#7A4A2A', ...OL4 }, L.set); S('rect', { x: x - 110, y: 520, width: 220, height: 70, rx: 12, fill: col, ...OL }, L.set); MS.T(L.set, x, 568, txt, txt.length > 8 ? 34 : 44, '#FFFDF7', { stroke: PL, 'stroke-width': 6, style: 'font-family:FR,sans-serif;font-weight:700' }); };
      // ---- gate ----
      [330, 790].forEach(x => { S('rect', { x: x - 40, y: 300, width: 80, height: 560, rx: 10, fill: '#B98A50', ...OL }, L.set); S('rect', { x: x - 54, y: 280, width: 108, height: 40, rx: 8, fill: '#8C5A2B', ...OL4 }, L.set); });
      S('rect', { x: 280, y: 250, width: 560, height: 120, rx: 24, fill: '#2E8B57', ...OL }, L.set); MS.T(L.set, 560, 342, 'ZOO', 96, '#FFE14D', { stroke: PL, 'stroke-width': 12, style: 'font-family:FR,sans-serif;font-weight:700' });
      [[250, 410, '#FF7AA2'], [220, 430, '#5AA9FF'], [870, 410, '#FFE14D'], [900, 440, '#7FF6FF']].forEach(([x, y, c]) => { S('line', { x1: x, y1: y + 40, x2: x, y2: 800, stroke: PL, 'stroke-width': 3 }, L.set); S('ellipse', { cx: x, cy: y, rx: 28, ry: 36, fill: c, ...OL4 }, L.set); });
      // ---- meerkat exhibit ----
      sign(930, 'MEERKATS', '#C98524');
      S('ellipse', { cx: 1400, cy: 860, rx: 320, ry: 120, fill: '#E8C78A', ...OL }, L.set);
      [[1250, 770, 70, 36], [1530, 780, 66, 34], [1390, 665, 80, 60]].forEach(([x, y, rx, ry]) => S('ellipse', { cx: x, cy: y + ry * .6, rx, ry, fill: '#A9A6B0', ...OL }, L.set));
      for (let i = 0; i < 4; i++) S('rect', { x: 1030 + i * 24, y: 800, width: 10, height: 60, fill: '#8C5A2B', ...OL4 }, L.front);
      // ---- giraffe zone ----
      sign(2060, 'GIRAFFES', '#E39B3C');
      S('rect', { x: 2150, y: 480, width: 60, height: 380, rx: 12, fill: '#7A4A2A', ...OL }, L.set); [[2180, 420, 120], [2110, 480, 90], [2250, 470, 90]].forEach(([x, y, r]) => S('circle', { cx: x, cy: y, r, fill: '#5DB561', ...OL4 }, L.set));
      giraffe = giraffeBuilder(L.set, L.front, 2680, 650);
      for (let i = 0; i < 9; i++) S('rect', { x: 2440 + i * 70, y: 680, width: 16, height: 180, fill: '#B98A50', ...OL4 }, L.front); S('rect', { x: 2430, y: 700, width: 640, height: 14, fill: '#B98A50', ...OL4 }, L.front); S('rect', { x: 2430, y: 770, width: 640, height: 14, fill: '#B98A50', ...OL4 }, L.front);
      // ---- lion zone ----
      sign(3260, 'LIONS', '#D1603D');
      S('path', { d: 'M3600,860 L3640,600 L3820,520 L4000,640 L4040,860 Z', fill: '#9A8E86', ...OL }, L.set); S('path', { d: 'M3700,860 L3730,720 L3880,680 L3960,860 Z', fill: '#7D736C', ...OL4 }, L.set);
      [[3450, 850], [3980, 850]].forEach(([x, y]) => [0, 1, 2].forEach(i => S('path', { d: `M${x + i * 12 - 12},${y} q4,-50 12,-60 q4,30 6,60`, fill: '#6FBF74', ...OL4 }, L.set)));
      lion = lionBuilder(L.mid);
      // ---- sloth zone ----
      sign(4300, 'SLOTHS', '#3E8E7E');
      S('rect', { x: 4800, y: 380, width: 70, height: 500, rx: 14, fill: '#7A4A2A', ...OL }, L.set);
      [[4830, 330, 130], [4720, 380, 100], [4950, 400, 100], [4620, 460, 70]].forEach(([x, y, r]) => S('circle', { cx: x, cy: y, r, fill: '#4FA95A', ...OL4 }, L.set));
      S('rect', { x: 4560, y: 450, width: 330, height: 26, rx: 12, fill: '#8C5A2B', ...OL }, L.set);
      sloth = slothBuilder(L.mid);
      // ---- characters ----
      beep = MS.makeBeep(L.mid, L.back); mochi = MS.makeCat(L.mid, L.back);
      dana = MS.makePerson(L.mid, { skin: '#F6CFAE', hair: 'pony', hairColor: '#5A3A22', top: '#2E8B57', bottom: '#3D405B', acc: { hat: 'cap', hatColor: '#2E8B57' } }, L.back);
      [[1250, 770], [1390, 665], [1530, 780]].forEach(() => mk.push(meerkatBuilder(L.mid)));
      // props
      shadesB = shades(L.mid); shadesM = shades(L.mid);
      capP = S('g', {}, L.mid); S('path', { d: 'M-90,0 Q0,-66 90,0 Z', fill: '#E63946', ...OL }, capP); S('path', { d: 'M40,-4 L150,0 Q150,10 40,8 Z', fill: '#C1121F', ...OL4 }, capP);
      star = S('g', {}, L.mid); S('path', { d: 'M0,-22 L6,-7 L22,-6 L10,4 L14,20 L0,11 L-14,20 L-10,4 L-22,-6 L-6,-7 Z', fill: '#FFD23F', ...MS.OL(3) }, star);
      slime = S('g', {}, L.mid); S('ellipse', { cx: 0, cy: 0, rx: 84, ry: 56, fill: '#BFE9FF', opacity: .45 }, slime); [[-50, 56], [10, 64], [58, 54]].forEach(([x, y]) => S('path', { d: `M${x},${y - 12} q10,16 0,26 q-10,-10 0,-26 Z`, fill: '#BFE9FF', opacity: .7 }, slime));
      butterfly = S('g', {}, L.mid); butterfly._w = [S('ellipse', { cx: -12, cy: -8, rx: 16, ry: 10, fill: '#FF9EB5', ...MS.OL(3) }, butterfly), S('ellipse', { cx: 12, cy: -8, rx: 16, ry: 10, fill: '#FF9EB5', ...MS.OL(3) }, butterfly)]; S('ellipse', { cx: 0, cy: 0, rx: 3, ry: 10, fill: PL }, butterfly);
      const nb = nestBird(L.mid); nest = nb.nest; bird = nb.bird;
      web = S('path', { fill: 'none', stroke: '#fff', 'stroke-width': 3, opacity: .85 }, L.mid);
      // roar rings + night + later text
      for (let i = 0; i < 4; i++) rings.push(S('circle', { fill: 'none', stroke: '#fff', 'stroke-width': 10, opacity: 0 }, L.fxl));
      nightRect = S('rect', { x: -1500, y: -1600, width: 9000, height: 3200, fill: '#0B1030', opacity: 0, 'pointer-events': 'none' }, L.fxl);
      later = MS.T(L.ui, MS.W / 2, MS.H * .3, '2 DAYS LATER...', 76, '#FFFDF7', { stroke: PL, 'stroke-width': 14, style: 'font-family:FR,sans-serif;font-weight:700' });
      // fx cues
      L.fx.puff(14.6, 640, 640, 8); L.fx.sparkle(11.8, 590, 600); L.fx.sparkle(12.5, 500, 700);
      L.fx.bang(35.6, '?', t => [bxF(t) + 50, 430], .8, '#2EC4B6'); L.fx.bang(38.2, '!', t => [bxF(t), 430], .8, '#E63946');
      L.fx.sparkle(43.9, 1120, 700);
      L.fx.bang(58.4, '!', t => [bxF(t), 420], .9, '#E63946'); L.fx.puff(57.9, 2290, 640, 8);
      L.fx.dizzy(61.4, 62.6, t => [bxF(t), 460]);
      L.fx.bang(84.2, '!', t => [3170, 560], .8, '#E63946'); L.fx.dizzy(86.8, 88.6, t => [bxF(t), 470]);
      L.fx.sparkle(96.6, 3560, 700); L.fx.sparkle(99.6, 3540, 700);
      L.fx.zzzOn(119.4, 125.4, t => [4440, 720]);
      L.fx.sparkle(130.0, 4630, 580); L.fx.sparkle(130.3, 4560, 520);
      L.fx.sparkle(136.0, 4490, 640); L.fx.sparkle(136.3, 4520, 560);
      L.fx.confettiAt(130.3, 4300, 4800, 100);
    },
    camera(t) {
      const keys = V ? [
        [3.2, [420, 620, 1.55]], [14.5, [640, 620, 1.5]], [18, [950, 640, 1.4]], [21, [1250, 640, 1.22]], [44, [1250, 640, 1.22]], [47, [1500, 640, 1.3]], [52.5, [2300, 590, 1.3]], [55, [2400, 540, 1.25]], [60, [2400, 550, 1.3]], [70, [2400, 570, 1.3]], [78, [2600, 600, 1.3]],
        [83, [3300, 620, 1.25]], [84.0, [3380, 610, 1.2]], [88, [3350, 610, 1.2]], [91.5, [3400, 610, 1.25]], [96, [3450, 620, 1.3]], [100, [3450, 620, 1.25]], [108, [3480, 620, 1.25]], [112.5, [4300, 620, 1.35]], [115, [4560, 590, 1.4]], [131, [4560, 590, 1.45]], [136, [4500, 620, 1.7]], [141, [4650, 620, 1.5]], [145, [4800, 620, 1.5]],
      ] : [[3.2, [600, 560, 1.0]], [60, [2400, 560, 1.1]], [100, [3400, 560, 1.1]], [140, [4600, 560, 1.1]]];
      const v = K(keys, t); return { x: v[0], y: v[1], z: v[2] };
    },
    iris(t) { if (t < 142 || t >= 146) return null; const r = K([[142, 1500], [145.2, 170, 'io'], [146, 0, 'in']], t), c = this.camera(t); return { r, x: (bxF(t) - c.x) * c.z + MS.W / 2, y: (byF(t) - c.y) * c.z + MS.H / 2 }; },
    update(t, L) {
      const bx = bxF(t), by = byF(t), vx = (bxF(t + .03) - bxF(t - .03)) / .06;
      // night / time-lapse
      nightRect.setAttribute('opacity', K([[116, 0], [117.4, .5, 'io'], [120.2, .5], [121, 0, 'io'], [123, 0], [123.6, .5, 'io'], [125.2, .5], [125.9, 0, 'io']], t));
      const sunP = K([[116, .55], [117.6, 1], [120.4, 0], [122.4, .5], [123.4, 1], [125.6, 0], [129, .6]], t), sunHidden = (t > 117.6 && t < 120.4) || (t > 123.4 && t < 125.6) || t < 116 || t > 129.2;
      const moonP = K([[117.6, 0], [120.4, 1], [123.4, 0], [125.6, 1]], t), moonOn = (t > 117.6 && t < 120.4) || (t > 123.4 && t < 125.6);
      show(sun, !sunHidden && (t >= 116 && t <= 129.2)); sun.setAttribute('transform', `translate(${lerp(4300, 4850, sunP)},${520 - Math.sin(sunP * Math.PI) * 330})`);
      show(moon, moonOn); moon.setAttribute('transform', `translate(${lerp(4300, 4850, moonP)},${520 - Math.sin(moonP * Math.PI) * 330})`);
      show(later, t >= 122.4 && t < 126); later.setAttribute('opacity', K([[122.4, 0], [123, 1], [125.4, 1], [126, 0]], t));
      // ---- BEEP ----
      let armL = [-92, 88], armR = [92, 88], look = .4, lookY = 0, rot = 0, blink;
      const face = step([[0, 'neutral'], [3.2, 'neutral'], [9.4, 'happy'], [14.2, 'wink'], [15, 'neutral'], [21, 'suspicious'], [23.2, 'neutral'], [25, 'suspicious'], [35.4, 'question'], [36.6, 'wide'], [38.0, 'exclaim'], [39.0, 'annoyed'], [43.2, 'wide'], [45.0, 'sad'], [47, 'neutral'], [53.0, 'question'], [55, 'wide'], [57.2, 'static'], [58.6, 'x'], [60.0, 'wide'], [61.8, 'angry'], [66, 'annoyed'], [69.5, 'sad'], [74, 'neutral'], [83.5, 'wide'], [84.4, 'x'], [86.6, 'swirl'], [88.6, 'sad'], [91, 'question'], [97.6, 'wide'], [98.1, 'neutral'], [100, 'happy'], [105.5, 'happy'], [108, 'neutral'], [112.5, 'neutral'], [114.0, 'happy'], [116.5, 'dots'], [121.0, 'battery'], [125.4, 'static'], [126.6, 'dots'], [128.5, 'wide'], [129.9, 'stars'], [131.5, 'happy'], [134.0, 'neutral'], [134.8, 'happy'], [136.0, 'neutral']], t);
      let fp = face === 'battery' ? K([[121, .3], [125.4, .08]], t) : 0;
      look = step([[0, .3], [21.5, -.9], [23, .7], [25.5, -.6], [27, .8], [29, -.7], [31, .6], [33, -.5], [34.2, .8], [35.5, 1], [36.5, .9], [38.2, .4], [40, 0], [52, .6], [55, .8], [66, .4]], t);
      if (t >= 55 && t < 60) look = .9;
      const swag = t >= 3.2 && t < 14.5; // slow-mo swagger
      // arms: sentry (folded), reach, etc.
      if (t >= 21.4 && t < 38.2) { armL = [-26, 40]; armR = [26, 40]; }
      if (t >= 38.4 && t < 43) { armL = [-96, 40]; armR = [96, 80]; }
      if (t >= 114.0 && t < 130.0) armR = [100, -52 - 4 * Math.sin(t * 2)];
      if (t >= 130.0 && t < 133.5) armR = [100, -58];
      if (t >= 134.2 && t < 138) armL = [-52, 24];
      if (t >= 8.6 && t < 10) armR = [94, 30];
      rot += K([[84.5, 0], [85.4, -38, 'out'], [87.4, 20, 'io'], [88.6, 0, 'el']], t) + Math.sin(t * 30) * (t > 57 && t < 58.6 ? 4 : 0);
      const s = sq([[14.6, .1], [38.2, .25], [58.4, .25], [86.4, .35], [130.0, .2], [136.0, .1]], t);
      const noHat = (t >= 61.2 && t < 68.6);
      const bst = { x: bx, y: by, rot, sx: 1 + s * .6, sy: 1 - s, face, fp, look, lookY, blink, thrust: 1, talk: MS.mouth('B', t), antX: MS.beepAntenna(vx, t, [[38.2, 1], [58.4, 1.2], [86.4, 1.5], [130.0, 1]]) + (t >= 85 && t < 87 ? -40 : 0), acc: { scarf: true, hat: noHat ? undefined : 'cap' }, armL, armR };
      const bs = beep.draw(bst, t, G);
      // slime / cobweb / bird nest on BEEP
      const pr = rot * Math.PI / 180, headX = bx + Math.sin(pr) * 198, headY = by - Math.cos(pr) * 198;
      show(slime, t >= 58.0 && t < 80); slime.setAttribute('transform', TR(bx, by - 114, rot, 1));
      show(shadesB, (t >= 3.2 && t < 14.4) || (t >= 136 && t < 142)); shadesB.setAttribute('transform', TR(bx, by - 112, rot, 1));
      // ---- MOCHI ----
      let mx = mxF(t), my = G, mflip = 1, mpose = 'walk', meyes = 'open', mst = { mouth: 'w', tailAmp: 1 }, mlook = 0;
      const mv = (mxF(t + .05) - mxF(t - .05)) / .1;
      if (Math.abs(mv) < 12) mpose = 'sit';
      if (t < 14.5) { mst.runSpd = 3.5; mst.legLift = .5; meyes = 'half'; mst.mouth = 'smirk'; }
      if (t >= 14.5 && t < 19.5) { meyes = 'open'; }
      if (t >= 19.5 && t < 46) { mpose = 'sit'; mflip = 1; meyes = 'half'; mst.mouth = 'smirk'; if (t >= 36.8 && t < 38.6) meyes = 'one'; if (t >= 38.6 && t < 40) meyes = 'half'; if (t >= 40 && t < 46) { meyes = 'happy'; mst.mouth = 'tongue'; } }
      if (t >= 52 && t < 78) { mpose = 'sit'; mflip = 1; meyes = 'half'; mst.mouth = 'smirk'; if (t >= 58 && t < 62) meyes = 'wide'; if (t >= 68 && t < 72) { meyes = 'closed'; mst.tilt = Math.sin(t * 6) * 12; } }
      if (t >= 82.5 && t < 84.2) { mpose = 'sit'; meyes = 'half'; mst.mouth = 'smirk'; }
      if (t >= 84.2 && t < 88.5) { mpose = 'crouch'; meyes = 'dilated'; mx = 3170 - 20 * Math.exp(-(t - 84.2) * 2); mst.wiggle = 0; mst.tailAmp = 2; }
      if (t >= 88.5 && t < 91.5) { mpose = 'walk'; meyes = 'half'; mst.runSpd = 5; mst.mouth = 'smirk'; }
      if (t >= 91.5 && t < 108) { mpose = 'sit'; meyes = t >= 94 && t < 95.4 ? 'open' : t >= 96.2 && t < 98 ? 'closed' : 'half'; mst.mouth = t >= 94 && t < 95.2 ? 'open' : 'smirk'; mst.mouthOpen = .5; mlook = .8; }
      if (t >= 112.5 && t < 114) { mpose = 'walk'; meyes = 'half'; }
      if (t >= 114 && t < 119) { mpose = 'sit'; meyes = 'half'; mflip = 1; }
      if (t >= 119 && t < 125.6) { mpose = 'sleep'; meyes = 'closed'; }
      if (t >= 125.6 && t < 126.8) { mpose = 'stretch'; meyes = 'half'; mst.mouth = 'open'; mst.mouthOpen = 1; }
      if (t >= 126.8 && t < 134) { mpose = 'sit'; meyes = 'open'; }
      if (t >= 134 && t < 138.2) { mpose = 'sit'; meyes = 'happy'; mst.paw = K([[134.2, 0], [134.8, 1, 'out'], [136, 1], [136.8, 0]], t); mst.pawT = [62, -62]; mst.mouth = 'tongue'; }
      if (t >= 138.2 && t < 141) { mpose = 'sit'; meyes = 'half'; mst.mouth = 'smirk'; }
      if (t >= 141) { mpose = 'walk'; meyes = 'half'; mst.runSpd = 3.5; mst.legLift = .5; mst.mouth = 'smirk'; }
      if (mpose === 'sleep') { mx = 4440; }
      const mh = mochi.draw(Object.assign({ x: mx, y: my, flip: mflip, pose: mpose, eyes: meyes, look: mlook, acc: { scarf: true } }, mst), t);
      const mshades = (t >= 3.2 && t < 14.4) || (t >= 136 && t < 142);
      show(shadesM, mshades); shadesM.setAttribute('transform', TR(mh.head[0], mh.head[1] - 6, 0, .56));
      // badge
      show(star, t >= 43.9); star.setAttribute('transform', TR(mx + 18, G - 52, 0, .8 * (t < 44.5 ? 1 + .5 * (1 - E.out(R(43.9, 44.5, t))) : 1)));
      show(capP, false);

      // ---- DANA ----
      let dpose = 'stand', dtalk = MS.mouth('D', t), dflip = 1;
      if (t >= 53.4 && t < 56) dpose = 'point';
      if (t >= 69 && t < 73) dpose = 'clap';
      dana.draw({ x: 2140, y: G, flip: dflip, pose: dpose, talk: dtalk, eyes: t >= 69 && t < 73 ? 'happy' : 'open', shadow: true }, t);
      show(dana.root, t >= 46 && t < 82); show(dana.shadow, t >= 46 && t < 82);

      // ---- MEERKATS ----
      const mkPos = [[1250, 770, .8, 0], [1390, 665, 1.0, 1.7], [1530, 780, .8, 3.1]];
      mk.forEach((m, i) => {
        const [x, y, sc, ph] = mkPos[i], sal = i === 0 ? K([[42.4, 0], [43.0, 1, 'out'], [45, 1], [46, 0]], t) : 0;
        let look2 = t >= 21 && t < 34 ? Math.sin(t * .9 + ph) * .8 - .2 : -.8, nod = 0, dy = 0;
        if (t >= 34 && t < 40) look2 = -.8 + Math.sin(t * 5) * .1;
        if (t >= 41.6 && t < 45) { nod = Math.abs(Math.sin((t - 41.6) * 3)) * (i === 1 ? 1 : .6); }
        if (i === 2 && t >= 42 && t < 44) dy = Math.abs(Math.sin((t - 42) * 8)) * 12; // tiny clap hop
        m.draw({ x, y, s: sc, flip: 1, look: look2, nod, dy, ph, eyes: t >= 34 && t < 38 ? 'wide' : 'open', salute: i === 1 ? sal : i === 0 ? K([[42.8, 0], [43.4, 1, 'out'], [45, 1], [46, 0]], t) * 0 : 0 }, t);
        show(m.g, t >= 14 && t < 82);
      });
      // butterfly (33.8–39.5)
      const bfOn = t >= 33.8 && t < 39.5; show(butterfly, bfOn);
      if (bfOn) { const p = R(33.8, 39.5, t), bp = K([[33.8, [800, 540]], [35.2, [1000, 480]], [36.4, [1180, 540]], [37.0, [1120, 600]], [38.2, [1028, 722]], [38.5, [1030, 724]], [39.5, [1300, 420]]], t);
        butterfly.setAttribute('transform', `translate(${bp[0] + Math.sin(t * 6) * 14},${bp[1] + Math.cos(t * 7) * 12}) scale(${.9 + Math.sin(t * 30) * .06})`); butterfly._w.forEach((w, i) => w.setAttribute('transform', `scale(${1},${.5 + .5 * Math.abs(Math.sin(t * 30 + i))})`)); }

      // ---- GIRAFFE ----
      const gh = K([[0, [2480, 330]], [49.6, [2480, 330]], [51.8, [2418, 584], 'io'], [56.4, [2418, 584]], [60.4, [2418, 584]], [61.6, [2470, 360], 'io'], [64.6, [2470, 360]], [66.8, [2418, 590], 'io'], [69.6, [2418, 590]], [71.4, [2480, 330], 'io']], t);
      const gtongue = K([[56.4, 0], [57.0, 1, 'out'], [58.0, 1], [58.8, 0, 'in'], [60.5, 0], [61.0, 1.05, 'out'], [61.8, .5], [62.4, 0], [66.4, 0], [67.2, 1, 'out'], [67.8, 0]], t);
      const glift = K([[56.4, 0], [57.0, 0], [57.6, 1, 'io'], [58.2, 1], [58.8, 0]], t);
      const gi = giraffe.draw({ hx: gh[0], hy: gh[1], rot: K([[49.6, -8], [51.8, 10], [61.6, -12], [66.8, 10], [71.4, -8]], t), tongue: gtongue, lift: glift, look: t > 52 ? -.9 : 0, bend: 0 }, t);
      // cap travel (stolen 61.0 → spit back 67.2)
      if (t >= 61.0 && t < 68.4) {
        let cp;
        if (t < 61.8) cp = [lerp(bx, gi.tip[0], E.out(R(61.0, 61.4, t))), lerp(by - 196, gi.tip[1], E.out(R(61.0, 61.4, t)))];
        else if (t < 66.8) cp = [gi.mouth[0] + 10, gi.mouth[1] - 6];
        else if (t < 67.8) cp = [lerp(gi.mouth[0], bx, E.in(R(66.8, 67.8, t))), lerp(gi.mouth[1], by - 200, E.in(R(66.8, 67.8, t))) - Math.sin(R(66.8, 67.8, t) * Math.PI) * 80];
        else cp = [bx, by - 196 + (t < 68.4 ? (1 - R(67.8, 68.4, t)) * -18 * 0 : 0)];
        show(capP, true); capP.setAttribute('transform', TR(cp[0], cp[1], (t > 66.8 && t < 67.8) ? (t - 66.8) * 540 : 0, .7 * (t >= 61.8 && t < 66.8 ? .7 : 1)));
      }

      // ---- LION + roar rings ----
      const lroar = K([[84.2, 0], [84.6, 1, 'out'], [86.0, 1], [86.5, 0], [93.9, 0], [94.3, .35, 'out'], [95.0, 0]], t) * (t < 93 ? 1 : 0) + (t >= 94 && t < 95 ? 0 : 0);
      const lbow = K([[95.2, 0], [96.0, 1, 'io'], [97.6, 1], [98.4, 0, 'io']], t), nuz = K([[99.6, 0], [100.0, 1, 'out'], [100.6, 0, 'io']], t);
      const leyes = t < 83.8 ? 'half' : t < 86.8 ? 'open' : t < 94.0 ? 'wide' : t < 95.2 ? 'wide' : t < 98 ? 'closed' : t < 99.4 ? 'open' : 'half';
      const lxx = 3680 + K([[94, 0], [94.5, 24, 'out'], [96, 18], [99.4, 0, 'io']], t);
      lion.draw({ x: lxx, y: G, s: .85, flip: 1, roar: lroar, bow: lbow, nuz, eyes: leyes, look: -.6 }, t);
      const mouthW = [lxx - 70, G - 150];
      rings.forEach((r, i) => { const k = (t - 84.2 - i * .28) / 1.4, on = k > 0 && k < 1; r.setAttribute('opacity', on ? (1 - k) * .8 : 0); if (on) at(r, { cx: mouthW[0], cy: mouthW[1], r: 40 + E.out(k) * 640 }); });

      // ---- SLOTH ----
      const reach = K([[114.6, 0], [130.0, 1, 'lin']], t);
      const hnd = sloth.hand({ x: 4690, y: 462, reach, hx: -62, hy: 118 });
      sloth.draw({ x: 4690, y: 462, reach, hx: -62, hy: 118, eyes: t >= 128.6 ? 'open' : 'half', grin: t >= 130, look: -.6 }, t);
      // nest + bird + web on BEEP during time-lapse
      const nestOn = t >= 121.6 && t < 130.6; show(nest, nestOn); nest.setAttribute('transform', TR(headX, headY - 8, 0, 1));
      const birdFly = t >= 130.6 && t < 133; show(bird, (t >= 122.4 && t < 133)); bird.setAttribute('transform', TR(headX + (birdFly ? (t - 130.6) * 120 : 0), headY - 14 - (birdFly ? (t - 130.6) * 220 : Math.abs(Math.sin(t * 8)) * (t >= 126.4 && t < 127 ? 8 : 0)), 0, 1));
      show(web, t >= 124.4 && t < 130.4); web.setAttribute('d', `M${bx},${by - 262} L${bx - 70},${by - 150} M${bx},${by - 262} L${bx + 70},${by - 150} M${bx},${by - 262} L${bx},${by - 190} M${bx - 36},${by - 206} L${bx + 36},${by - 206}`);
    },
  };
})();
