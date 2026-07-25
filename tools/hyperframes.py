#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hyperframes.py — ประกอบวิดีโอจากภาพ + เสียง + timing (Bones & Firelight ขั้นสุดท้าย)

รับ: shot-manifest.json (ช็อต+ฉาก+type+caption+punch), word-timings.json,
     voiceover.wav, frames/imgNN.png, ฟอนต์เอกลักษณ์ของช่อง
ทำ: - Ken Burns ต่อเนื่องต่อ "ฉาก" (ช็อตที่ใช้ภาพเดียวกันเลื่อนภาพต่อเนื่อง ไม่รีเซ็ต)
    - **หาที่ว่างจริงในภาพเอง** (negative space) แล้ววาง caption/punch ตรงนั้น
      ไม่ fix มุมตายตัว + ตำแหน่งเกาะภาพ เลื่อนตามตอนภาพแพน/ซูม
    - caption นิ่ง (ไฮไลต์เหลือง) สไลด์+จางเข้า
    - punch word เด้งพร้อมเอฟเฟกต์ ตอนพูด "คำ trigger" เป๊ะ (จาก word-timings)
    - รวมทุกช็อตแบบ gapless + เสียงพากย์ -> mp4

ใช้:
  # universe (ดีฟอลต์)
  python tools/hyperframes.py --size 720
  # agri
  python tools/hyperframes.py --project channels/agri/projects/ep01-grass-compost \
      --font Itim-Regular.ttf --size 1080 --out AGRI_EP01.mp4
