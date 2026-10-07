// MOTION STUDIO — engine: easing, keyframes, SVG helpers. Works in browser (window.MS) and node (require).
(function (root) {
  const MS = root.MS = root.MS || {};
  MS.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  MS.lerp = (a, b, p) => a + (b - a) * p;
  MS.E = {
    lin: x => x, io: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2, in: x => x * x * x, out: x => 1 - Math.pow(1 - x, 3),
    expoIn: x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10), expoOut: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
    back: (x, s = 1.7) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
    el: x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * 2 * Math.PI / 3) + 1,
  };
  const { clamp, lerp, E } = MS;
  // K: keyframes [[t, value, ease?], ...] value = number or array. Duplicate times = hard cut.
  MS.K = function (keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) { const [t1, v1, e] = keys[i]; if (t <= t1) { const [t0, v0] = keys[i - 1]; if (t1 - t0 < 1e-6) return v1; const p = E[e || 'io'](clamp((t - t0) / (t1 - t0))); return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], p)) : v0 + (v1 - v0) * p; } }
    return keys[keys.length - 1][1];
  };
  MS.step = (list, t) => { let v = list[0][1]; for (const [a, b] of list) if (t >= a) v = b; return v; };
  // sq: squash/stretch impulses [[t, amp]] -> damped spring value
  MS.sq = (ev, t) => ev.reduce((s, [a, amp]) => t >= a ? s + amp * Math.exp(-(t - a) * 7) * Math.cos((t - a) * 22) : s, 0);
  MS.wobble = (ev, t, f = 26, d = 5) => ev.reduce((s, [a, amp]) => t > a ? s + amp * Math.exp(-(t - a) * d) * Math.sin((t - a) * f) : s, 0);
  MS.pop = (t, t0, d = .25) => { const k = (t - t0) / d; return k <= 0 ? 0 : k >= 1 ? 1 : E.back(k, 2); };
  MS.seeded = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  MS.shake = (list, t) => { let x = 0, y = 0; list.forEach(([a, amp]) => { if (t > a && t < a + .5) { const d = Math.exp(-(t - a) * 9) * amp; x += Math.sin((t - a) * 85) * d; y += Math.cos((t - a) * 67) * d; } }); return [x, y]; };

  // ---------- browser-only SVG helpers ----------
  if (typeof document !== 'undefined') {
    const NS = 'http://www.w3.org/2000/svg';
    MS.S = (tag, a, p) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
    MS.at = (e, a) => { for (const k in a) e.setAttribute(k, a[k]); };
    MS.show = (e, on) => { e.style.display = on ? '' : 'none'; };
    MS.T = (p, x, y, s, size, fill, extra = {}) => { const e = MS.S('text', Object.assign({ x, y, 'font-size': size, fill, 'text-anchor': 'middle', 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, extra), p); e.textContent = s; return e; };
    MS.drawOn = (el, p) => { if (!el._len) { el._len = el.getTotalLength() + 1; el.style.strokeDasharray = el._len; } el.style.strokeDashoffset = el._len * (1 - clamp(p)); };
    MS.PL = '#2B2340';
    MS.OL = (w = 6) => ({ stroke: MS.PL, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    // canvas size from URL (?w=1080&h=1920 for vertical)
    const q = new URLSearchParams(location.search);
    MS.W = +(q.get('w') || 1920); MS.H = +(q.get('h') || 1080); MS.VERTICAL = MS.H > MS.W;
    MS.uid = (() => { let n = 0; return p => (p || 'u') + (n++); })();
  }
  if (typeof module !== 'undefined') module.exports = MS;
})(typeof window !== 'undefined' ? window : globalThis);
