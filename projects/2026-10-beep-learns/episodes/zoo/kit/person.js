// LOCALS: bean-style cartoon people for culture episodes. Same line style as BEEP/MOCHI.
// opts: {skin, hair:'short'|'long'|'bun'|'spiky'|'bald'|'curly'|'pony', hairColor, top, bottom, bottomType:'pants'|'skirt'|'shorts',
//        acc:{glasses,mustache,beard,hat:'cap'|'akubra'|'conical'|'sombrero'|'beret'|'hachimaki'|'tophat'|'none', hatColor, apron}, scale}
// state: {x,y,flip,pose: stand|walk|run|bow|wave|cheer|point|shrug|sit|jump|clap, armL,armR (override hand pos), talk(0..1),
//         eyes: open|closed|happy|wide|angry|sad, look, headRot, blush}
(function (root) {
  const MS = root.MS;
  MS.makePerson = function (parent, opts = {}, shadowParent) {
    const { S, at, show } = MS, PL = MS.PL, OL = MS.OL(5);
    const o = Object.assign({ skin: '#F2C29B', hair: 'short', hairColor: '#3A2A20', top: '#5AA9FF', bottom: '#3D405B', bottomType: 'pants', acc: {}, scale: 1 }, opts);
    const P = { o };
    P.shadow = S('ellipse', { rx: 46, ry: 10, fill: '#000', opacity: .18 }, shadowParent || parent);
    P.root = S('g', {}, parent);
    P.legs = [0, 1].map(() => ({ o: S('path', { fill: 'none', stroke: PL, 'stroke-width': 24, 'stroke-linecap': 'round' }, P.root), i: S('path', { fill: 'none', stroke: o.bottomType === 'skirt' ? o.skin : o.bottom, 'stroke-width': 14, 'stroke-linecap': 'round' }, P.root), shoe: S('ellipse', { rx: 18, ry: 9, fill: '#3A2A3F', ...MS.OL(3) }, P.root) }));
    P.torso = S('g', {}, P.root);
    if (o.bottomType === 'skirt') S('path', { d: 'M-34,-110 L34,-110 L50,-60 L-50,-60 Z', fill: o.bottom, ...OL }, P.torso);
    else S('rect', { x: -34, y: -112, width: 68, height: o.bottomType === 'shorts' ? 40 : 34, rx: 8, fill: o.bottom, ...OL }, P.torso);
    S('path', { d: 'M-40,-196 Q0,-212 40,-196 L38,-100 Q0,-92 -38,-100 Z', fill: o.top, ...OL }, P.torso);
    if (o.acc.apron) S('path', { d: 'M-24,-170 L24,-170 L28,-96 L-28,-96 Z', fill: '#FFFDF7', ...MS.OL(4) }, P.torso);
    P.arms = [0, 1].map(() => ({ o: S('path', { fill: 'none', stroke: PL, 'stroke-width': 20, 'stroke-linecap': 'round' }, P.torso), i: S('path', { fill: 'none', stroke: o.top, 'stroke-width': 11, 'stroke-linecap': 'round' }, P.torso), h: S('circle', { r: 12, fill: o.skin, ...MS.OL(4) }, P.torso) }));
    P.head = S('g', {}, P.torso);
    const hc = o.hairColor;
    if (o.hair === 'long' || o.hair === 'pony') S('path', { d: o.hair === 'long' ? 'M-54,-20 Q-60,50 -36,70 L36,70 Q60,50 54,-20 Z' : 'M40,-30 Q90,0 70,60 Q60,20 40,0 Z', fill: hc, ...OL }, P.head);
    S('circle', { cx: 0, cy: 0, r: 50, fill: o.skin, ...OL }, P.head);
    S('ellipse', { cx: -50, cy: 4, rx: 9, ry: 13, fill: o.skin, ...MS.OL(4) }, P.head); S('ellipse', { cx: 50, cy: 4, rx: 9, ry: 13, fill: o.skin, ...MS.OL(4) }, P.head);
    const hairD = { short: 'M-50,-6 Q-54,-56 0,-58 Q54,-56 50,-6 Q30,-30 0,-28 Q-30,-30 -50,-6 Z', long: 'M-52,0 Q-56,-58 0,-60 Q56,-58 52,0 Q40,-34 0,-34 Q-40,-34 -52,0 Z', pony: 'M-50,-6 Q-54,-56 0,-58 Q54,-56 50,-6 Q30,-30 0,-28 Q-30,-30 -50,-6 Z', bun: 'M-50,-6 Q-54,-56 0,-58 Q54,-56 50,-6 Q30,-34 0,-32 Q-30,-34 -50,-6 Z M-20,-58 a20,20 0 1,1 40,0 a20,20 0 1,1 -40,0', spiky: 'M-50,-6 L-46,-50 L-30,-40 L-20,-66 L-4,-46 L10,-70 L22,-46 L40,-60 L42,-36 L52,-6 Q30,-28 0,-26 Q-30,-28 -50,-6 Z', curly: 'M-54,0 a16,16 0 0,1 4,-34 a18,18 0 0,1 26,-24 a18,18 0 0,1 30,-2 a18,18 0 0,1 26,22 a16,16 0 0,1 4,38 Q30,-26 0,-24 Q-30,-26 -54,0 Z', bald: '' }[o.hair];
    if (hairD) S('path', { d: hairD, fill: hc, ...OL }, P.head);
    P.eyes = [-18, 18].map(x => ({ open: S('ellipse', { cx: x, cy: -2, rx: 6, ry: 8, fill: PL }, P.head), closed: S('path', { d: `M${x - 8},-2 Q${x},4 ${x + 8},-2`, stroke: PL, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, P.head), happy: S('path', { d: `M${x - 8},0 Q${x},-10 ${x + 8},0`, stroke: PL, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, P.head), brow: S('line', { x1: x - 9, x2: x + 9, y1: -18, y2: -18, stroke: PL, 'stroke-width': 4, 'stroke-linecap': 'round' }, P.head) }));
    P.blush = [-30, 30].map(x => S('ellipse', { cx: x, cy: 16, rx: 9, ry: 5, fill: '#FF8FA3', opacity: .6 }, P.head));
    S('path', { d: 'M0,4 Q4,12 0,14', stroke: PL, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, P.head);
    P.smile = S('path', { d: 'M-14,24 Q0,34 14,24', stroke: PL, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }, P.head);
    P.mouth = S('ellipse', { cx: 0, cy: 28, rx: 10, ry: 6, fill: '#7A2E4A', ...MS.OL(3) }, P.head);
    if (o.acc.mustache) S('path', { d: 'M-22,20 Q-10,10 0,18 Q10,10 22,20 Q10,24 0,20 Q-10,24 -22,20 Z', fill: hc, ...MS.OL(3) }, P.head);
    if (o.acc.beard) S('path', { d: 'M-46,10 Q-40,64 0,64 Q40,64 46,10 Q30,40 0,40 Q-30,40 -46,10 Z', fill: hc, ...MS.OL(4) }, P.head);
    if (o.acc.glasses) { S('circle', { cx: -18, cy: -2, r: 14, fill: 'none', ...MS.OL(4) }, P.head); S('circle', { cx: 18, cy: -2, r: 14, fill: 'none', ...MS.OL(4) }, P.head); S('line', { x1: -4, y1: -2, x2: 4, y2: -2, ...MS.OL(4) }, P.head); }
    const hcol = o.acc.hatColor || '#E63946', hat = o.acc.hat;
    if (hat === 'cap') { S('path', { d: 'M-50,-20 Q0,-80 50,-20 Z', fill: hcol, ...OL }, P.head); S('path', { d: 'M20,-24 L80,-20 Q78,-10 20,-14 Z', fill: hcol, ...MS.OL(4) }, P.head); }
    if (hat === 'akubra') { S('ellipse', { cx: 0, cy: -34, rx: 84, ry: 14, fill: hcol, ...OL }, P.head); S('path', { d: 'M-44,-36 Q-40,-86 0,-84 Q40,-86 44,-36 Z', fill: hcol, ...OL }, P.head); S('rect', { x: -44, y: -48, width: 88, height: 10, fill: '#3A2A20' }, P.head); }
    if (hat === 'conical') S('path', { d: 'M-90,-26 L0,-96 L90,-26 Q0,-14 -90,-26 Z', fill: hcol, ...OL }, P.head);
    if (hat === 'sombrero') { S('ellipse', { cx: 0, cy: -34, rx: 110, ry: 20, fill: hcol, ...OL }, P.head); S('path', { d: 'M-36,-36 Q-30,-110 0,-110 Q30,-110 36,-36 Z', fill: hcol, ...OL }, P.head); }
    if (hat === 'beret') S('path', { d: 'M-52,-30 Q-50,-74 6,-72 Q60,-66 50,-30 Q0,-40 -52,-30 Z M4,-72 l4,-12', fill: hcol, ...OL }, P.head);
    if (hat === 'hachimaki') { S('rect', { x: -52, y: -32, width: 104, height: 14, rx: 4, fill: '#fff', ...MS.OL(4) }, P.head); S('circle', { cx: 0, cy: -25, r: 6, fill: '#E63946' }, P.head); }
    if (hat === 'tophat') { S('rect', { x: -36, y: -120, width: 72, height: 80, rx: 6, fill: hcol, ...OL }, P.head); S('ellipse', { cx: 0, cy: -40, rx: 60, ry: 10, fill: hcol, ...OL }, P.head); }
    let rs = 3;
    P.draw = function (s, t) {
      const flip = s.flip ?? 1, sc = (s.scale ?? o.scale), ps = s.pose || 'stand';
      let bob = 0, torsoRot = 0, headY = -252;
      const walk = ps === 'walk' || ps === 'run', ph = t * (ps === 'run' ? 16 : 8);
      if (walk) bob = -Math.abs(Math.sin(ph)) * (ps === 'run' ? 14 : 6);
      if (ps === 'jump' || ps === 'cheer') bob = -Math.abs(Math.sin(t * 7)) * (ps === 'jump' ? 60 : 12);
      if (ps === 'bow') torsoRot = 32 * (s.bowAmt ?? 1);
      const sit = ps === 'sit';
      P.root.setAttribute('transform', `translate(${s.x},${s.y + bob}) scale(${flip * sc},${sc})`);
      at(P.shadow, { cx: s.x, cy: (s.ground ?? s.y) + 3, rx: 46 * sc }); show(P.shadow, s.shadow !== false);
      P.torso.setAttribute('transform', `${sit ? 'translate(0,50)' : ''} rotate(${torsoRot} 0 -100)`);
      P.legs.forEach((l, i) => { const hx = i ? 16 : -16; let fx = hx * 1.1, fy = 0; if (walk) { const q = Math.sin(ph + i * Math.PI); fx += q * (ps === 'run' ? 34 : 20); fy = -Math.max(0, -Math.cos(ph + i * Math.PI)) * 16; } if (sit) { fx = hx + 40; fy = -10; } const d = sit ? `M${hx},-50 L${fx},${-50} L${fx},${fy}` : `M${hx},-90 L${fx},${fy - 8}`; l.o.setAttribute('d', d); l.i.setAttribute('d', d); at(l.shoe, { cx: fx + 6, cy: fy - 4 }); });
      const rest = { stand: [[-46, -110], [46, -110]], walk: [[-46 + Math.sin(ph) * 14, -110], [46 - Math.sin(ph) * 14, -110]], run: [[-50 + Math.sin(ph) * 26, -130], [50 - Math.sin(ph) * 26, -130]], bow: [[-30, -110], [30, -110]], wave: [[-46, -110], [64 + Math.sin(t * 12) * 18, -250]], cheer: [[-70, -260], [70, -260]], point: [[-46, -110], [96, -190]], shrug: [[-80, -170], [80, -170]], sit: [[-40, -110], [40, -110]], jump: [[-70, -250], [70, -250]], clap: [[-6 + Math.abs(Math.sin(t * 14)) * -24, -170], [6 + Math.abs(Math.sin(t * 14)) * 24, -170]] }[ps] || [[-46, -110], [46, -110]];
      const arms = [s.armL || rest[0], s.armR || rest[1]];
      P.arms.forEach((a, i) => { const sx = i ? 36 : -36, sy = -186, h = arms[i], d = `M${sx},${sy} Q${(sx + h[0]) / 2 + (i ? 10 : -10)},${(sy + h[1]) / 2 + 10} ${h[0]},${h[1]}`; a.o.setAttribute('d', d); a.i.setAttribute('d', d); at(a.h, { cx: h[0], cy: h[1] }); });
      P.head.setAttribute('transform', `translate(0,${headY}) rotate(${(s.headRot || 0) + (s.talk ? Math.sin(t * 11) * 3 : 0)}) scale(${flip < 0 ? -1 : 1},1)`);
      const e = s.eyes || 'open', blink = ((t + (s.x % 7)) % 3.3) < .12;
      P.eyes.forEach((q, i) => { show(q.open, (e === 'open' || e === 'wide' || e === 'angry' || e === 'sad') && !blink); show(q.closed, e === 'closed' || (e === 'open' && blink)); show(q.happy, e === 'happy'); at(q.open, { rx: e === 'wide' ? 8 : 6, ry: e === 'wide' ? 10 : 8, cx: (i ? 18 : -18) + (s.look || 0) * 4 }); const tilt = e === 'angry' ? 5 : e === 'sad' ? -5 : 0, by = e === 'wide' ? -24 : -18; at(q.brow, { y1: by + (i ? tilt : -tilt), y2: by + (i ? -tilt : tilt) }); });
      P.blush.forEach(b => show(b, !!s.blush || e === 'happy'));
      const talk = s.talk || 0; show(P.mouth, talk > .1 || e === 'wide'); show(P.smile, talk <= .1 && e !== 'wide'); at(P.mouth, { ry: e === 'wide' && talk <= .1 ? 8 : 3 + talk * 12 });
      P.smile.setAttribute('d', e === 'sad' || e === 'angry' ? 'M-14,30 Q0,20 14,30' : 'M-14,24 Q0,34 14,24');
      return { head: [s.x, s.y + bob + headY * sc] };
    };
    return P;
  };
})(typeof window !== 'undefined' ? window : globalThis);
