# render_ai.py — "The $1.4 Trillion Bet: AI's Circular Deal" (Vox-style, 1080x1920)
#   python3 render_ai.py --stills   → PNG ท้ายฉากลง assets/
#   python3 render_ai.py out.mp4    → วิดีโอเต็ม
import math
import random
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from vox_style import (PAPER, INK, SEA, SEA_LT, SAGE, MUSTARD, RED, LABEL,
                       font, paper_texture, torn_strip, label_paper,
                       hand_ellipse_points, hand_arrow_points, draw_stroke)
from finance_shapes import (GREEN, chip_illustration, banknote, node_badge,
                            crash_curve, bear_icon, magnifier, brain_node)

W, H, FPS = 1080, 1920, 30
HERE = Path(__file__).parent


# ---------- shared machinery (จาก render_preview.py) ----------
def text_ink(text, size, color=INK, rules=False, align="center"):
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
    def __init__(self, layer, cx, cy, t_in=0.0, anim="slide", dur=0.5, rot=0.0,
                 jitter=1.4, fade_out_at=None, scale_pop=False):
        self.layer = layer.rotate(rot, expand=True, resample=Image.BICUBIC) if rot else layer
        self.cx, self.cy = cx, cy
        self.t_in, self.anim, self.dur = t_in, anim, dur
        self.jitter, self.fade_out_at, self.scale_pop = jitter, fade_out_at, scale_pop
        self.seed = random.randint(0, 9999)

    def draw(self, canvas, t, frame):
        p = ease_out((t - self.t_in) / self.dur)
        if p <= 0:
            return
        alpha = p
        if self.fade_out_at is not None and t > self.fade_out_at:
            alpha *= max(0.0, 1 - (t - self.fade_out_at) / 1.0)
            if alpha <= 0:
                return
        dx = dy = 0
        if self.anim == "slide":
            dy = (1 - p) * 60
        elif self.anim == "slide-left":
            dx = (1 - p) * 80
        layer = self.layer
        if self.scale_pop and p < 1:
            s = 0.7 + 0.3 * p
            layer = layer.resize((max(1, int(layer.width * s)), max(1, int(layer.height * s))),
                                 Image.BILINEAR)
        r = random.Random(self.seed + frame // 4)
        jx, jy = r.uniform(-self.jitter, self.jitter), r.uniform(-self.jitter, self.jitter)
        if alpha < 0.999:
            layer = layer.copy()
            layer.putalpha(layer.getchannel("A").point(lambda v: int(v * alpha)))
        x = int(self.cx - layer.width / 2 + dx + jx)
        y = int(self.cy - layer.height / 2 + dy + jy)
        canvas.alpha_composite(layer, dest=(max(-layer.width, x), max(-layer.height, y)))


class Stroke:
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
        layer = Image.new("RGBA", (max(1, x1 - x0), max(1, y1 - y0)), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        shifted = [(x - x0, y - y0) for x, y in self.pts]
        draw_stroke(d, shifted, self.color + (255,), self.width, progress=p)
        if self.heads and p > 0.9:
            for seg in self.heads:
                d.line([(x - x0, y - y0) for x, y in seg], fill=self.color + (255,), width=self.width)
        canvas.alpha_composite(layer, dest=(x0, y0))


def circle_around(cx, cy, rx, ry, t_in, color=MUSTARD, width=13, seed=3, dur=0.7):
    s = Stroke(hand_ellipse_points(cx, cy, rx, ry, seed=seed), color, width, t_in)
    s.dur = dur
    return s


def arrow(p0, p1, t_in, color=INK, width=9, bend=.22, seed=5, dur=0.55):
    pts, heads = hand_arrow_points(p0, p1, bend=bend, seed=seed)
    return Stroke(pts, color, width, t_in, dur=dur, heads=heads)


def strip_el(cy, h, color, seed, cx=W // 2, t_in=0.0, rot=0.0, both=False, sw=W + 160):
    layer, _ = torn_strip(sw, h, color, seed=seed, tear_top=True, tear_bottom=both)
    return El(layer, cx, cy, t_in=t_in, anim="slide", dur=.6, rot=rot, jitter=0.8)


def bignum(text, size, color=INK):
    return text_ink(text, size, color=color, rules=True)


# ---------- scenes ----------
def build_scenes():
    S = []

    # S1 — HOOK: การพนันที่ใหญ่ที่สุด
    els = [
        El(label_paper("MR. WHYLAB", 40, rotate=-2, color=SEA), W // 2, 250, t_in=.05),
        El(text_ink("THE BIGGEST BET\nIN HISTORY", 88), W // 2, 520, t_in=.3),
        El(bignum("$1,400,000,000,000", 78, color=RED), W // 2, 900, t_in=.7, scale_pop=True),
        circle_around(W // 2, 900, 470, 110, t_in=1.15, color=RED, width=14),
        El(label_paper("ONE COMPANY.  EIGHT YEARS.", 44, rotate=1.5), W // 2, 1170, t_in=1.6),
        El(chip_illustration(430, label="AI"), W // 2, 1560, t_in=1.9, dur=.7, scale_pop=True),
    ]
    S.append(dict(dur=6.0, els=els, seed=41))

    # S2 — THE MISMATCH: จ่าย 1.4T แต่รายได้ 13B (แท่งเทียบ + ป้ายเหนือแท่ง)
    BARW, BASE = 190, 1780
    bar_promise = Image.new("RGBA", (BARW, 720), (0, 0, 0, 0))
    ImageDraw.Draw(bar_promise).rectangle([0, 0, BARW, 720], fill=RED + (255,))
    bar_rev = Image.new("RGBA", (BARW, 34), (0, 0, 0, 0))
    ImageDraw.Draw(bar_rev).rectangle([0, 0, BARW, 34], fill=GREEN + (255,))
    els = [
        El(text_ink("SPENDING  vs  INCOME", 66), W // 2, 250, t_in=.1),
        El(brain_node(280), W // 2, 520, t_in=.35, dur=.6, scale_pop=True),
        El(label_paper("OpenAI", 46, rotate=-1), W // 2, 720, t_in=.6),
        # แท่งแดง (รายจ่าย) โตจากฐานขึ้น
        El(bar_promise, 340, BASE - 360, t_in=1.0, anim="slide", dur=.8),
        El(bignum("$1.4T", 66, color=RED), 340, 1010, t_in=1.5, scale_pop=True),
        El(label_paper("PROMISED TO SPEND", 36, rotate=-2, color=RED), 340, 1120, t_in=1.7),
        # แท่งเขียว (รายได้) จิ๋ว
        El(bar_rev, 760, BASE - 17, t_in=2.2, anim="fade", dur=.5),
        El(bignum("$13B", 60, color=GREEN), 760, 1600, t_in=2.5, scale_pop=True),
        El(label_paper("YEARLY REVENUE", 36, rotate=2, color=GREEN), 760, 1710, t_in=2.7),
    ]
    S.append(dict(dur=6.5, els=els, seed=42))

    # S3 — THE CIRCULAR DEAL (money shot) — วงลูปแบบเดียวกับ S5 ที่สวย
    nvx, nvy = 300, 1150
    oax, oay = 780, 1150
    els = [
        El(text_ink("THE CIRCULAR DEAL", 82, color=RED), W // 2, 250, t_in=.1),
        El(node_badge("NVIDIA", "chip maker", 340, accent=GREEN), nvx, nvy, t_in=.4, dur=.5, scale_pop=True),
        El(brain_node(330), oax, oay, t_in=.6, dur=.5, scale_pop=True),
        El(label_paper("OpenAI", 40, rotate=-1), oax, oay + 215, t_in=.9),
        # ลูกศรบน: Nvidia -> OpenAI
        arrow((410, 1010), (700, 1010), t_in=1.3, bend=-.32, seed=11, color=RED, width=9, dur=.7),
        El(label_paper("INVESTS  $100B", 42, rotate=-3, color=RED), W // 2, 860, t_in=1.9),
        # ลูกศรล่าง: OpenAI -> Nvidia
        arrow((700, 1290), (410, 1290), t_in=2.5, bend=-.32, seed=12, color=SEA, width=9, dur=.7),
        El(label_paper("BUYS  $100B  OF CHIPS", 40, rotate=2, color=SEA), W // 2, 1470, t_in=3.1),
        El(text_ink("THE SAME MONEY,\nGOING IN A CIRCLE.", 50, rules=True), W // 2, 1730, t_in=3.9,
           scale_pop=True),
    ]
    S.append(dict(dur=7.0, els=els, seed=43))

    # S4 — THE WHOLE WEB: 7 vendors, $1.15T
    cx, cy = W // 2, 1080
    vendors = [
        ("BROADCOM", "$350B", -90, GREEN),
        ("ORACLE", "$300B", -26, SEA),
        ("MICROSOFT", "$250B", 38, INK),
        ("NVIDIA", "$100B", 102, GREEN),
        ("AMD", "$90B", 166, RED),
        ("+ MORE", "$60B", 230, SEA),
    ]
    els = [El(text_ink("IT'S A WHOLE WEB", 80), W // 2, 250, t_in=.1),
           El(brain_node(300), cx, cy, t_in=.4, dur=.5, scale_pop=True)]
    R = 560
    for i, (nm, amt, deg, col) in enumerate(vendors):
        a = math.radians(deg)
        x, y = cx + R * math.cos(a) * 0.62, cy + R * math.sin(a) * 0.78
        els.append(arrow((cx + 130 * math.cos(a), cy + 150 * math.sin(a)),
                         (x - 60 * math.cos(a), y - 70 * math.sin(a)),
                         t_in=.8 + i * .18, bend=.05, seed=20 + i, dur=.4))
        els.append(El(node_badge(nm, amt, 230, accent=col), x, y, t_in=.9 + i * .18, dur=.4, scale_pop=True))
    els.append(El(bignum("$1.15 TRILLION", 66, color=RED), W // 2, 1720, t_in=2.4, scale_pop=True))
    els.append(El(label_paper("IN PROMISES", 40, rotate=-2), W // 2, 1850, t_in=2.7))
    S.append(dict(dur=6.5, els=els, seed=44))

    # S5 — THE AMD TWIST
    els = [
        El(text_ink("THE STRANGEST\nDEAL OF ALL", 78), W // 2, 340, t_in=.1),
        El(node_badge("AMD", "chips", 340, accent=RED), 320, 820, t_in=.5, dur=.5, scale_pop=True),
        El(brain_node(300), 780, 820, t_in=.7, dur=.5, scale_pop=True),
        arrow((420, 700), (700, 700), t_in=1.2, bend=-.3, seed=9, color=RED),
        El(label_paper("GAVE OpenAI 10% OF ITSELF\nFOR 1 CENT A SHARE", 40, rotate=-1, color=RED),
           W // 2, 1120, t_in=1.6),
        arrow((700, 940), (420, 940), t_in=2.2, bend=-.3, seed=10, color=SEA),
        El(label_paper("...WHO THEN ORDERED\n$90B OF AMD CHIPS", 40, rotate=1.5, color=SEA),
           W // 2, 1360, t_in=2.6),
        El(text_ink("THE CUSTOMER NOW\nOWNS THE SUPPLIER.", 56, color=INK, rules=True),
           W // 2, 1680, t_in=3.4, scale_pop=True),
    ]
    S.append(dict(dur=6.5, els=els, seed=45))

    # S6 — DOT-COM ECHO
    chart, peak = crash_curve(920)
    els = [
        El(text_ink("WE'VE SEEN\nTHIS BEFORE", 82, color=RED), W // 2, 330, t_in=.1),
        El(chart, W // 2, 980, t_in=.6, dur=.7),
        El(label_paper("THE DOT-COM BUBBLE\n2000", 44, rotate=-2), W // 2, 760, t_in=1.5),
        El(label_paper("BACK THEN, CHIP MAKERS\nFUNDED THEIR OWN BUYERS TOO.", 40, rotate=1),
           W // 2, 1480, t_in=2.2),
        El(label_paper("THE NASDAQ FELL 78%.", 48, rotate=-1.5, color=RED), W // 2, 1700, t_in=3.0,
           scale_pop=True),
    ]
    S.append(dict(dur=6.5, els=els, seed=46))

    # S7 — THE PROPHET (Michael Burry)
    els = [
        El(text_ink("ONE MAN IS BETTING\nIT ALL FALLS", 74), W // 2, 320, t_in=.1),
        El(bear_icon(360), 330, 900, t_in=.5, dur=.6, scale_pop=True),
        El(magnifier(300), 770, 880, t_in=.7, dur=.6, scale_pop=True),
        El(label_paper("MICHAEL BURRY", 52, rotate=-2), W // 2, 1180, t_in=1.2),
        El(label_paper('THE MAN WHO CALLED\nTHE 2008 CRASH', 40, rotate=1.5, color=SEA),
           W // 2, 1380, t_in=1.6),
        El(bignum("$1.1 BILLION", 68, color=RED), W // 2, 1620, t_in=2.3, scale_pop=True),
        El(label_paper("SHORTING NVIDIA — 80% OF HIS FUND", 38, rotate=-1.5), W // 2, 1770, t_in=2.7),
    ]
    S.append(dict(dur=6.5, els=els, seed=47))

    # S8 — THE OTHER SIDE
    up = Image.new("RGBA", (300, 520), (0, 0, 0, 0))
    du = ImageDraw.Draw(up)
    du.line([(150, 500), (150, 60)], fill=GREEN + (255,), width=16)
    du.polygon([(90, 150), (210, 150), (150, 20)], fill=GREEN)
    els = [
        El(text_ink("BUT...", 96), W // 2, 300, t_in=.1),
        El(up, W // 2, 780, t_in=.5, anim="slide", dur=.7),
        El(label_paper("NVIDIA KEEPS BEATING\nEVERY EARNINGS CALL", 46, rotate=-1.5, color=GREEN),
           W // 2, 1180, t_in=1.1),
        El(label_paper("THE REVENUE IS REAL — SO FAR.", 42, rotate=1), W // 2, 1420, t_in=1.7),
        El(text_ink("MAYBE IT'S NOT A BUBBLE.\nMAYBE IT'S THE BIGGEST\nBUILDOUT EVER.", 48),
           W // 2, 1720, t_in=2.4),
    ]
    S.append(dict(dur=6.0, els=els, seed=48))

    # S9 — THE QUESTION / END
    els = [
        El(brain_node(360), W // 2, 620, t_in=.2, dur=.6, scale_pop=True),
        El(text_ink("BUBBLE?", 100, color=RED), W // 2, 1010, t_in=.7, scale_pop=True),
        El(text_ink("OR REVOLUTION?", 90, color=SEA), W // 2, 1200, t_in=1.2, scale_pop=True),
        El(label_paper("NOBODY KNOWS YET.", 48, rotate=-1.5), W // 2, 1440, t_in=1.9),
        strip_el(H - 150, 320, SEA, seed=29, t_in=2.3),
        El(text_ink("MR. WHYLAB — WE ASK WHY.", 46, color=PAPER), W // 2, 1770, t_in=2.7),
    ]
    S.append(dict(dur=6.0, els=els, seed=49))
    return S


# ---------- audio pad ----------
def make_pad(path, total_s):
    sr = 44100
    t = np.arange(int(sr * total_s)) / sr
    chords = [(146.83, 220.0, 261.63), (164.81, 196.0, 246.94),
              (130.81, 196.0, 233.08), (174.61, 220.0, 293.66)]
    bar = 4.0
    sig = np.zeros_like(t)
    seq = [chords[k % 4] for k in range(int(total_s / bar) + 1)]
    for i, ch in enumerate(seq):
        s, e = i * bar, min((i + 1) * bar + .8, total_s)
        idx = (t >= s) & (t < e)
        tt = t[idx] - s
        env = np.clip(np.minimum(tt / 1.5, 1) * np.minimum((e - s - tt) / 1.2, 1), 0, 1)
        for f0 in ch:
            for mul, amp in ((1, 1), (2, .25), (.5, .55)):
                sig[idx] += amp * env * np.sin(2 * np.pi * f0 * mul * tt + f0)
    # เสียง tick เบาๆ ทุกบาร์ (ให้ความรู้สึกนับถอยหลัง/เดิมพัน)
    for i in range(int(total_s)):
        k = int(i * sr)
        if k + 800 < len(sig):
            sig[k:k + 800] += .05 * np.sin(2 * np.pi * 1400 * np.arange(800) / sr) * np.linspace(1, 0, 800)
    sig /= np.max(np.abs(sig) + 1e-9)
    sig *= .17
    fade = int(sr * 1.5)
    sig[-fade:] *= np.linspace(1, 0, fade)
    pcm = (np.clip(sig, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "w") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr)
        f.writeframes(pcm.tobytes())


# ---------- render ----------
def render_frame(bg, scene, t, frame):
    z = 1.0 + 0.03 * (t / scene["dur"])
    zw, zh = int(W * z), int(H * z)
    b = bg.resize((zw, zh), Image.BILINEAR)
    fr = b.crop(((zw - W) // 2, (zh - H) // 2, (zw - W) // 2 + W, (zh - H) // 2 + H)).convert("RGBA")
    for el in scene["els"]:
        el.draw(fr, t, frame)
    return fr.convert("RGB")


def main():
    random.seed(7)
    scenes = build_scenes()
    bgs = [paper_texture(W, H, seed=s["seed"]) for s in scenes]

    if "--stills" in sys.argv:
        for i, (sc, bg) in enumerate(zip(scenes, bgs)):
            render_frame(bg, sc, sc["dur"] - .1, 9999).save(HERE / "assets" / f"scene{i+1:02d}.png")
            print("saved", f"scene{i+1:02d}.png")
        return

    out_path = sys.argv[1] if len(sys.argv) > 1 else "preview.mp4"
    total = sum(s["dur"] for s in scenes)
    pad = Path(out_path).with_suffix(".pad.wav")
    make_pad(pad, total)
    cmd = ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-i", str(pad),
           "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "128k", "-shortest", out_path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
    fno = 0
    for si, (sc, bg) in enumerate(zip(scenes, bgs)):
        for f in range(int(sc["dur"] * FPS)):
            proc.stdin.write(render_frame(bg, sc, f / FPS, fno).tobytes())
            fno += 1
        print(f"scene {si+1}/{len(scenes)} done ({fno} frames)")
    proc.stdin.close(); proc.wait()
    pad.unlink(missing_ok=True)
    print("wrote", out_path, f"({total:.1f}s)")


if __name__ == "__main__":
    main()