"""
import argparse, json, os, sys, bisect
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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
    if types & {"track-run", "pan", "pan-R", "orbit", "drift-in", "drift-cross", "card-slide"}:
        return 1.06, 1.06, -0.5, 0.0       # แพนข้าง
    if types & {"split-screen", "split-push", "freeze", "freeze-snap"}:
        return 1.0, 1.03, 0.0, 0.0         # นิ่งมาก
    return 1.0, 1.06, 0.0, 0.03            # ดีฟอลต์ ซูมเข้าช้าๆ


# ---------- หา "ที่ว่าง" ในภาพ (negative space) ----------
GW, GH = 64, 36           # ความละเอียดกริดที่ใช้วิเคราะห์ความรก


def busy_map(im_rgb):
    """แผนที่ความรกของภาพ (ค่าสูง = มีรายละเอียด/ขอบเยอะ) ขนาด GH×GW"""
    g = im_rgb.convert("L").resize((GW, GH), Image.BILINEAR)
    a = np.asarray(g, dtype=np.float32)
    gy, gx = np.gradient(a)
    edge = np.hypot(gx, gy)
    # บวก local contrast หยาบ ๆ กันพื้นที่ที่ไล่สีแรงแต่ไม่มีขอบ
    blur = np.asarray(g.resize((GW // 4, GH // 4), Image.BILINEAR)
                       .resize((GW, GH), Image.BILINEAR), dtype=np.float32)
    return edge + np.abs(a - blur) * 0.5


def find_free_box(bmap, bw, bh, prefer, prefer_w=0.55, margin=2):
    """หาช่องขนาด bw×bh (หน่วยกริด) ที่ 'ว่างที่สุด' + ใกล้จุดที่อยากวาง

    prefer = (fx, fy) ตำแหน่งที่ชอบแบบ normalize 0..1
    คืน (fx, fy) จุดกึ่งกลางช่องที่เลือก (normalize 0..1 ของทั้งภาพ)
    """
    gh, gw = bmap.shape
    bw = min(bw, gw - margin * 2)
    bh = min(bh, gh - margin * 2)
    # integral image เพื่อรวมค่าในกล่องเร็ว ๆ
    ii = np.zeros((gh + 1, gw + 1), dtype=np.float64)
    ii[1:, 1:] = bmap.cumsum(0).cumsum(1)
    norm = bmap.max() * bw * bh or 1.0
    best, best_cost = None, 1e18
    for y in range(margin, gh - bh - margin + 1):
        for x in range(margin, gw - bw - margin + 1):
            s = ii[y + bh, x + bw] - ii[y, x + bw] - ii[y + bh, x] + ii[y, x]
            cx, cy = (x + bw / 2) / gw, (y + bh / 2) / gh
            cost = s / norm + prefer_w * ((cx - prefer[0]) ** 2 + (cy - prefer[1]) ** 2)
            if cost < best_cost:
                best_cost, best = cost, (cx, cy)
    return best or (prefer[0], prefer[1])


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
    ap.add_argument("--project", default="projects/video-01-blackhole",
                    help="โฟลเดอร์โปรเจกต์ (มี shot-manifest.json + clips/ + frames/)")
    ap.add_argument("--font", default="Sarabun-ExtraBold.ttf",
                    help="ฟอนต์เอกลักษณ์ของช่อง (universe=Kanit, agri=Itim, health=Mali)")
    ap.add_argument("--size", default="720", choices=["720", "1080"])
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--out", default=None)
    ap.add_argument("--frames", default=None)
    ap.add_argument("--seconds", type=float, default=0, help="เรนเดอร์แค่ N วิแรก (เทสต์)")
    ap.add_argument("--start", type=float, default=0, help="เริ่มเรนเดอร์ที่วินาทีที่ N (เทสต์)")
    args = ap.parse_args()

    APDIR = args.project if os.path.isabs(args.project) else os.path.join(ROOT, args.project)
    frames_dir = args.frames or os.path.join(APDIR, "frames")

    W, H = (1280, 720) if args.size == "720" else (1920, 1080)
    out = args.out or os.path.join(APDIR, f"EP01_{args.size}p.mp4")

    shots = json.load(open(os.path.join(APDIR, "shot-manifest.json"), encoding="utf-8"))
    words = json.load(open(os.path.join(APDIR, "clips/word-timings.json"), encoding="utf-8"))
    total = shots[-1]["end"]
    t0 = max(0.0, args.start)
    if args.seconds:
        total = min(total, t0 + args.seconds)

    font_path = os.path.join(FONTS, args.font)
    cap_font = ImageFont.truetype(font_path, int(H * 0.048))
    punch_font = ImageFont.truetype(font_path, int(H * 0.155))
    print(f"[font] {args.font}")

    # โหลดภาพฉาก + ทำเวอร์ชัน cover ขนาดใหญ่ (เผื่อ Ken Burns ซูม) + หาที่ว่าง
    Z = 1.12
    BW, BH = int(W * Z), int(H * Z)
    scenes, free = {}, {}
    for s in shots:
        sc = s["scene"]
        if sc in scenes:
            continue
        p = os.path.join(frames_dir, f"{sc}.png")
        im = Image.open(p).convert("RGB")
        # cover ให้เต็ม BW×BH
        r = max(BW / im.width, BH / im.height)
        im = im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)
        x = (im.width - BW) // 2
        y = (im.height - BH) // 2
        im = im.crop((x, y, x + BW, y + BH))
        scenes[sc] = np.asarray(im)
        bm = busy_map(im)
        # caption ~46%W × 13%H, ชอบอยู่แถวบน / punch ~52%W × 20%H ชอบกลางค่อนบน
        free[sc] = {
            "cap": find_free_box(bm, int(GW * 0.46), int(GH * 0.14), (0.5, 0.20)),
            "punch": find_free_box(bm, int(GW * 0.52), int(GH * 0.21), (0.5, 0.44), prefer_w=0.40),
        }
    print(f"[scenes] {len(scenes)} ภาพ — หาที่ว่างวางคำเรียบร้อย")

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
        t = t + t0
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

        def to_frame(fx, fy, lw, lh):
            """แปลงตำแหน่งที่ว่าง (พิกัดบนภาพใหญ่) -> พิกัดกลางเลเยอร์บนเฟรม
            ทำให้คำ 'เกาะ' ที่ว่างของภาพ เลื่อนตามตอนแพน/ซูม แล้ว clamp ไม่ให้ตกขอบ"""
            cx = (fx * BW - ox) / cw * W
            cy = (fy * BH - oy) / ch * H
            mx, my = lw / 2 + W * 0.035, lh / 2 + H * 0.045
            return (min(max(cx, mx), W - mx), min(max(cy, my), H - my))

        # caption นิ่ง — วางในที่ว่างของฉาก + สไลด์เข้า
        if shot.get("caption"):
            lay = caption_layer(shot["caption"], cap_font)
            lt = t - shot["start"]
            a = min(lt / 0.3, 1.0, max((shot["end"] - t) / 0.3, 0.0))
            fx, fy = free[run["scene"]]["cap"]
            cx, cy = to_frame(fx, fy, lay.width, lay.height)
            cx -= int(W * 0.03 * (1 - min(lt / 0.35, 1.0)))   # สไลด์จากซ้ายเล็กน้อย
            paste_scaled(frame, lay, cx, cy, 1.0, max(a, 0))

        # punch เด้ง — วางในที่ว่างของฉากเช่นกัน
        if shot.get("punch"):
            pt = shot["punch"]["_t"]
            show = min(1.4, shot["end"] - pt)
            if pt <= t < pt + show:
                p = (t - pt) / max(show, 0.001)
                sc, dx, dy, al = anim(shot["punch"]["effect"], p)
                lay = punch_layer(shot["punch"]["word"], punch_font, shot["punch"]["color"])
                fx, fy = free[run["scene"]]["punch"]
                cx, cy = to_frame(fx, fy, lay.width, lay.height)
                paste_scaled(frame, lay, cx + dx, cy + dy, sc, al)

        return np.asarray(frame.convert("RGB"))

    # เรนเดอร์ผ่าน moviepy
    try:
        from moviepy import VideoClip, AudioFileClip
    except ImportError:
        from moviepy.editor import VideoClip, AudioFileClip
    dur = total - t0
    clip = VideoClip(frame_function=frame_at, duration=dur)
    audio = AudioFileClip(os.path.join(APDIR, "clips/voiceover.wav"))
    if t0 or args.seconds:
        audio = (audio.subclipped(t0, total) if hasattr(audio, "subclipped")
                 else audio.subclip(t0, total))
    clip = clip.with_audio(audio) if hasattr(clip, "with_audio") else clip.set_audio(audio)
    print(f"[render] {W}x{H} {args.fps}fps {dur:.1f}s -> {out}")
    clip.write_videofile(out, fps=args.fps, codec="libx264", audio_codec="aac",
                         preset="medium", threads=4, logger="bar")
    print(f"✅ {out}  ({os.path.getsize(out)//1024} KB)")


if __name__ == "__main__":
    main()
