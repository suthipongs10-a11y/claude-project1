// EPISODE: BEEP in JAPAN — The Bow. World units: 1920x1080 stage, ground G=860.
(function () {
  const { S, K, step, sq, clamp, lerp, E } = MS, G = 860, PL = MS.PL, OL = MS.OL(6);
  let beep, mochi, aiko, petals = [];
  window.EP = {
    build(L) {
      // ---- SET: Tokyo-ish street, Mt Fuji, torii, cherry tree ----
      S('rect', { x: -1500, y: -1500, width: 4920, height: 2400, fill: '#BFE6F5' }, L.sky);
      S('circle', { cx: 1500, cy: 180, r: 70, fill: '#FFE38A' }, L.sky);
      S('path', { d: 'M520,700 L880,300 Q960,240 1040,300 L1400,700 Z', fill: '#8EA6D9', ...OL }, L.sky);
      S('path', { d: 'M820,370 L880,300 Q960,240 1040,300 L1100,370 Q1060,350 1030,380 Q990,340 960,380 Q930,340 890,380 Q860,350 820,370 Z', fill: '#FFFFFF' }, L.sky);
      S('rect', { x: -1500, y: 700, width: 4920, height: 1400, fill: '#E9D9C0' }, L.set);
      for (let x = -1500; x < 3400; x += 160) S('rect', { x, y: 760 + (x / 160 % 2) * 10, width: 150, height: 60, rx: 10, fill: '#DDCAAD' }, L.set);
      S('rect', { x: -1500, y: 690, width: 4920, height: 20, fill: '#B9A48A' }, L.set);
      // torii
      const tg = S('g', {}, L.set); S('rect', { x: 1440, y: 360, width: 34, height: 500, fill: '#E63946', ...OL }, tg); S('rect', { x: 1720, y: 360, width: 34, height: 500, fill: '#E63946', ...OL }, tg);
      S('path', { d: 'M1380,330 Q1597,300 1814,330 L1820,360 Q1597,340 1374,360 Z', fill: '#E63946', ...OL }, tg); S('rect', { x: 1400, y: 400, width: 394, height: 26, fill: '#E63946', ...OL }, tg); S('path', { d: 'M1370,318 Q1597,280 1824,318 L1830,334 Q1597,300 1364,334 Z', fill: '#2B2340' }, tg);
      // cherry tree
      S('path', { d: 'M240,860 Q260,640 230,520 M240,640 Q300,560 380,540 M232,560 Q180,500 120,490', stroke: '#7A4A2A', 'stroke-width': 26, fill: 'none', 'stroke-linecap': 'round' }, L.set);
      [[230, 470, 120], [360, 500, 100], [120, 470, 90], [280, 380, 110]].forEach(([x, y, r]) => S('circle', { cx: x, cy: y, r, fill: '#FFC1D9', ...OL }, L.set));
      // lantern
      const lt = S('g', { transform: 'translate(560,600)' }, L.set); S('line', { x1: 0, y1: -300, x2: 0, y2: -60, stroke: PL, 'stroke-width': 4 }, lt); S('ellipse', { cx: 0, cy: 0, rx: 46, ry: 60, fill: '#FF6B6B', ...OL }, lt); S('rect', { x: -30, y: -66, width: 60, height: 12, fill: PL }, lt); S('rect', { x: -30, y: 54, width: 60, height: 12, fill: PL }, lt);
      // petals
      const r = MS.seeded(5); for (let i = 0; i < 26; i++) petals.push({ e: S('ellipse', { rx: 9, ry: 6, fill: '#FF9EC4', stroke: PL, 'stroke-width': 2 }, L.front), x: r() * 1900, s: 40 + r() * 50, ph: r() * 6 });
      // ---- CHARACTERS (locked kit) ----
      aiko = MS.makePerson(L.mid, { skin: '#F6CFAE', hair: 'bun', hairColor: '#2A1E1A', top: '#FF8FA3', bottom: '#5A4E8C', bottomType: 'skirt' }, L.back);
      mochi = MS.makeCat(L.mid, L.back);
      beep = MS.makeBeep(L.mid, L.back);
      // FX cues
      L.fx.bang(5.6, '?', t => [beepX(t) + 40, 330], .9, '#2EC4B6');
      L.fx.puff(8.2, 960, G - 20, 8);
      L.fx.dizzy(8.3, 10.4, t => [beepX(t), 440]);
      L.fx.sparkle(6.6, 820, 640); L.fx.sparkle(10.8, 1240, 560);
    },
    camera(t) {
      const v = MS.VERTICAL ? K([[3.2, [960, 600, 1.12]], [7.6, [960, 600, 1.12]], [8.2, [980, 620, 1.3]], [10.4, [1040, 600, 1.2]]], t) : K([[3.2, [960, 540, 1.0]], [7.6, [980, 560, 1.08]], [8.2, [960, 600, 1.25]], [9.4, [960, 600, 1.25]], [10.4, [1000, 560, 1.08]]], t);
      return { x: v[0], y: v[1], z: v[2] };
    },
    iris(t) { if (t < 11.6 || t >= 12.4) return null; const r = K([[11.6, 1400], [12.1, 160, 'io'], [12.4, 0, 'in']], t), c = this.camera(t); return { r, x: (beepX(t) - c.x) * c.z + MS.W / 2, y: (600 - c.y) * c.z + MS.H / 2 }; },
    update(t, L) {
      petals.forEach(p => { const y = ((t * p.s + p.ph * 100) % 1100) - 100; p.e.setAttribute('transform', `translate(${p.x + Math.sin(t + p.ph) * 40},${y}) rotate(${t * 90 + p.ph * 50})`); });
      // AIKO
      const bowA = K([[4.3, 0], [4.7, 1, 'out'], [5.4, 1], [5.8, 0]], t);
      const aikoPose = t > 10.8 && t < 11.6 ? 'clap' : bowA > .02 ? 'bow' : 'stand';
      aiko.draw({ x: 1260, y: G, flip: -1, pose: aikoPose, bowAmt: bowA, talk: MS.mouth('A', t), eyes: bowA > .5 ? 'closed' : t > 8.2 && t < 9.4 ? 'wide' : t > 10.8 ? 'happy' : 'open' }, t);
      // MOCHI bows perfectly
      const cb = K([[6.3, 0], [6.6, 1, 'out'], [7.0, 1], [7.3, 0]], t);
      mochi.draw({ x: 820, y: G, flip: 1, pose: 'sit', headDy: cb * 26, tilt: cb * 18, rot: cb * 6, eyes: cb > .3 ? 'closed' : t > 8.2 && t < 9.5 ? 'half' : t > 10.8 ? 'happy' : 'open', look: t > 5 && t < 6.2 ? .8 : 0, mouth: t > 10.9 && t < 11.3 ? 'open' : 'w', mouthOpen: .7 }, t);
      // BEEP
      const x = beepX(t), hov = K([[7.9, 1], [8.0, 0], [8.7, 0], [8.9, 1]], t);
      let rot = K([[7.95, 0], [8.2, 95, 'in'], [8.6, 95], [9.0, -12, 'out'], [9.4, 0, 'el']], t);
      const y = G - 180 + Math.sin(t * 3.2) * 7 * hov + K([[3.2, -120], [4.0, 0, 'back']], t);
      const s = sq([[4.0, .15], [8.2, .35], [9.0, -.2]], t);
      const face = step([[0, 'neutral'], [5.6, 'question'], [6.5, 'wide'], [7.2, 'learning'], [7.95, 'wide'], [8.2, 'x'], [8.6, 'swirl'], [9.5, 'neutral'], [10.8, 'happy']], t);
      const vx = (beepX(t + .03) - beepX(t - .03)) / .06;
      const pr = rot * Math.PI / 180, bx = x + 112 * Math.sin(pr), by = (y + 112) - 112 * Math.cos(pr);
      beep.draw({ x: bx, y: by, rot, sx: 1 + s * .6, sy: 1 - s, face, fp: clamp((t - 7.2) / .7), label: 'BOW.EXE', look: .7, thrust: hov, talk: MS.mouth('B', t), antX: MS.beepAntenna(vx, t, [[8.2, 1.4], [9.0, 1]]), acc: { camera: t < 5.4, scarf: true }, armR: t < 5.4 ? [100, 20] : undefined }, t, G);
    },
  };
  function beepX(t) { return K([[3.2, 380], [4.0, 960, 'out']], t); }
})();
