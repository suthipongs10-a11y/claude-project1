# render_preview.py — ประกอบฉาก Vox-style + เรนเดอร์ MP4 (1080x1920, 30fps)
# ใช้: python3 render_preview.py --stills   (เช็คภาพนิ่งท้ายฉาก)
#      python3 render_preview.py out.mp4    (เรนเดอร์วิดีโอเต็ม)
import math
import random
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from vox_style import (PAPER, INK, SEA, SEA_LT, SAGE, MUSTARD, RED, LABEL,
                       font, paper_texture, torn_strip, label_paper,
                       hand_ellipse_points, hand_arrow_points, draw_stroke,
                       crab_illustration, boat_illustration, pot_illustration,
                       alaska_map, DUTCH_HARBOR, snow_crab_swarm, clock_icon,
                       hook_icon, down_icon, thermo_icon)

W, H, FPS = 1080, 1920, 30
HERE = Path(__file__).parent


# ---------- element helpers ----------
def text_ink(text, size, color=INK, rules=False, align="center"):
    """ข้อความหมึกบนพื้นโปร่ง (สไตล์พาดหัว) + เส้นบน-ล่างแบบ '260 YEARS'"""
    f = font(size)
    lines = text.split("\n")
    tw = max(f.getbbox(t)[2] for t in lines)
    lh = f.getbbox("Ag")[3] + 14
    th = lh * len(lines)
    pad = 26
    img = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    y = pad
    for t in lines:
        x = pad + ((tw - f.getbbox(t)[2]) // 2 if align == "center" else 0)
        d.text((x, y), t, font=f, fill=color)
        y += lh
    if rules:
        d.line([(pad - 8, pad - 6), (tw + pad + 8, pad - 6)], fill=color, width=6)
        d.line([(pad - 8, th + pad + 10), (tw + pad + 8, th + pad + 10)], fill=color, width=6)
    return img


def ease_out(t):
    return 1 - (1 - min(max(t, 0), 1)) ** 3


class El:
    """องค์ประกอบในฉาก + คีย์เฟรมเข้า"""
    def __init__(self, layer, cx, cy, t_in=0.0, anim="slide", dur=0.5, rot=0.0,
                 jitter=1.6, fade_out_at=None):
        self.layer = layer.rotate(rot, expand=True, resample=Image.BICUBIC) if rot else layer
        self.cx, self.cy = cx, cy
        self.t_in, self.anim, self.dur = t_in, anim, dur
        self.jitter = jitter
        self.fade_out_at = fade_out_at
        self.seed = random.randint(0, 9999)

    def draw(self, canvas, t, frame):
        p = ease_out((t - self.t_in) / self.dur)
        if p <= 0:
            return
        alpha = p
        if self.fade_out_at is not None and t > self.fade_out_at:
            alpha *= max(0.0, 1 - (t - self.fade_out_at) / 1.2)
            if alpha <= 0:
                return
        dx = dy = 0
        if self.anim == "slide":
            dy = (1 - p) * 70
        elif self.anim == "slide-left":
            dx = (1 - p) * 90
        layer = self.layer
        # stop-motion jitter ทุก 4 เฟรม
        r = random.Random(self.seed + frame // 4)
        jx, jy = r.uniform(-self.jitter, self.jitter), r.uniform(-self.jitter, self.jitter)
        if alpha < 0.999:
            layer = layer.copy()
            layer.putalpha(layer.getchannel("A").point(lambda v: int(v * alpha)))
        x = int(self.cx - layer.width / 2 + dx + jx)
        y = int(self.cy - layer.height / 2 + dy + jy)
        canvas.alpha_composite(layer, dest=(max(-layer.width, x), max(-layer.height, y)))


class Stroke:
    """เส้นเขียนมือแบบ draw-on (วงไฮไลต์ / ลูกศร)"""
    def __init__(self, pts, color, width, t_in, dur=0.7, heads=None):
        self.pts, self.color, self.width = pts, color, width
        self.t_in, self.dur, self.heads = t_in, dur, heads
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        m = width * 2 + 8
        self.box = (int(min(xs) - m), int(min(ys) - m), int(max(xs) + m), int(max(ys) + m))

    def draw(self, canvas, t, frame):
        p = ease_out((t - self.t_in) / self.dur)
        if p <= 0:
            return
        x0, y0, x1, y1 = self.box
        layer = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        shifted = [(x - x0, y - y0) for x, y in self.pts]
        draw_stroke(d, shifted, self.color + (255,), self.width, progress=p)
        if self.heads and p > 0.92:
            for seg in self.heads:
                d.line([(x - x0, y - y0) for x, y in seg], fill=self.color + (255,),
                       width=self.width)
        canvas.alpha_composite(layer, dest=(x0, y0))


def circle_around(cx, cy, rx, ry, t_in, color=MUSTARD, width=13, seed=3):
    return Stroke(hand_ellipse_points(cx, cy, rx, ry, seed=seed), color, width, t_in)


def arrow(p0, p1, t_in, color=INK, width=9, bend=.22, seed=5):
    pts, heads = hand_arrow_points(p0, p1, bend=bend, seed=seed)
    return Stroke(pts, color, width, t_in, dur=0.55, heads=heads)


def strip_el(cy, h, color, seed, cx=W // 2, t_in=0.0, rot=0.0, both=False, sw=W + 160):
    layer, _ = torn_strip(sw, h, color, seed=seed, tear_top=True, tear_bottom=both)
    return El(layer, cx, cy, t_in=t_in, anim="slide", dur=.6, rot=rot, jitter=0.8)


# ---------- scenes ----------
def build_scenes():
    S = []

    # S1 — HOOK
    els = [
        strip_el(H - 130, 340, SEA, seed=21),
        strip_el(H - 40, 240, SEA_LT, seed=22, t_in=.15),
        El(label_paper("ALASKAN CRAB FISHING", 46, rotate=-2), W // 2, 330, t_in=.1),
        El(text_ink("THE\nDEADLIEST JOB", 108), W // 2, 560, t_in=.35),
        El(text_ink("ON EARTH", 96), W // 2, 790, t_in=.6),
        El(crab_illustration(950), W // 2, 1280, t_in=.85, dur=.7),
        circle_around(W // 2, 790, 300, 100, t_in=1.25),
    ]
    S.append(dict(dur=5.0, els=els, seed=31))

    # S2 — WHERE
    mp = alaska_map(920)
    map_cx, map_cy = W // 2, 720
    dot = (map_cx + (DUTCH_HARBOR[0] - 0.5) * 920,
           map_cy + (DUTCH_HARBOR[1] - 0.5) * mp.height)
    dotimg = Image.new("RGBA", (60, 60), (0, 0, 0, 0))
    ImageDraw.Draw(dotimg).ellipse([14, 14, 46, 46], fill=RED)
    els = [
        El(text_ink("THE BERING SEA", 92), W // 2, 280, t_in=.1),
        El(mp, map_cx, map_cy, t_in=.35, dur=.6),
        strip_el(H - 230, 560, SEA, seed=23, t_in=.55),
        strip_el(H - 60, 280, SEA_LT, seed=24, t_in=.7),
        El(dotimg, dot[0], dot[1], t_in=1.0, anim="fade", dur=.3),
        El(label_paper("DUTCH HARBOR, ALASKA", 46, rotate=2), W // 2, 1530, t_in=1.1),
        arrow((W // 2 - 120, 1450), (dot[0] + 36, dot[1] + 42), t_in=1.4, bend=-.15),
        El(label_paper("WINTER WATER: 2°C", 40, rotate=-2, color=SEA), 320, 1730, t_in=1.9),
    ]
    S.append(dict(dur=5.5, els=els, seed=32))

    # S3 — THE POT
    els = [
        El(text_ink("THE TOOL:", 60), W // 2, 270, t_in=.1),
        El(text_ink("A STEEL CRAB POT", 84), W // 2, 380, t_in=.25),
        El(pot_illustration(820), W // 2, 900, t_in=.5, dur=.7),
        El(label_paper("750 LBS", 62, rotate=-3), 280, 1420, t_in=1.1),
        circle_around(280, 1420, 190, 90, t_in=1.45, seed=7),
        arrow((420, 1370), (520, 1120), t_in=1.5, bend=.2, seed=8),
        El(label_paper("BAIT: FROZEN COD", 44, rotate=2), 720, 1540, t_in=1.9),
        arrow((700, 1470), (620, 990), t_in=2.2, bend=-.25, seed=9),
        El(label_paper("CRABS CRAWL IN.\nCAN'T CRAWL OUT.", 40, rotate=-1), W // 2, 1740, t_in=2.7),
    ]
    S.append(dict(dur=6.0, els=els, seed=33))

    # S4 — HOW IT WORKS
    rows = [
        (down_icon(220),  "1. DROP  —  120 M DEEP", 640),
        (clock_icon(220), "2. SOAK  —  24-48 HOURS", 1010),
        (hook_icon(220),  "3. HAUL  —  FULL... OR EMPTY", 1380),
    ]
    els = [El(text_ink("HOW IT WORKS", 88), W // 2, 300, t_in=.1)]
    for i, (icon, txt, y) in enumerate(rows):
        els.append(El(icon, 200, y, t_in=.45 + i * .55, anim="slide-left"))
        els.append(El(label_paper(txt, 44, rotate=(-1.5, 1.5, -1)[i]), 630, y, t_in=.6 + i * .55))
    els.append(El(label_paper("EACH POT: UP TO 2,000 KG OF CRAB", 40, rotate=1,
                              paper=LABEL, color=SEA), W // 2, 1680, t_in=2.4))
    S.append(dict(dur=6.0, els=els, seed=34))

    # S5 — MONEY
    els = [
        strip_el(H - 120, 300, SAGE, seed=25),
        El(text_ink("THE PAYOFF", 70), W // 2, 320, t_in=.1),
        El(text_ink("$10,000+", 150, rules=True), W // 2, 760, t_in=.4),
        circle_around(W // 2, 760, 400, 170, t_in=.9, width=15),
        El(label_paper("PER DECKHAND", 54, rotate=-2), W // 2, 1120, t_in=1.3),
        El(label_paper("IN ONE 5-DAY TRIP", 54, rotate=1.5), W // 2, 1290, t_in=1.55),
        El(text_ink("...IF YOU SURVIVE.", 60, color=RED), W // 2, 1600, t_in=2.6, anim="fade"),
    ]
    S.append(dict(dur=5.0, els=els, seed=35))

    # S6 — DANGER
    els = [
        El(text_ink("WHY SO DEADLY?", 88, color=RED), W // 2, 290, t_in=.1),
        strip_el(1560, 620, SEA, seed=26, t_in=.3),
        strip_el(1760, 380, SEA_LT, seed=27, t_in=.45),
        El(boat_illustration(960), W // 2, 1180, t_in=.55, dur=.7),
        El(label_paper("-20°C", 52, rotate=-3, color=RED), 220, 620, t_in=1.2),
        El(label_paper("40-FT WAVES", 52, rotate=2, color=RED), 760, 540, t_in=1.5),
        El(label_paper("ICE BUILDS UP\nUNTIL BOATS FLIP", 44, rotate=-1), 320, 860, t_in=1.8),
        El(label_paper("FATALITY RATE: ~80x\nTHE AVERAGE JOB", 48, rotate=1, color=RED),
           W // 2, 1800, t_in=2.5),
    ]
    S.append(dict(dur=6.0, els=els, seed=36))

    # S7 — THE TWIST
    els = [
        El(text_ink("THEN, IN 2022...", 80), W // 2, 300, t_in=.1),
        El(snow_crab_swarm(880), W // 2, 900, t_in=.4, dur=.6, fade_out_at=2.2),
        El(text_ink("10 BILLION", 130, color=RED, rules=True), W // 2, 900, t_in=2.8),
        circle_around(W // 2, 900, 430, 150, t_in=3.3, color=RED, seed=13),
        El(label_paper("SNOW CRABS — GONE", 56, rotate=-2), W // 2, 1220, t_in=3.6),
        El(label_paper("THE SEASON WAS CANCELED\nFOR THE FIRST TIME EVER", 42, rotate=1),
           W // 2, 1480, t_in=4.1),
    ]
    S.append(dict(dur=6.0, els=els, seed=37))

    # S8 — WHY + END
    els = [
        El(text_ink("WHAT HAPPENED?", 84), W // 2, 300, t_in=.1),
        El(thermo_icon(300), 300, 640, t_in=.5, anim="slide-left"),
        El(label_paper("MARINE HEAT WAVE\n2018-2019", 46, rotate=2), 680, 640, t_in=.7),
        arrow((680, 800), (620, 1000), t_in=1.2, bend=.2, seed=15),
        El(label_paper("WARM WATER =\nFASTER METABOLISM", 44, rotate=-1.5), W // 2, 1080, t_in=1.5),
        arrow((540, 1220), (540, 1360), t_in=2.0, bend=.1, seed=16),
        El(text_ink("THEY STARVED", 88, color=RED, rules=True), W // 2, 1480, t_in=2.4),
        El(label_paper("FOLLOW — PART 2:\nTHE $200M GHOST FLEET", 44, rotate=-2, color=SEA),
           W // 2, 1760, t_in=4.0),
    ]
    S.append(dict(dur=6.5, els=els, seed=38))
    return S


# ---------- audio (แพดเบาๆ กัน dead silence) ----------
def make_pad(path, total_s):
    sr = 44100
    t = np.arange(int(sr * total_s)) / sr
    chords = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63),
              (196.0, 246.94, 293.66), (164.81, 196.0, 246.94)]
    bar = 4.0
    sig = np.zeros_like(t)
    for i, ch in enumerate([chords[k % 4] for k in range(int(total_s / bar) + 1)]):
        s, e = i * bar, min((i + 1) * bar + .8, total_s)
        idx = (t >= s) & (t < e)
        tt = t[idx] - s
        env = np.minimum(tt / 1.6, 1) * np.minimum((e - s - tt) / 1.2, 1)
        env = np.clip(env, 0, 1)
        for f0 in ch:
            for mul, amp in ((1, 1), (2, .28), (.5, .5)):
                sig[idx] += amp * env * np.sin(2 * np.pi * f0 * mul * tt + f0)
    sig /= np.max(np.abs(sig) + 1e-9)
    # vinyl crackle จางๆ
    rng = np.random.default_rng(1)
    crackle = rng.normal(0, 1, len(t)) * (rng.random(len(t)) > .9995)
    sig = .16 * sig + .02 * crackle
    fade = int(sr * 1.5)
    sig[-fade:] *= np.linspace(1, 0, fade)
    pcm = (np.clip(sig, -1, 1) * 32767).astype(np.int16)
    import wave
    with wave.open(str(path), "w") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr)
        f.writeframes(pcm.tobytes())


# ---------- render ----------
def render_frame(canvas_bg, scene, t, frame):
    # พื้นหลังซูมช้าๆ
    z = 1.0 + 0.035 * (t / scene["dur"])
    zw, zh = int(W * z), int(H * z)
    bg = canvas_bg.resize((zw, zh), Image.BILINEAR)
    frame_img = bg.crop(((zw - W) // 2, (zh - H) // 2, (zw - W) // 2 + W, (zh - H) // 2 + H)).convert("RGBA")
    for el in scene["els"]:
        el.draw(frame_img, t, frame)
    return frame_img.convert("RGB")


def main():
    random.seed(42)
    scenes = build_scenes()
    bgs = [paper_texture(W, H, seed=s["seed"]) for s in scenes]

    if "--stills" in sys.argv:
        out = HERE / "assets"
        for i, (sc, bg) in enumerate(zip(scenes, bgs)):
            img = render_frame(bg, sc, sc["dur"] - .1, 9999)
            img.save(out / f"scene{i+1:02d}.png")
            print("saved", f"scene{i+1:02d}.png")
        return

    out_path = sys.argv[1] if len(sys.argv) > 1 else "preview.mp4"
    total = sum(s["dur"] for s in scenes)
    pad = Path(out_path).with_suffix(".pad.wav")
    make_pad(pad, total)

    cmd = ["ffmpeg", "-y",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", str(pad),
           "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "128k", "-shortest", out_path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
    frame_no = 0
    for si, (sc, bg) in enumerate(zip(scenes, bgs)):
        n = int(sc["dur"] * FPS)
        for f in range(n):
            img = render_frame(bg, sc, f / FPS, frame_no)
            proc.stdin.write(img.tobytes())
            frame_no += 1
        print(f"scene {si+1}/{len(scenes)} done ({frame_no} frames)")
    proc.stdin.close()
    proc.wait()
    pad.unlink(missing_ok=True)
    print("wrote", out_path, f"({total:.1f}s, {frame_no} frames)")


if __name__ == "__main__":
    main()
