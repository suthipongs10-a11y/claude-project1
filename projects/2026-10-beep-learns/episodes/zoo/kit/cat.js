// LOCKED CHARACTER: MOCHI — orange tabby cat, big green eyes, unbothered. Never redesign.
// Origin = feet centre on ground. Drawn at scale k (default .82). flip: 1 faces right, -1 faces left.
// state: {x,y,flip,sx,sy,rot,k, pose: sit|run|walk|crouch|stretch|flat|sleep,
//         eyes: open|half|closed|happy|dilated|spiral|one|wide, look(-1..1 world dir), lookY, blink,
//         mouth: w|open|smirk|tongue, mouthOpen(0..1.2), talk(0..1 lip-sync), paw(0..1), pawT:[lx,ly] local target,
//         tailAmp, tailSpd, tilt, headDy, runSpd, legLift, wiggle, shadow(bool), acc:{hat,scarf,bow}}
(function (root) {
  const MS = root.MS;
  const FUR = '#F39C3D', FURD = '#D9731E', CREAM = '#FFE9C7', PINK = '#FF8FA3';
  MS.makeCat = function (parent, shadowParent) {
    const { S, at, show } = MS, PL = MS.PL, OL = MS.OL(6), id = MS.uid('cat');
    const svg = parent.ownerSVGElement || parent; const defs = svg.querySelector('defs') || S('defs', {}, svg);
    const C = {};
    C.shadow = S('ellipse', { rx: 70, ry: 12, fill: '#000', opacity: .18 }, shadowParent || parent);
    C.root = S('g', {}, parent);
    C.tailO = S('path', { fill: 'none', stroke: PL, 'stroke-width': 30, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, C.root);
    C.tailI = S('path', { fill: 'none', stroke: FUR, 'stroke-width': 18, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, C.root);
    C.tailTip = S('path', { fill: 'none', stroke: FURD, 'stroke-width': 18, 'stroke-linecap': 'round' }, C.root);
    const P = C.P = {}; const pose = n => (P[n] = S('g', {}, C.root));
    const limb = p => ({ o: S('path', { fill: 'none', stroke: PL, 'stroke-width': 30, 'stroke-linecap': 'round' }, p), i: S('path', { fill: 'none', stroke: FUR, 'stroke-width': 18, 'stroke-linecap': 'round' }, p) });
    const setLimb = (l, x1, y1, x2, y2, cx, cy) => { const d = cx == null ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`; l.o.setAttribute('d', d); l.i.setAttribute('d', d); };
    pose('sit');
    S('ellipse', { cx: -26, cy: -30, rx: 38, ry: 30, fill: FUR, ...OL }, P.sit);
    S('path', { d: 'M-58,0 C-76,-60 -54,-130 6,-134 C56,-130 72,-60 58,0 Z', fill: FUR, ...OL }, P.sit);
    S('ellipse', { cx: 22, cy: -60, rx: 26, ry: 44, fill: CREAM }, P.sit);
    S('path', { d: 'M-50,-70 q14,6 22,-6 M-56,-40 q16,6 24,-6', stroke: FURD, 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, P.sit);
    P.sit.leg1 = S('rect', { x: 2, y: -70, width: 26, height: 70, rx: 13, fill: FUR, ...OL, 'stroke-width': 5 }, P.sit);
    P.sit.leg2 = S('rect', { x: 32, y: -70, width: 26, height: 70, rx: 13, fill: FUR, ...OL, 'stroke-width': 5 }, P.sit);
    P.sit.paw = limb(P.sit); P.sit.pawEnd = S('ellipse', { rx: 17, ry: 13, fill: CREAM, ...OL, 'stroke-width': 5 }, P.sit);
    pose('run'); P.run.legs = [limb(P.run), limb(P.run), limb(P.run), limb(P.run)];
    P.run.body = S('ellipse', { cx: 0, cy: -84, rx: 104, ry: 42, fill: FUR, ...OL }, P.run);
    S('path', { d: 'M-40,-120 q6,16 -4,30 M0,-124 q6,16 -4,30 M-80,-110 q6,14 -2,26', stroke: FURD, 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, P.run);
    pose('crouch'); P.crouch.g = S('g', {}, P.crouch);
    S('ellipse', { cx: -60, cy: -30, rx: 34, ry: 28, fill: FUR, ...OL }, P.crouch.g); S('ellipse', { cx: 0, cy: -46, rx: 94, ry: 38, fill: FUR, ...OL }, P.crouch.g); S('ellipse', { cx: 60, cy: -10, rx: 26, ry: 12, fill: CREAM, ...OL, 'stroke-width': 5 }, P.crouch.g);
    pose('stretch'); P.stretch.l = [limb(P.stretch), limb(P.stretch), limb(P.stretch)];
    S('path', { d: 'M-110,-150 C-140,-110 -110,-80 -70,-82 L90,-30 C130,-20 130,-70 90,-80 L-60,-160 C-80,-170 -100,-165 -110,-150 Z', fill: FUR, ...OL }, P.stretch);
    pose('flat'); P.flat.l = [limb(P.flat), limb(P.flat), limb(P.flat), limb(P.flat)];
    S('ellipse', { cx: 0, cy: -40, rx: 104, ry: 38, fill: FUR, ...OL }, P.flat); S('ellipse', { cx: 10, cy: -56, rx: 60, ry: 16, fill: CREAM }, P.flat);
    pose('sleep');
    S('ellipse', { cx: 0, cy: -46, rx: 98, ry: 50, fill: FUR, ...OL }, P.sleep);
    S('path', { d: 'M-60,-80 q10,12 0,26 M-20,-92 q10,12 0,26 M20,-92 q10,12 0,26', stroke: FURD, 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }, P.sleep);
    P.sleep.paw = limb(P.sleep); P.sleep.pawEnd = S('ellipse', { rx: 17, ry: 13, fill: CREAM, ...OL, 'stroke-width': 5 }, P.sleep);
    // head
    const H = C.head = S('g', {}, C.root);
    [-1, 1].forEach(s => { S('path', { d: `M${s * 50},-22 L${s * 58},-84 L${s * 12},-50 Z`, fill: FUR, ...OL }, H); S('path', { d: `M${s * 44},-34 L${s * 50},-70 L${s * 22},-50 Z`, fill: PINK }, H); });
    S('path', { d: 'M-66,4 C-70,-40 -40,-58 0,-58 C40,-58 70,-40 66,4 L74,14 L60,18 C50,46 26,56 0,56 C-26,56 -50,46 -60,18 L-74,14 Z', fill: FUR, ...OL }, H);
    S('path', { d: 'M-12,-54 L-8,-38 M0,-56 L0,-40 M12,-54 L8,-38', stroke: FURD, 'stroke-width': 6, 'stroke-linecap': 'round' }, H);
    S('ellipse', { cx: 0, cy: 24, rx: 34, ry: 22, fill: CREAM }, H);
    C.eyes = [-26, 26].map((x, i) => {
      const g = S('g', { transform: `translate(${x},-8)` }, H), cid = id + 'e' + i;
      S('clipPath', { id: cid }, defs).innerHTML = '<ellipse cx="0" cy="0" rx="16" ry="19"/>';
      const white = S('ellipse', { rx: 16, ry: 19, fill: '#B6E35A' }, g), inner = S('g', { 'clip-path': `url(#${cid})` }, g);
      const pupil = S('ellipse', { rx: 5, ry: 13, fill: PL }, inner), hi = S('circle', { cx: 5, cy: -7, r: 4.5, fill: '#fff' }, inner), lid = S('rect', { x: -20, y: -24, width: 40, height: 0, fill: FUR }, inner);
      const lidLine = S('line', { x1: -17, x2: 17, stroke: PL, 'stroke-width': 4, 'stroke-linecap': 'round' }, g), ring = S('ellipse', { rx: 16, ry: 19, fill: 'none', stroke: PL, 'stroke-width': 4 }, g);
      const spiral = S('path', { d: 'M0,0 a3,3 0 1,1 6,0 a8,8 0 1,1 -14,0 a13,13 0 1,1 24,0', stroke: PL, 'stroke-width': 3.5, fill: 'none' }, g);
      const closed = S('path', { d: 'M-15,2 Q0,14 15,2', stroke: PL, 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }, g);
      return { g, white, inner, pupil, hi, lid, lidLine, ring, spiral, closed };
    });
    S('path', { d: 'M-8,8 L8,8 L0,17 Z', fill: PINK, stroke: PL, 'stroke-width': 3, 'stroke-linejoin': 'round' }, H);
    C.mouthW = S('path', { d: 'M-13,24 Q-6,33 0,24 Q6,33 13,24', stroke: PL, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, H);
    C.mouthO = S('g', {}, H); S('ellipse', { cx: 0, cy: 32, rx: 15, ry: 19, fill: '#7A2E4A', ...MS.OL(4) }, C.mouthO); S('ellipse', { cx: 0, cy: 42, rx: 9, ry: 6, fill: PINK }, C.mouthO);
    C.mouthS = S('path', { d: 'M-12,26 Q2,32 15,20', stroke: PL, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, H);
    C.tongue = S('ellipse', { cx: 2, cy: 32, rx: 7, ry: 9, fill: PINK, stroke: PL, 'stroke-width': 3 }, H);
    [-1, 1].forEach(s => S('path', { d: `M${s * 30},18 L${s * 78},10 M${s * 30},26 L${s * 76},30`, stroke: PL, 'stroke-width': 3, 'stroke-linecap': 'round' }, H));
    C.bow = S('g', {}, H); S('path', { d: 'M30,-52 L56,-66 L56,-38 Z M30,-52 L4,-66 L4,-38 Z', fill: '#FF7AA2', ...MS.OL(4) }, C.bow); S('circle', { cx: 30, cy: -52, r: 7, fill: '#FF4D8D', ...MS.OL(3) }, C.bow);
    C.hat = S('g', {}, H); S('path', { d: 'M-40,-50 L0,-130 L40,-50 Z', fill: '#5AA9FF', ...MS.OL(5) }, C.hat); S('circle', { cx: 0, cy: -132, r: 10, fill: '#FFE14D', ...MS.OL(3) }, C.hat);
    C.scarf = S('g', {}, H); S('path', { d: 'M-56,40 Q0,70 56,40 L60,58 Q0,92 -60,58 Z', fill: '#E63946', ...MS.OL(4) }, C.scarf);
    function tailPath(bx, by, dir, len, curl, wave, t, speed) { const n = 9, pts = [[bx, by]]; let a = dir * Math.PI / 180, x = bx, y = by; for (let i = 1; i <= n; i++) { const f = i / n, ang = a + curl * f + wave * Math.sin(t * speed - i * .55) * f; x += Math.cos(ang) * len / n; y += Math.sin(ang) * len / n; pts.push([x, y]); } let d = `M${pts[0][0]},${pts[0][1]}`; for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ` Q${pts[i][0]},${pts[i][1]} ${mx},${my}`; } const L = pts[n], L2 = pts[n - 2]; return { d, tip: `M${L2[0]},${L2[1]} L${L[0]},${L[1]}` }; }
    const HP = { sit: [18, -168, 0], run: [124, -116, 0], walk: [124, -116, 0], crouch: [96, -70, 0], stretch: [136, -64, 8], flat: [106, -50, -24], sleep: [70, -62, 10] };
    const TP = { sit: [-52, -16, 180, 150, 1.9, .25, 2.2], run: [-98, -92, 185, 150, .4, .3, 10], walk: [-98, -92, 220, 150, .9, .3, 4], crouch: [-88, -56, 195, 140, .6, .8, 14], stretch: [-100, -150, 250, 140, .8, .3, 3], flat: [-96, -30, 178, 140, .15, .05, 1], sleep: [-70, -14, 10, 170, -.5, .08, 1.5] };

    C.draw = function (s, t) {
      const k = s.k ?? .82, flip = s.flip ?? 1, ps = s.pose || 'sit', bp = ps === 'walk' ? 'run' : ps;
      C.root.setAttribute('transform', `translate(${s.x},${s.y}) rotate(${s.rot || 0}) scale(${flip * (s.sx ?? 1) * k},${(s.sy ?? 1) * k})`);
      show(C.shadow, s.shadow !== false); at(C.shadow, { cx: s.x, cy: (s.ground ?? s.y) + 4, rx: 70 * k / .82 });
      Object.keys(P).forEach(n => show(P[n], n === bp));
      const hp = HP[ps]; H.setAttribute('transform', `translate(${hp[0]},${hp[1] + (s.headDy || 0)}) rotate(${hp[2] + (s.tilt || 0)}) scale(${flip < 0 ? -1 : 1},1)`);
      const tp = TP[ps], tl = tailPath(tp[0], tp[1], tp[2], tp[3], tp[4], tp[5] * (s.tailAmp ?? 1), t, tp[6] * (s.tailSpd ?? 1));
      C.tailO.setAttribute('d', tl.d); C.tailI.setAttribute('d', tl.d); C.tailTip.setAttribute('d', tl.tip);
      const pw = s.paw || 0, pt = s.pawT || [40, -142];
      if (ps === 'sit') { show(P.sit.leg2, pw <= .01); [P.sit.paw.o, P.sit.paw.i, P.sit.pawEnd].forEach(e => show(e, pw > .01)); if (pw > .01) { const tx = MS.lerp(46, pt[0], pw), ty = MS.lerp(-6, pt[1], pw); setLimb(P.sit.paw, 44, -86, tx, ty, (44 + tx) / 2 + 10, Math.min(-86, ty) - 10); at(P.sit.pawEnd, { cx: tx, cy: ty }); } }
      if (ps === 'sleep') { [P.sleep.paw.o, P.sleep.paw.i, P.sleep.pawEnd].forEach(e => show(e, pw > .01)); if (pw > .01) { const tx = MS.lerp(80, pt[0], pw), ty = MS.lerp(-20, pt[1], pw); setLimb(P.sleep.paw, 60, -40, tx, ty); at(P.sleep.pawEnd, { cx: tx, cy: ty }); } }
      if (bp === 'run') { const spd = s.runSpd ?? (ps === 'walk' ? 7 : 14), lift = s.legLift ?? (ps === 'walk' ? .4 : 1), sw = ps === 'walk' ? 26 : 46, ph = t * spd; P.run.legs.forEach((l, i) => { const hx = i < 2 ? 62 : -62, q = Math.sin(ph + (i % 2) * Math.PI + (i < 2 ? 0 : 1.2)); setLimb(l, hx, -72, hx + q * sw, -8 + Math.max(0, -Math.cos(ph + (i % 2) * Math.PI)) * -22 * lift); }); P.run.body.setAttribute('ry', 42 - 4 * Math.sin(ph * 2)); }
      if (ps === 'crouch') P.crouch.g.setAttribute('transform', `rotate(${Math.sin(t * 24) * 3 * (s.wiggle || 0)} 70 -20) translate(${Math.sin(t * 24) * 6 * (s.wiggle || 0)},0)`);
      if (ps === 'stretch') { setLimb(P.stretch.l[0], 80, -50, 170, -4); setLimb(P.stretch.l[1], 100, -46, 190, -4); setLimb(P.stretch.l[2], -84, -110, -86, -4); }
      if (ps === 'flat') P.flat.l.forEach((l, i) => { const x = [-60, -30, 30, 60][i]; setLimb(l, x, -60, x + Math.sin(t * 6 + i) * 8, -112); });
      const blink = s.blink ?? (((t + 1.3) % 4.3) < .14 ? Math.sin(((t + 1.3) % 4.3) / .14 * Math.PI) : 0);
      C.eyes.forEach((e, i) => {
        const m = s.eyes || 'open', lidV = m === 'half' ? .5 : m === 'closed' ? 1 : m === 'one' ? (i === 0 ? 1 : .35) : (m === 'open' ? blink : 0), dil = m === 'dilated' ? 1 : 0, big = m === 'wide' ? 1.2 : 1;
        at(e.pupil, { rx: (5 + 8 * dil) / big, ry: (13 + 2 * dil) / big, cx: (s.look || 0) * 6, cy: (s.lookY || 0) * 5 }); at(e.hi, { cx: 5 + (s.look || 0) * 6 });
        const lh = 40 * lidV; at(e.lid, { height: lh, y: -22 }); at(e.lidLine, { y1: -22 + lh, y2: -22 + lh });
        const shut = m === 'happy' || lidV >= .97; show(e.lidLine, lidV > .05 && lidV < .97); show(e.spiral, m === 'spiral'); show(e.closed, shut);
        [e.white, e.inner, e.ring].forEach(x => show(x, m !== 'spiral' && !shut)); e.g.setAttribute('transform', `translate(${i ? 26 : -26},-8) scale(${big})`);
        if (m === 'spiral') e.spiral.setAttribute('transform', `rotate(${t * 400 * (i ? 1 : -1)})`);
      });
      const talk = s.talk || 0, mouth = talk > .15 ? 'open' : (s.mouth || 'w'), mo = talk > .15 ? .4 + talk * .8 : (s.mouthOpen ?? 1);
      show(C.mouthW, mouth === 'w' || mouth === 'tongue'); show(C.mouthO, mouth === 'open'); show(C.mouthS, mouth === 'smirk'); show(C.tongue, mouth === 'tongue');
      if (mouth === 'open') C.mouthO.setAttribute('transform', `translate(0,-6) scale(1,${mo}) translate(0,6)`);
      const acc = s.acc || {}; show(C.bow, !!acc.bow); show(C.hat, !!acc.hat); show(C.scarf, !!acc.scarf);
      return { head: [s.x + hp[0] * k * flip, s.y + hp[1] * k] };
    };
    return C;
  };
})(typeof window !== 'undefined' ? window : globalThis);
