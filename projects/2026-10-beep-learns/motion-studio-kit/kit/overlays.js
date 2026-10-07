// OVERLAYS + FX: subtitles, title card, "BEEP learned" end card, iris, puffs, sparkles, ! ? bangs, zzz, dizzy stars, confetti.
(function (root) {
  const MS = root.MS;
  const FONT = 'font-family:FR,sans-serif;font-weight:700';
  MS.NAMECOL = { B: ['BEEP', '#7FF6FF'], M: ['MOCHI', '#FFB067'] };
  // ---------- subtitles ----------
  MS.makeSubs = function (svg) {
    const { S, T } = MS, W = MS.W, H = MS.H, fs = MS.VERTICAL ? 46 : 44;
    const g = S('g', {}, svg), bg = S('rect', { rx: 40, fill: '#000', opacity: .62 }, g);
    const nm = T(g, 0, 0, '', fs * .86, '#FFC145', { 'text-anchor': 'start', style: FONT });
    const tx = T(g, 0, 0, '', fs, '#fff', { 'text-anchor': 'start', style: 'font-family:FR,sans-serif;font-weight:600' });
    const y = MS.VERTICAL ? H * .80 : H - 70;
    return {
      // lines: [[id, start, who, text, dur]]; names: who -> [label, color]
      draw(t, lines, names) {
        let cur = null; for (const L of lines) if (t >= L[1] - .05 && t < L[1] + L[4] + .35) cur = L;
        MS.show(g, !!cur); if (!cur) return;
        const [label, col] = (names || MS.NAMECOL)[cur[2]] || [cur[2], '#FFC145'];
        nm.textContent = label ? label + ':' : ''; nm.setAttribute('fill', col); tx.textContent = cur[3];
        const w1 = label ? (label.length + 1) * fs * .55 + 10 : 0, w2 = cur[3].length * fs * .5, Wd = Math.min(W - 40, w1 + w2 + 60), x0 = (W - Wd) / 2;
        MS.at(bg, { x: x0, y: y - fs * 1.15, width: Wd, height: fs * 1.75 }); MS.at(nm, { x: x0 + 30, y }); MS.at(tx, { x: x0 + 30 + w1, y });
        const k = Math.min(MS.clamp((t - cur[1] + .05) / .12), MS.clamp((cur[1] + cur[4] + .35 - t) / .12)); g.setAttribute('opacity', k);
      }
    };
  };
  // ---------- fit a 1200x1000 design box into the canvas ----------
  const fitBox = (g) => { const s = MS.VERTICAL ? MS.W / 1120 : Math.min(MS.W / 1300, MS.H / 1100); g.setAttribute('transform', `translate(${MS.W / 2},${MS.H / 2}) scale(${s})`); };
  // ---------- title card: BEEP LEARNS + episode title ----------
  MS.makeTitle = function (svg, episodeTitle, subtitle, bg = '#2EC4B6') {
    const { S, T } = MS; const g = S('g', {}, svg);
    S('rect', { x: 0, y: 0, width: MS.W, height: MS.H, fill: bg }, g);
    const rays = S('g', {}, g); for (let i = 0; i < 20; i++) S('path', { d: 'M0,0 L-130,-2400 L130,-2400 Z', fill: '#fff', opacity: i % 2 ? .08 : 0, transform: `rotate(${i * 18})` }, rays);
    const box = S('g', {}, g); fitBox(box);
    const logo = [...'BEEP'].map((c, i) => T(box, -180 + i * 120, -230, c, 170, '#7FF6FF', { stroke: MS.PL, 'stroke-width': 16, style: FONT }));
    const l2 = T(box, 0, -110, 'LEARNS!', 110, '#FFE14D', { stroke: MS.PL, 'stroke-width': 14, style: FONT });
    const plate = S('g', {}, box); S('rect', { x: -520, y: -20, width: 1040, height: 150, rx: 40, fill: '#FFFDF7', ...MS.OL(8) }, plate);
    const ep = T(plate, 0, 82, episodeTitle, episodeTitle.length > 24 ? 60 : 76, MS.PL, { style: FONT });
    const sub = T(box, 0, 230, subtitle || '', 46, '#FFFDF7', { stroke: MS.PL, 'stroke-width': 9, style: FONT });
    const bpG = S('g', {}, box); const bp = MS.makeBeep(bpG);
    return {
      g, draw(t, a = 0, b = 3.2) {
        MS.show(g, t >= a && t < b); if (t < a || t >= b) return; const k = t - a;
        rays.setAttribute('transform', `translate(${MS.W / 2},${MS.H / 2}) rotate(${k * 14})`);
        logo.forEach((e, i) => { const s = MS.pop(k, .1 + i * .1, .35); e.setAttribute('transform', `translate(${-180 + i * 120},${-230 + Math.sin(k * 5 + i) * 6}) scale(${s}) translate(${180 - i * 120},230)`); });
        l2.setAttribute('transform', `translate(0,-110) scale(${MS.pop(k, .55, .35)}) translate(0,110)`);
        plate.setAttribute('transform', `translate(0,${(1 - MS.E.back(MS.clamp((k - .8) / .4))) * 600})`);
        sub.setAttribute('opacity', MS.clamp((k - 1.3) / .3));
        bp.draw({ x: MS.VERTICAL ? 0 : 560, y: MS.VERTICAL ? 520 : 70 + Math.sin(k * 3) * 10, sx: .9, sy: .9, face: k > 1.0 ? 'happy' : 'neutral', armR: [130 + Math.sin(k * 12) * 20, -60], armL: [-92, 88], antX: Math.sin(k * 5) * 12, shadow: false }, k);
        g.setAttribute('opacity', 1 - MS.clamp((t - (b - .35)) / .35));
      }
    };
  };
  // ---------- end card: Today BEEP learned ----------
  // words: [{word:'Itadakimasu!', meaning:"= Let's eat!", note:'say it before eating'}] (max 3)
  MS.makeEndCard = function (svg, words, cta = 'Where should BEEP go next?', bg = '#2B2340') {
    const { S, T } = MS; const g = S('g', {}, svg);
    S('rect', { x: 0, y: 0, width: MS.W, height: MS.H, fill: bg }, g);
    const rays = S('g', {}, g); for (let i = 0; i < 20; i++) S('path', { d: 'M0,0 L-130,-2400 L130,-2400 Z', fill: '#fff', opacity: i % 2 ? .05 : 0, transform: `rotate(${i * 18})` }, rays);
    const box = S('g', {}, g); fitBox(box);
    const head = T(box, 0, -340, 'TODAY BEEP LEARNED:', 74, '#FFE14D', { stroke: '#E63946', 'stroke-width': 10, style: FONT });
    const cards = words.slice(0, 3).map((w, i) => { const c = S('g', {}, box); const y = -230 + i * 170; S('rect', { x: -540, y, width: 1080, height: 140, rx: 34, fill: '#FFFDF7', ...MS.OL(7) }, c); S('circle', { cx: -470, cy: y + 70, r: 38, fill: '#2EC4B6', ...MS.OL(5) }, c); T(c, -470, y + 88, String(i + 1), 50, '#fff', { style: FONT });
      T(c, -400, y + 66, w.word, 58, '#E63946', { 'text-anchor': 'start', style: FONT }); T(c, -400, y + 116, (w.meaning || '') + (w.note ? '  ·  ' + w.note : ''), 34, MS.PL, { 'text-anchor': 'start', style: 'font-family:FR,sans-serif;font-weight:600' }); return c; });
    const ctaT = T(box, 0, 330, cta, 50, '#FFFDF7', { stroke: MS.PL, 'stroke-width': 9, style: FONT });
    return { g, draw(t, a, b) { MS.show(g, t >= a && t < b); if (t < a || t >= b) return; const k = t - a; rays.setAttribute('transform', `translate(${MS.W / 2},${MS.H / 2}) rotate(${k * 10})`); head.setAttribute('transform', `translate(0,-340) scale(${MS.pop(k, .1, .35)}) translate(0,340)`); cards.forEach((c, i) => c.setAttribute('transform', `translate(${(1 - MS.E.back(MS.clamp((k - .5 - i * .45) / .4))) * -1500},0)`)); ctaT.setAttribute('opacity', MS.clamp((k - (.6 + cards.length * .45)) / .3)); } };
  };
  // ---------- iris (screen space) ----------
  MS.makeIris = function (svg) { const p = MS.S('path', { fill: '#000', 'fill-rule': 'evenodd' }, svg); return { draw(r, cx, cy) { MS.show(p, r !== null && r !== undefined); if (r == null) return; p.setAttribute('d', `M-10,-10 H${MS.W + 10} V${MS.H + 10} H-10 Z M${cx - r},${cy} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`); } }; };
  // ---------- FX pool (world space) ----------
  MS.makeFX = function (layer) {
    const { S, T, at, show } = MS, PL = MS.PL;
    const starD = r => `M0,${-r} Q${r * .2},${-r * .2} ${r},0 Q${r * .2},${r * .2} 0,${r} Q${-r * .2},${r * .2} ${-r},0 Q${-r * .2},${-r * .2} 0,${-r} Z`;
    const fx = { puffs: [], sparks: [], bangs: [], zzz: [], stars: [], confetti: [] };
    fx.puff = (t0, x, y, n = 7, col = '#FFFDF7') => { const g = S('g', {}, layer), r = MS.seeded(Math.round(t0 * 100)); const cs = []; for (let i = 0; i < n; i++) cs.push({ c: S('circle', { fill: col, ...MS.OL(4) }, g), a: i / n * 6.28 + r(), d: 60 + r() * 50, r: 14 + r() * 14 }); fx.puffs.push({ g, t0, x, y, cs }); };
    fx.sparkle = (t0, x, y) => { const g = S('g', {}, layer); const ss = []; for (let i = 0; i < 4; i++) ss.push(S('path', { d: starD(16), fill: i % 2 ? '#FFC145' : '#7FF6FF', stroke: PL, 'stroke-width': 3 }, g)); fx.sparks.push({ g, t0, x, y, ss }); };
    fx.bang = (t0, s, getPos, dur = .9, col = '#E63946', size = 90) => { const e = T(layer, 0, 0, s, size, col, { stroke: '#fff', 'stroke-width': 10, style: FONT }); fx.bangs.push({ e, t0, getPos, dur }); };
    fx.zzzOn = (a, b, getPos) => { for (let i = 0; i < 3; i++) fx.zzz.push({ e: T(layer, 0, 0, 'z', 44, '#5AA9FF', { stroke: '#fff', 'stroke-width': 7, style: FONT }), a, b, getPos, i }); };
    fx.dizzy = (a, b, getPos, n = 3) => { for (let i = 0; i < n; i++) fx.stars.push({ e: S('path', { d: starD(16), fill: '#FFE14D', stroke: PL, 'stroke-width': 3 }, layer), a, b, getPos, i, n }); };
    fx.confettiAt = (t0, x0, x1, n = 120) => { const r = MS.seeded(77), cols = ['#FFE14D', '#7FF6FF', '#FF7AA2', '#9BFF6A', '#FFFFFF', '#B49CF2']; for (let i = 0; i < n; i++) fx.confetti.push({ e: S('rect', { width: 14, height: 22, rx: 3, fill: cols[i % 6] }, layer), t0, x: x0 + r() * (x1 - x0), d: r() * 3, sp: 180 + r() * 200, sw: r() * 60, ro: r() * 600 }); };
    fx.draw = function (t) {
      fx.puffs.forEach(p => { const k = (t - p.t0) / .55; show(p.g, k > 0 && k < 1); if (k > 0 && k < 1) p.cs.forEach(c => at(c.c, { cx: p.x + Math.cos(c.a) * c.d * MS.E.out(k), cy: p.y + Math.sin(c.a) * c.d * .5 * MS.E.out(k) - 20 * k, r: c.r * (1 - k) })); });
      fx.sparks.forEach(s => { const k = (t - s.t0) / .6; show(s.g, k > 0 && k < 1); if (k > 0 && k < 1) s.ss.forEach((e, i) => { const a = i * 1.57 + .6; e.setAttribute('transform', `translate(${s.x + Math.cos(a) * 70 * MS.E.out(k)},${s.y + Math.sin(a) * 50 * MS.E.out(k)}) scale(${Math.sin(k * Math.PI)}) rotate(${k * 90})`); }); });
      fx.bangs.forEach(b => { const k = t - b.t0, on = k > 0 && k < b.dur; show(b.e, on); if (on) { const p = b.getPos(t); b.e.setAttribute('transform', `translate(${p[0]},${p[1]}) scale(${MS.pop(t, b.t0, .2)})`); } });
      fx.zzz.forEach(z => { const on = t > z.a && t < z.b; show(z.e, on); if (on) { const p = z.getPos(t), q = (t * .6 + z.i / 3) % 1; z.e.setAttribute('transform', `translate(${p[0] + 30 + q * 60 + Math.sin(q * 6) * 10},${p[1] - 40 - q * 120}) scale(${.5 + q})`); z.e.setAttribute('opacity', Math.sin(q * Math.PI)); } });
      fx.stars.forEach(s => { const on = t > s.a && t < s.b; show(s.e, on); if (on) { const p = s.getPos(t), a = t * 5 + s.i * 6.28 / s.n; s.e.setAttribute('transform', `translate(${p[0] + Math.cos(a) * 70},${p[1] - 60 + Math.sin(a) * 18}) rotate(${t * 200})`); } });
      fx.confetti.forEach(c => { const k = t - c.t0 - c.d; show(c.e, k > 0 && k < 7); if (k > 0) c.e.setAttribute('transform', `translate(${c.x + Math.sin(k * 3 + c.sw) * c.sw},${-200 + k * c.sp}) rotate(${c.ro * k})`); });
    };
    return fx;
  };
})(typeof window !== 'undefined' ? window : globalThis);
