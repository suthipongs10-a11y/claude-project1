// MOTION STUDIO — original music + cartoon SFX + voice mix (pure JS synthesis, no samples).
// Usage: node kit/audio.cjs   (reads ./story.js and ./lipsync.js, writes ./score.wav)
// story.js must export: DURATION, VO: [[id, t]], SFX: [{type, t, ...}], MUSIC: [{a, b, style, key, scale, lead, bpm, drone}]
const fs = require('fs'), path = require('path');
const ST = require(path.resolve('story.js'));
const LIPS = fs.existsSync('lipsync.js') ? require(path.resolve('lipsync.js')) : {};
const SR = 48000, DUR = Math.ceil(ST.DURATION) + 1, LEN = SR * DUR;
const bus = () => [new Float32Array(LEN), new Float32Array(LEN)];
const MUS = bus(), SFXB = bus(), VOB = bus(), REV = bus();
let seed = 11; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
let cur = SFXB;
function put(i, v, pan = 0, send = 0) { if (i < 0 || i >= LEN) return; const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4); cur[0][i] += v * gl; cur[1][i] += v * gr; if (send) { REV[0][i] += v * gl * send; REV[1][i] += v * gr * send; } }
function render(t, dur, fn, pan = 0, send = 0) { const i0 = Math.round(t * SR), n = Math.round(dur * SR); for (let k = 0; k < n; k++) put(i0 + k, fn(k / SR, k), typeof pan === 'function' ? pan(k / SR) : pan, send); }
function svf() { let low = 0, band = 0; return (x, fc, q = .7) => { const F = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR); low += F * band; const high = x - low - q * band; band += F * high; return { low, band, high }; }; }
function osc() { let ph = 0; return f => { ph += f / SR; ph -= Math.floor(ph); return ph; }; }
// ---------- instruments ----------
const sweep = (t, d, f0, f1, g, shape = 'sin', vib = 0, vr = 0, pan = 0, send = .2) => { const o = osc(); render(t, d, x => { const p = x / d, f = f0 * Math.pow(f1 / f0, p) * (1 + vib * Math.sin(2 * Math.PI * vr * x)); const ph = o(f); const s = shape === 'sq' ? (ph < .5 ? .5 : -.5) : shape === 'saw' ? ph * 2 - 1 : Math.sin(2 * Math.PI * ph); return s * g * Math.min(1, x * 300) * Math.min(1, (d - x) * 60); }, pan, send); };
function noiseHit(t, dur, fc, q, g, decay, pan = 0, send = 0, mode = 'band') { const f = svf(); render(t, dur, x => f(rnd(), fc, q)[mode] * Math.exp(-x * decay) * g, pan, send); }
function whoosh(t, d, g = .3, f0 = 300, f1 = 5000) { const f = svf(); render(t, d, x => { const p = x / d; return f(rnd(), f0 * Math.pow(f1 / f0, p), .5).band * Math.sin(Math.PI * Math.pow(p, 1.3)) * g; }, x => (x / d - .5) * 1.2, .3); }
const I = {};
I.glock = (t, n, g = .12, pan = 0, dec = 2.5) => { const f = mtof(n); render(t, 2, x => (Math.sin(2 * Math.PI * f * x) + .35 * Math.sin(2 * Math.PI * f * 2.76 * x) * Math.exp(-x * 6)) * Math.exp(-x * dec) * Math.min(1, x * 800) * g, pan, .5); };
I.xylo = (t, n, g = .14, pan = 0) => { const f = mtof(n); render(t, .6, x => (Math.sin(2 * Math.PI * f * x) + .5 * Math.sin(2 * Math.PI * f * 3.9 * x) * Math.exp(-x * 30)) * Math.exp(-x * 9) * Math.min(1, x * 2000) * g, pan, .25); };
I.ks = (t, n, dur, g = .3, pan = 0, damp = .994, bright = .4, send = .15) => { const f = mtof(n), N = Math.max(2, Math.round(SR / f)), buf = new Float32Array(N); for (let i = 0; i < N; i++) buf[i] = rnd() * (1 - bright) + rnd() * bright; let idx = 0, last = 0; const i0 = Math.round(t * SR), len = Math.round(dur * SR); for (let k = 0; k < len; k++) { const v = buf[idx]; buf[idx] = (v + last) * .5 * damp; last = v; idx = (idx + 1) % N; put(i0 + k, v * g * (k > len - 400 ? (len - k) / 400 : 1), pan, send); } };
I.koto = (t, n, g = .2, pan = 0) => { I.ks(t, n, 1.4, g, pan, .998, .8, .4); };
I.uke = (t, notes, g = .08, pan = .2) => notes.forEach((n, j) => I.ks(t + j * .014, n, .5, g, pan, .985, .7, .15));
I.reed = (t, dur, n, g = .05, fc = 1200, pan = 0, vib = .006) => { const o = osc(), f = svf(), fr = mtof(n); render(t, dur + .05, x => { const s = o(fr * (1 + vib * Math.sin(2 * Math.PI * 5.5 * x) * Math.min(1, x * 3))) < .5 ? 1 : -1; return f(s, fc, .6).low * g * Math.min(1, x * 40) * Math.min(1, (dur + .05 - x) * 25); }, pan, .3); };
I.brass = (t, dur, n, g = .06, pan = 0) => { const os = [osc(), osc()], f = svf(), fr = mtof(n); render(t, dur + .06, x => { const s = (os[0](fr) + os[1](fr * 1.004)) - 1; return f(s, 600 + 2600 * Math.min(1, x * 12) * Math.exp(-x * 1.5), .5).low * g * Math.min(1, x * 50) * Math.min(1, (dur + .06 - x) * 20); }, pan, .35); };
I.pad = (t, dur, notes, g = .03, fc = 1000) => notes.forEach((n, j) => { const os = [osc(), osc(), osc()], fl = svf(), f = mtof(n); render(t, dur + .6, x => { const s = (os[0](f) + os[1](f * 1.006) + os[2](f * .995)) / 1.5 - 1; return fl(s, fc).low * Math.min(1, x / .4) * (x > dur ? Math.max(0, 1 - (x - dur) / .6) : 1) * g; }, (j - 1) * .35, .6); });
I.drone = (t, dur, n, g = .05, fc = 500) => { const o = osc(), o2 = osc(), fl = svf(), f = mtof(n); render(t, dur, x => fl((o(f) + o2(f * 1.5)) - 1, fc + 200 * Math.sin(x * 2)).low * g * Math.min(1, x * 2) * Math.min(1, (dur - x) * 2), 0, .3); };
I.timp = (t, n, g = .5) => { const f = mtof(n); render(t, 1.2, x => (Math.sin(2 * Math.PI * f * x * (1 + .03 * Math.exp(-x * 20))) * .8 + rnd() * .15 * Math.exp(-x * 30)) * Math.exp(-x * 3.5) * g, 0, .4); };
I.kick = (t, g = .5) => { const o = osc(); render(t, .3, x => Math.sin(2 * Math.PI * o(50 + 90 * Math.exp(-x * 30))) * Math.exp(-x * 9) * g); };
I.snare = (t, g = .15) => noiseHit(t, .15, 3000, .6, g, 22, .1, .2);
I.shaker = (t, g = .04) => noiseHit(t, .07, 7000, .5, g, 60, .3, 0, 'high');
I.wood = (t, g = .12, p = 1) => render(t, .07, x => (Math.sin(2 * Math.PI * 900 * p * x) + .5 * Math.sin(2 * Math.PI * 1400 * p * x)) * Math.exp(-x * 70) * g, .2, .1);
I.cymbal = (t, g = .25) => noiseHit(t, 2, 8000, .3, g, 2.2, 0, .5, 'high');
I.claps = (t, g = .2) => [0, .01, .022].forEach(o => noiseHit(t + o, .12, 1500, .5, g, 40, 0, .3));
// ---------- SFX catalog (type names used in story.js SFX) ----------
function meow(t, d = .65, f0s = [480, 760, 420], g = .3, trill = 0) { const o = osc(), f1 = svf(), f2 = svf(); render(t, d, x => { const p = x / d, f0 = p < .35 ? f0s[0] + (f0s[1] - f0s[0]) * (p / .35) : f0s[1] + (f0s[2] - f0s[1]) * ((p - .35) / .65); const src = o(f0 * (1 + .015 * Math.sin(x * 38))) * 2 - 1; const F1 = p < .3 ? 300 + 1500 * p : p < .7 ? 750 : 750 - 900 * (p - .7), F2 = p < .3 ? 2300 - 1000 * (p / .3) : p < .7 ? 1300 : 1300 - 1300 * (p - .7); return (f1(src, F1, .25).band + f2(src, F2, .25).band * .7) * Math.min(1, x / .06) * Math.pow(Math.sin(Math.PI * Math.min(1, p * 1.05)), .5) * (trill ? .6 + .4 * Math.sin(2 * Math.PI * trill * x) : 1) * g; }, .1, .35); }
const SFX = {
  pop: c => { sweep(c.t, .07, 1100 * (c.p || 1), 260 * (c.p || 1), .45, 'sin', 0, 0, 0, .2); noiseHit(c.t, .02, 3000, .5, .2, 200); },
  boing: c => sweep(c.t, .6, 180 / (c.p || 1), 240 / (c.p || 1), .3, 'sin', .25, 16),
  whoosh: c => whoosh(c.t, c.d || .4, .35), zip: c => sweep(c.t, .15, 600, 2600, .1), zoom: c => { whoosh(c.t, .5, .4, 200, 5000); sweep(c.t, .4, 300, 1800, .08); },
  ding: c => { I.glock(c.t, 88 + 12 * Math.log2(c.p || 1), .25, .2, 3); I.glock(c.t + .1, 95 + 12 * Math.log2(c.p || 1), .1, .2, 4); },
  twinkle: c => [96, 100, 103, 108].forEach((n, i) => I.glock(c.t + i * .05, n, .07, .5, 6)),
  thunk: c => { sweep(c.t, .25, 160, 60, .6); noiseHit(c.t, .15, 600, .5, .5, 20); },
  bonk: c => { sweep(c.t, .25, 300 * (c.p || 1), 120, .5); noiseHit(c.t, .1, 900, .5, .5, 30); I.xylo(c.t, 60, .15); },
  land: c => sweep(c.t, .15, 140, 60, .4 * (c.g || 1)), hop: c => sweep(c.t, .15, 300, 750, .15),
  slideUp: c => sweep(c.t, c.d || .5, 400, 1600, .1), slideDown: c => sweep(c.t, c.d || .5, 1600, 400, .1),
  tiptoe: c => I.ks(c.t, c.p ? 60 : 55, .25, .22, 0, .97, .2),
  scurry: c => { for (let x = 0; x < (c.d || 1); x += 1 / 14) noiseHit(c.t + x, .03, 900 + Math.abs(rnd()) * 900, .5, .2, 80, Math.sin(x * 3) * .6); },
  skid: c => { const o = osc(), f = svf(), d = c.d || .5; render(c.t, d, x => f(o(1800 - 600 * x / d) * 2 - 1 + rnd() * .5, 2500, .3).band * .25 * Math.min(1, (d - x) * 10), 0, .2); },
  crash: c => { noiseHit(c.t, .8, 400, .5, 1.0, 6, 0, .5); sweep(c.t, .4, 120, 40, .7); I.cymbal(c.t, .3); },
  glass: c => { noiseHit(c.t, .6, 6000, .4, .7, 7, 0, .4, 'high'); for (let i = 0; i < 12; i++) render(c.t + .05 + Math.abs(rnd()) * .6, .3, x => Math.sin(2 * Math.PI * (2500 + Math.abs(rnd()) * 3000) * x) * Math.exp(-x * 18) * .08, rnd() * .8, .3); },
  clang: c => [[520, .35], [1340, .22], [2210, .14], [3300, .08]].forEach(([f, a]) => render(c.t, 1.0, x => Math.sin(2 * Math.PI * f * (c.p || 1) * x) * Math.exp(-x * 5) * a, rnd() * .5, .4)),
  splash: c => { noiseHit(c.t, .8, 1800, .3, .8, 5, 0, .4); for (let i = 0; i < 8; i++) sweep(c.t + .1 + Math.abs(rnd()) * .5, .06, 900 + Math.abs(rnd()) * 900, 1800, .05); },
  bubble: c => { for (let i = 0; i < (c.n || 5); i++) sweep(c.t + i * .09, .07, 500 + Math.abs(rnd()) * 600, 1400, .08); },
  sizzle: c => { const f = svf(), d = c.d || 1.5; render(c.t, d, x => f(rnd(), 6000, .5).high * .12 * (Math.abs(rnd()) > .7 ? 1.5 : .6) * Math.min(1, (d - x) * 4), .2, .1); },
  eat: c => { for (let x = 0; x < (c.d || 1); x += .14) noiseHit(c.t + x, .06, 2000, .5, .25, 50, .2); },
  slurp: c => sweep(c.t, c.d || .6, 300, 1200, .12, 'sin', .2, 30),
  ahh: c => sweep(c.t, c.d || 1, 500, 380, .05, 'saw', .02, 5, 0, .4),
  spicy: c => { sweep(c.t, .5, 400, 2000, .1, 'sin', .1, 20); noiseHit(c.t + .3, 1.2, 4000, .4, .3, 2, 0, .3, 'high'); },
  steam: c => { const f = svf(), d = c.d || 1; render(c.t, d, x => f(rnd(), 5000, .6).high * .12 * Math.min(1, x * 10) * Math.min(1, (d - x) * 4), .3, .2); },
  beepHappy: c => [84, 88, 91].forEach((n, i) => sweep(c.t + i * .08, .07, mtof(n), mtof(n), .1, 'sq', 0, 0, .1, .2)),
  beepQ: c => { sweep(c.t, .12, 700, 700, .09, 'sq'); sweep(c.t + .16, .22, 700, 1150, .09, 'sq'); },
  beepSad: c => { sweep(c.t, .3, 700, 500, .07, 'sq'); sweep(c.t + .32, .5, 500, 300, .07, 'sq'); },
  beepAlarm: c => { for (let i = 0; i < 4; i++) sweep(c.t + i * .09, .08, i % 2 ? 900 : 1300, i % 2 ? 900 : 1300, .08, 'sq'); },
  scan: c => sweep(c.t, c.d || 1.5, 900, 1300, .05, 'sin', .15, 11, .2, .3),
  compute: c => { for (let x = 0; x < (c.d || 1.5); x += 1 / 16) sweep(c.t + x, .04, 800 + Math.abs(rnd()) * 1400, 900 + Math.abs(rnd()) * 1400, .045, 'sq', 0, 0, rnd() * .4); },
  giggle: c => { for (let i = 0; i < 9; i++) sweep(c.t + i * .1, .06, i % 2 ? 1000 : 1350, i % 2 ? 1100 : 1450, .07, 'sq', 0, 0, -.2); },
  zap: c => { const o = osc(), d = c.d || .7; render(c.t, d, x => ((o(60 + 30 * Math.sin(x * 40)) < .5 ? 1 : -1) * .12 + (Math.abs(rnd()) > .97 ? rnd() * .8 : 0)) * Math.exp(-x * 2.5), 0, .2); },
  powerDown: c => sweep(c.t, .6, 800, 180, .08, 'sq'), powerUp: c => sweep(c.t, c.d || 1, 200, 1600, .1, 'saw', .03, 12, 0, .4),
  dizzy: c => sweep(c.t, c.d || 1, 1200, 300, .08, 'sin', .1, 8),
  meow: c => meow(c.t), mrrp: c => meow(c.t, .35, [420, 620, 560], .25, 26), yawn: c => meow(c.t, 1.0, [300, 420, 240], .22),
  hiss: c => { const f = svf(), d = c.d || .6; render(c.t, d, x => f(rnd(), 4000, .5).high * .25 * Math.min(1, x * 20) * Math.min(1, (d - x) * 6), .1, .1); },
  purr: c => { const f = svf(), d = c.d || 2; render(c.t, d, x => f(rnd(), 180, .4).low * Math.pow(.5 + .5 * Math.sin(2 * Math.PI * 24 * x), 3) * (.55 + .45 * Math.sin(2 * Math.PI * x / 1.6)) * 2.1 * Math.min(1, x / .4) * Math.min(1, (d - x) / .5), 0, .2); },
  snore: c => { for (let i = 0; i < Math.round((c.d || 3) / 1.4); i++) { const t0 = c.t + i * 1.4, f = svf(); render(t0, .9, x => f(rnd(), 300 + 200 * Math.sin(Math.PI * x / .9), .3).band * Math.sin(Math.PI * x / .9) * .5, .3, .1); } },
  tweet: c => { for (let x = 0; x < (c.d || 2); x += .38) { sweep(c.t + x, .08, 3200, 4200, .035, 'sin', 0, 0, .3); sweep(c.t + x + .1, .08, 3600, 4600, .03, 'sin', 0, 0, -.3); } },
  crowdCheer: c => { const a = svf(), b = svf(), d = c.d || 2; render(c.t, d, x => (a(rnd(), 800, .15).band + .6 * b(rnd(), 1600, .15).band) * Math.sin(Math.PI * Math.min(1, x / d)) * .5, 0, .5); },
  crowdLaugh: c => { const a = svf(), d = c.d || 1.5; render(c.t, d, x => a(rnd(), 750, .15).band * (.55 + .45 * Math.sin(2 * Math.PI * 6.5 * x)) * Math.sin(Math.PI * x / d) * .5, 0, .5); },
  gong: c => [[110, .4], [220, .2], [331, .14], [497, .08]].forEach(([f, a]) => render(c.t, 3, x => Math.sin(2 * Math.PI * f * x * (1 + .01 * Math.sin(x * 4))) * Math.exp(-x * 1.2) * a, 0, .6)),
  bell: c => [1, 2.4, 3.9].forEach((m, i) => render(c.t, 2, x => Math.sin(2 * Math.PI * 620 * (c.p || 1) * m * x) * Math.exp(-x * (2 + i)) * .18 / (i + 1), 0, .5)),
  clap: c => I.claps(c.t, .3), drumroll: c => { for (let x = 0; x < (c.d || 1.5); x += .04) I.snare(c.t + x, .04 + x * .05); },
  tada: c => { [72, 76, 79, 84].forEach((n, i) => I.glock(c.t + i * .07, n + 12, .13, 0)); I.uke(c.t + .28, [60, 64, 67, 72], .1); },
  sadTrombone: c => [[55, .35], [54, .35], [53, .35], [52, 1.0]].forEach(([n, d], i) => I.brass(c.t + i * .36, d, n, .1)),
  fanfare: c => { [[60, 0, .15], [64, .16, .15], [67, .32, .15], [72, .5, .9]].forEach(([n, o, d]) => { I.brass(c.t + o, d, n, .1, -.2); I.brass(c.t + o, d, n + 4, .07, .2); }); I.timp(c.t + .5, 36, .6); I.cymbal(c.t + .5, .25); },
  iris: c => sweep(c.t, c.d || 1.2, 1600, 300, .07), camera: c => { noiseHit(c.t, .05, 4000, .5, .4, 60); noiseHit(c.t + .07, .08, 2500, .5, .3, 40); },
  footsteps: c => { for (let x = 0; x < (c.d || 1); x += c.step || .25) I.wood(c.t + x, .06, .7); },
  water: c => { const f = svf(), d = c.d || 2; render(c.t, d, x => f(rnd(), 1200 + 600 * Math.sin(x * 3), .5).band * .1 * Math.min(1, x * 3) * Math.min(1, (d - x) * 3), 0, .3); },
  wind: c => { const f = svf(), d = c.d || 2; render(c.t, d, x => f(rnd(), 500 + 400 * Math.sin(x * 1.3), .7).band * .15 * Math.min(1, x * 2) * Math.min(1, (d - x) * 2), x => Math.sin(x), .3); },
};
// ---------- MUSIC: sections {a,b,style,key,scale,lead,bpm,drone} ----------
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], pent: [0, 2, 4, 7, 9], japan: [0, 1, 5, 7, 8], hijaz: [0, 1, 4, 5, 7, 8, 10], blues: [0, 3, 5, 6, 7, 10], thai: [0, 2, 4, 7, 9] };
const PROG = { major: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], minor: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]] };
function music(sec, si) {
  const key = sec.key ?? 60, sc = SCALES[sec.scale || 'major'], prog = PROG[sec.scale === 'minor' || sec.scale === 'hijaz' || sec.scale === 'japan' ? 'minor' : 'major'];
  const B = 60 / (sec.bpm || 116), bar = 4 * B, st = sec.style || 'chill';
  const deg = d => key + sc[((d % sc.length) + sc.length) % sc.length] + 12 * Math.floor(d / sc.length);
  seed = 1000 + si * 77; const motif = Array.from({ length: 8 }, (_, i) => (i % 2 && Math.abs(rnd()) < .35) ? null : Math.round(rnd() * 4) + 4);
  const lead = sec.lead || (st === 'lullaby' ? 'glock' : 'glock');
  const playLead = (t, n, d) => lead === 'koto' ? I.koto(t, n, .14) : lead === 'xylo' ? I.xylo(t, n, .12) : lead === 'reed' ? I.reed(t, d, n, .045, 1400) : lead === 'brass' ? I.brass(t, d, n, .05) : I.glock(t, n, .1);
  let bi = 0;
  for (let t0 = sec.a; t0 < sec.b - .05; t0 += bar, bi++) {
    const ch = prog[bi % 4].map(x => key + x), root = ch[0] - 24;
    if (sec.drone && bi % 2 === 0) I.drone(t0, Math.min(bar * 2, sec.b - t0), key - 24, .045);
    for (let b = 0; b < 4; b++) {
      const tb = t0 + b * B; if (tb >= sec.b) break;
      if (st === 'chill' || st === 'travel') { I.ks(tb, root + (b % 2 ? 7 : 0), .35, .26, -.15, .985, .3); I.uke(tb + B / 2, ch.map(n => n), .07); I.shaker(tb + B / 2); if (st === 'travel') { I.shaker(tb + B / 4, .02); if (b % 2) I.wood(tb, .08); } }
      if (st === 'tiptoe') I.ks(tb, root + 12 + [0, 4, 7, 8][b], .2, .35, 0, .97, .2);
      if (st === 'chase') { I.ks(tb, root, .2, .3); I.ks(tb + B / 2, root + 12, .2, .22); if (b % 2) I.snare(tb, .12); I.shaker(tb + B / 2, .05); for (let s = 0; s < 4; s++) I.xylo(tb + s * B / 4, ch[s % 3] + 12 + s * 2, .06, Math.sin(s) * .5); }
      if (st === 'lullaby') { I.glock(tb, ch[b % 3] + 12, .06, (b - 1.5) * .3, 1.6); }
      if (st === 'fanfare' && (b === 0 || b === 2)) ch.forEach((n, j) => I.brass(tb, .3, n, .035, (j - 1) * .3));
      if (st === 'groove') { I.kick(tb, .4); if (b % 2) I.claps(tb, .12); I.shaker(tb + B / 2); I.ks(tb, root, .3, .25); }
    }
    if (st !== 'tiptoe' && st !== 'lullaby' && st !== 'groove') for (let e = 0; e < 8; e++) { const d = motif[(e + bi * 3) % 8]; if (d !== null && t0 + e * B / 2 < sec.b) playLead(t0 + e * B / 2, deg(d + (bi % 4 === 3 ? 2 : 0)) + 12, B / 2 * .9); }
    if (st === 'lullaby' || st === 'chill') I.pad(t0, Math.min(bar, sec.b - t0), ch, st === 'lullaby' ? .022 : .016, 900);
  }
}
cur = MUS; (ST.MUSIC || []).forEach((s, i) => music(s, i));
cur = SFXB; (ST.SFX || []).forEach(c => { if (SFX[c.type]) SFX[c.type](c); else console.warn('unknown sfx', c.type); });
// ---------- voices ----------
cur = VOB;
function readWav(f) { const b = fs.readFileSync(f); let o = 12, data = null; while (o < b.length) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4); if (id === 'data') { data = b.subarray(o + 8, o + 8 + sz); break; } o += 8 + sz; } const n = data.length / 2, out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = data.readInt16LE(i * 2) / 32768; return out; }
const venv = new Float32Array(LEN);
(ST.VO || []).forEach(([id, t, opt = {}]) => { const f = `vo/${id}.wav`; if (!fs.existsSync(f)) return console.warn('missing', f); const x = readWav(f), i0 = Math.round(t * SR), lp = svf(), who = (LIPS[id] || {}).who; const pan = opt.pan ?? (who === 'B' ? -.12 : who === 'M' ? .12 : 0); for (let k = 0; k < x.length; k++) { let v = x[k]; if (opt.muffle) v = lp(v, 600, .7).low * 1.6; put(i0 + k, v, pan, .06); if (i0 + k < LEN) venv[i0 + k] = 1; } });
let ev = 0; const duck = new Float32Array(LEN); for (let i = 0; i < LEN; i++) { ev = venv[i] > ev ? ev + (1 - ev) * .003 : ev * .99996; duck[i] = 1 - .55 * ev; }
function reverb(inp, off) { const out = new Float32Array(LEN); const cs = [1557, 1617, 1491, 1422].map(d => ({ d: d + off, b: new Float32Array(d + off), i: 0, f: 0 })); const ap = [225, 556].map(d => ({ d, b: new Float32Array(d), i: 0 })); for (let n = 0; n < LEN; n++) { let s = 0; const x = inp[n]; for (const c of cs) { const y = c.b[c.i]; c.f = y * .7 + c.f * .3; c.b[c.i] = x + c.f * .78; c.i = (c.i + 1) % c.d; s += y; } for (const a of ap) { const y = a.b[a.i]; const v = -s + y; a.b[a.i] = s + y * .5; a.i = (a.i + 1) % a.d; s = v; } out[n] = s * .18; } return out; }
const rl = reverb(REV[0], 0), rr = reverb(REV[1], 23);
const L = new Float32Array(LEN), R = new Float32Array(LEN); let peak = 0;
for (let n = 0; n < LEN; n++) { L[n] = Math.tanh(MUS[0][n] * .75 * duck[n] + SFXB[0][n] * .9 + VOB[0][n] * 1.1 + rl[n]); R[n] = Math.tanh(MUS[1][n] * .75 * duck[n] + SFXB[1][n] * .9 + VOB[1][n] * 1.1 + rr[n]); peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n])); }
const norm = .92 / (peak || 1), fadeA = Math.round((ST.DURATION - 1.2) * SR);
const buf = Buffer.alloc(44 + LEN * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + LEN * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(LEN * 4, 40);
for (let n = 0; n < LEN; n++) { const f = n > fadeA ? Math.max(0, 1 - (n - fadeA) / (1.2 * SR)) : 1; buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[n] * norm * f)) * 32767), 44 + n * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[n] * norm * f)) * 32767), 46 + n * 4); }
fs.writeFileSync('score.wav', buf); console.log('score.wav ok, peak', peak.toFixed(2), 'sfx types:', Object.keys(SFX).length);
module.exports = { SFX_TYPES: Object.keys(SFX) };
