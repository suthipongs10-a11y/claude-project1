#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hyperframes.py — ประกอบวิดีโอจากภาพ + เสียง + timing (Bones & Firelight ขั้นสุดท้าย)

รับ: shot-manifest.json (ช็อต+ฉาก+type+caption+punch), word-timings.json,
     voiceover.wav, frames/imgNN.png, ฟอนต์ Sarabun
ทำ: - Ken Burns ต่อเนื่องต่อ "ฉาก" (ช็อตที่ใช้ภาพเดียวกันเลื่อนภาพต่อเนื่อง ไม่รีเซ็ต)
    - caption นิ่ง (ไฮไลต์เหลือง) เลื่อน/จางเข้า
    - punch word เด้งพร้อมเอฟเฟกต์ ตอนพูด "คำ trigger" เป๊ะ (จาก word-timings)
    - รวมทุกช็อตแบบ gapless + เสียงพากย์ -> mp4

ใช้:
  python tools/hyperframes.py --size 720          # เทสต์เร็ว
  python tools/hyperframes.py --size 1080 --out EP01.mp4
"""
import argparse, json, os, sys, bisect
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APDIR = os.path.join(ROOT, "projects/video-01-blackhole")
FONTS = os.path.join(ROOT, "assets/fonts")
sys.path.insert(0, os.path.join(ROOT, "tts"))
from align_th import _norm  # noqa: E402

INK = (17, 19, 24)
PAPER = (246, 241, 231)


# ---------- โหลด/เตรียมข้อมูล ----------
def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def trigger_time(shot, trigger, words):
    """หา start ของคำ trigger ที่อยู่ในช่วงช็อต (fallback = ต้นช็อต+0.15)"""
    tn = _norm(trigger)
    best = None
    for w in words:
        if shot["start"] <= w["start"] < shot["end"]:
            wn = _norm(w["w"])
            if wn == tn or (tn and tn in wn) or (wn and wn in tn):
                best = w["start"]
                break
    return best if best is not None else shot["start"] + 0.15


def scene_runs(shots):
    """จับช็อตที่ scene เดียวกัน+ติดกัน เป็น run (สำหรับ Ken Burns ต่อเนื่อง)"""
    runs = []
    for s in shots:
        if runs and runs[-1]["scene"] == s["scene"]:
            runs[-1]["shots"].append(s)
            runs[-1]["end"] = s["end"]
        else:
            runs.append({"scene": s["scene"], "start": s["start"],
                         "end": s["end"], "shots": [s]})
    return runs


def run_motion(run):
    """เลือกทิศ Ken Burns จาก type ในฉาก -> (zoom0, zoom1, panx, pany)"""
    types = {sh["type"] for sh in run["shots"]}
    Z = 1.12
    if types & {"pull-out", "pop-out"}:
        return Z, 1.0, 0.0, 0.0            # ซูมออก
    if types & {"push-in", "zoom-punch", "accel-fall", "collapse-in", "spiral"}:
        return 1.0, Z, 0.0, 0.06           # ซูมเข้า + จมลงนิด
    if types & {"track-run", "pan", "orbit", "drift-in", "drift-cross", "card-slide"}:
        return 1.06, 1.06, -0.5, 0.0       # แพนข้าง
    if types & {"split-screen", "split-push", "freeze", "freeze-snap"}:
        return 1.0, 1.03, 0.0, 0.0         # นิ่งมาก
    return 1.0, 1.06, 0.0, 0.03            # ดีฟอลต์ ซูมเข้าช้าๆ


# ---------- เท็กซ์เลเยอร์ (แคชต่อข้อความ) ----------
_cache = {}


def caption_layer(text, font):
    key = ("cap", text)
    if key in _cache:
        return _cache[key]
    dummy = Image.new("RGBA", (10, 10))
    d = ImageDraw.Draw(dummy)
    l, t, r, b = d.textbbox((0, 0), text, font=font)
    tw, th = r - l, b - t
    padx, pady = 26, 16
    W, H = tw + padx * 2, th + pady * 2
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=10, fill=(255, 225, 77, 255))
    d.text((padx - l, pady - t), text, font=font, fill=INK + (255,))
    img = img.rotate(1.2, expand=True, resample=Image.BICUBIC)
    _cache[key] = img
    return img


def punch_layer(text, font, color):
    key = ("punch", text, color)
    if key in _cache:
        return _cache[key]
    dummy = Image.new("RGBA", (10, 10))
    d = ImageDraw.Draw(dummy)
    stroke = 8
    l, t, r, b = d.textbbox((0, 0), text, font=font, stroke_width=stroke)
    tw, th = r - l, b - t
    pad = 20
    img = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.text((pad - l, pad - t), text, font=font, fill=hexrgb(color) + (255,),
           stroke_width=stroke, stroke_fill=INK + (255,))
    _cache[key] = img
    return img


def anim(effect, p):
    """คืน (scale, dx, dy, alpha) ตามเอฟเฟกต์ p=0..1 ตลอดช่วงโชว์ punch"""
    import math
    inp = min(p / 0.18, 1.0)          # เข้า 18% แรก
    outp = max((p - 0.85) / 0.15, 0.0)  # ออก 15% ท้าย
    alpha = min(inp, 1.0 - outp)
    if effect in ("zoom-punch", "pop-out"):
        s = 2.2 - 1.2 * inp
    elif effect in ("pop", "pop-double", "split-pop", "sparkle"):
        s = (1.25 * inp) if inp < 1 else (1.0 + 0.25 * math.sin(min((p-0.18)/0.12,1)*math.pi))
        s = max(s, 0.2)
    elif effect == "stamp":
        s = 1.5 - 0.5 * inp
    elif effect == "drop":
        s = 1.0
        return s, 0, int(-120 * (1 - inp)), alpha
    elif effect == "stretch-wobble":
        s = 1.0 + 0.18 * math.sin(p * math.pi * 6)  # spaghetti สั่น
    elif effect == "shake":
        return 1.0, int(14 * math.sin(p * math.pi * 14)), 0, alpha
    elif effect in ("glitch-shatter", "crush-squash"):
        s = 1.35 - 0.35 * inp
    elif effect in ("fade-in", "slow-drag", "freeze-snap", "slow-fade", "count-up"):
        s = 1.0
    else:
        s = 1.3 - 0.3 * inp
    return max(s, 0.05), 0, 0, alpha


# ---------- แปะเลเยอร์ลงเฟรม ----------
def paste_scaled(base, layer, cx, cy, scale, alpha):
    if scale <= 0.02 or alpha <= 0.01:
        return
    w = max(1, int(layer.width * scale))
    h = max(1, int(layer.height * scale))
    lz = layer.resize((w, h), Image.BICUBIC)
    if alpha < 0.999:
        a = lz.split()[3].point(lambda v: int(v * alpha))
        lz.putalpha(a)
    base.alpha_composite(lz, (int(cx - w / 2), int(cy - h / 2)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", default="720", choices=["720", "1080"])
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--out", default=None)
    ap.add_argument("--frames", default=os.path.join(APDIR, "frames"))
    ap.add_argument("--seconds", type=float, default=0, help="เรนเดอร์แค่ N วิแรก (เทสต์)")
    args = ap.parse_args()

    W, H = (1280, 720) if args.size == "720" else (1920, 1080)
    out = args.out or os.path.join(APDIR, f"EP01_{args.size}p.mp4")

    shots = json.load(open(os.path.join(APDIR, "shot-manifest.json"), encoding="utf-8"))
    words = json.load(open(os.path.join(APDIR, "clips/word-timings.json"), encoding="utf-8"))
    total = shots[-1]["end"]
    if args.seconds:
        total = min(total, args.seconds)

    cap_font = ImageFont.truetype(os.path.join(FONTS, "Sarabun-ExtraBold.ttf"), int(H * 0.045))
    punch_font = ImageFont.truetype(os.path.join(FONTS, "Sarabun-ExtraBold.ttf"), int(H * 0.14))

    # โหลดภาพฉาก + ทำเวอร์ชัน cover ขนาดใหญ่ (เผื่อ Ken Burns ซูม)
    Z = 1.12
    BW, BH = int(W * Z), int(H * Z)
    scenes = {}
    for s in shots:
        sc = s["scene"]
        if sc in scenes:
            continue
        p = os.path.join(args.frames, f"{sc}.png")
        im = Image.open(p).convert("RGB")
        # cover ให้เต็ม BW×BH
        r = max(BW / im.width, BH / im.height)
        im = im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)
        x = (im.width - BW) // 2
        y = (im.height - BH) // 2
        scenes[sc] = np.asarray(im.crop((x, y, x + BW, y + BH)))

    runs = scene_runs(shots)
    for r in runs:
        r["motion"] = run_motion(r)
    # ผูก trigger time ให้ punch
    for s in shots:
        if s.get("punch"):
            s["punch"]["_t"] = trigger_time(s, s["punch"]["trigger"], words)

    starts = [s["start"] for s in shots]
    run_starts = [r["start"] for r in runs]

    def frame_at(t):
        si = bisect.bisect_right(starts, t) - 1
        si = max(0, min(si, len(shots) - 1))
        shot = shots[si]
        ri = bisect.bisect_right(run_starts, t) - 1
        run = runs[max(0, min(ri, len(runs) - 1))]

        # Ken Burns: p ตลอด run
        z0, z1, px, py = run["motion"]
        rp = (t - run["start"]) / max(run["end"] - run["start"], 0.001)
        rp = min(max(rp, 0), 1)
        z = z0 + (z1 - z0) * rp
        big = scenes[run["scene"]]
        cw, ch = int(W / z * Z), int(H / z * Z)   # หน้าต่าง crop
        cw, ch = min(cw, BW), min(ch, BH)
        maxx, maxy = BW - cw, BH - ch
        ox = int((0.5 + px * (rp - 0.5)) * maxx)
        oy = int((0.5 + py * (rp - 0.5)) * maxy)
        ox = min(max(ox, 0), maxx); oy = min(max(oy, 0), maxy)
        crop = big[oy:oy + ch, ox:ox + cw]
        frame = Image.fromarray(crop).resize((W, H), Image.BILINEAR).convert("RGBA")

        # caption นิ่ง
        if shot.get("caption"):
            lay = caption_layer(shot["caption"], cap_font)
            lt = (t - shot["start"])
            a = min(lt / 0.3, 1.0, max((shot["end"] - t) / 0.3, 0.0))
            x = int(W * 0.06); y = int(H * 0.09)
            tmp = Image.new("RGBA", frame.size, (0, 0, 0, 0))
            l2 = lay.copy()
            if a < 0.999:
                l2.putalpha(l2.split()[3].point(lambda v: int(v * max(a, 0))))
            tmp.alpha_composite(l2, (x, y)); frame.alpha_composite(tmp)

        # punch เด้ง
        if shot.get("punch"):
            pt = shot["punch"]["_t"]
            show = min(1.4, shot["end"] - pt)
            if pt <= t < pt + show:
                p = (t - pt) / max(show, 0.001)
                sc, dx, dy, al = anim(shot["punch"]["effect"], p)
                lay = punch_layer(shot["punch"]["word"], punch_font, shot["punch"]["color"])
                paste_scaled(frame, lay, W / 2 + dx, H * 0.42 + dy, sc, al)

        return np.asarray(frame.convert("RGB"))

    # เรนเดอร์ผ่าน moviepy
    try:
        from moviepy import VideoClip, AudioFileClip
    except ImportError:
        from moviepy.editor import VideoClip, AudioFileClip
    clip = VideoClip(frame_function=frame_at, duration=total)
    audio = AudioFileClip(os.path.join(APDIR, "clips/voiceover.wav"))
    if args.seconds:
        audio = audio.subclipped(0, total) if hasattr(audio, "subclipped") else audio.subclip(0, total)
    clip = clip.with_audio(audio) if hasattr(clip, "with_audio") else clip.set_audio(audio)
    print(f"[render] {W}x{H} {args.fps}fps {total:.1f}s -> {out}")
    clip.write_videofile(out, fps=args.fps, codec="libx264", audio_codec="aac",
                         preset="medium", threads=4, logger="bar")
    print(f"✅ {out}  ({os.path.getsize(out)//1024} KB)")


if __name__ == "__main__":
    main()
