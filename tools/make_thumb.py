#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make_thumb.py — ทำภาพปกคลิป (thumbnail) จากเฟรมในโปรเจกต์ + ข้อความไทยตัวใหญ่

ออกแบบตามที่ช่องต้องการ: ตัวหนังสือหนา มีขอบคนละสีตัดกันชัด ไม่ใส่ฟิลเตอร์
ฟอนต์ตามช่อง (universe=Kanit, agri=Itim, health=Mali)

ใช้:
  python tools/make_thumb.py --base channels/agri/.../frames/img21.png \
     --out thumb_A.png --font Itim-Regular.ttf \
     --line "อย่าทิ้ง!:#FFC93C" --line "เศษหญ้า = ปุ๋ยฟรี:#FFFFFF" --side left
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "assets/fonts")


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def cover(im, W, H, zoom=1.0, focus=0.5):
    """ย่อ/ขยายให้เต็มกรอบ W×H (crop กลาง, focus = ตำแหน่งแนวนอน 0..1)"""
    r = max(W / im.width, H / im.height) * zoom
    im = im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))), Image.LANCZOS)
    x = int((im.width - W) * focus)
    y = (im.height - H) // 2
    x = min(max(x, 0), im.width - W)
    y = min(max(y, 0), im.height - H)
    return im.crop((x, y, x + W, y + H))


def auto_side(base, W, H):
    """เลือกฝั่งที่ 'ว่าง' กว่า (รกน้อยกว่า) ให้เอาข้อความไปวาง"""
    import numpy as np
    g = base.convert("L").resize((64, 36), Image.BILINEAR)
    a = np.asarray(g, dtype=np.float32)
    gy, gx = np.gradient(a)
    e = np.hypot(gx, gy)
    left = e[:, :30].mean()
    right = e[:, 34:].mean()
    return "left" if left <= right else "right"


def draw_block(base, lines, font_path, side, W, H, stroke_col="#1E3A1E"):
    """วางข้อความหลายบรรทัด ชิดซ้าย/ขวา พร้อมขอบหนาตัดกัน + เงาอ่อน"""
    d0 = ImageDraw.Draw(base)
    # ขนาดอัตโนมัติ: บรรทัดยาวสุดต้องพอดีในความกว้างที่จัดไว้
    avail = int(W * 0.56)
    size = int(H * 0.15)
    while size > 20:
        f = ImageFont.truetype(font_path, size)
        widest = max(d0.textlength(t, font=f) for t, _ in lines)
        if widest <= avail:
            break
        size -= 2
    font = ImageFont.truetype(font_path, size)
    stroke = max(6, size // 9)
    gap = int(size * 0.20)

    heights = []
    for t, _ in lines:
        l, tp, r, b = d0.textbbox((0, 0), t, font=font, stroke_width=stroke)
        heights.append(b - tp)
    total = sum(heights) + gap * (len(lines) - 1)
    y = (H - total) // 2

    for (text, col), hgt in zip(lines, heights):
        l, tp, r, b = d0.textbbox((0, 0), text, font=font, stroke_width=stroke)
        tw = r - l
        x = int(W * 0.05) if side == "left" else W - int(W * 0.05) - tw
        lay = Image.new("RGBA", base.size, (0, 0, 0, 0))
        dl = ImageDraw.Draw(lay)
        # เงาอ่อนให้ลอยจากพื้นหลัง
        dl.text((x - l + 5, y - tp + 6), text, font=font, fill=(0, 0, 0, 90),
                stroke_width=stroke, stroke_fill=(0, 0, 0, 90))
        dl.text((x - l, y - tp), text, font=font, fill=hexrgb(col) + (255,),
                stroke_width=stroke, stroke_fill=hexrgb(stroke_col) + (255,))
        base.alpha_composite(lay)
        y += hgt + gap
    return base


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="ไฟล์ภาพพื้นหลัง (เฟรมในโปรเจกต์)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--font", default="Itim-Regular.ttf")
    ap.add_argument("--line", action="append", required=True,
                    help='บรรทัด "ข้อความ:#SICOL" ใส่ซ้ำได้หลายบรรทัด')
    ap.add_argument("--side", default="auto", choices=["left", "right", "auto"],
                    help="auto = ให้หาฝั่งที่ว่างกว่าเอง")
    ap.add_argument("--stroke-color", default="#1E3A1E")
    ap.add_argument("--zoom", type=float, default=1.0)
    ap.add_argument("--focus", type=float, default=0.5, help="crop แนวนอน 0=ซ้าย 1=ขวา")
    ap.add_argument("--dim", type=float, default=0.0, help="หรี่ฝั่งข้อความ 0..0.5 กันตัวจม")
    ap.add_argument("--size", default="1280x720")
    args = ap.parse_args()

    W, H = (int(v) for v in args.size.split("x"))
    lines = []
    for spec in args.line:
        text, _, col = spec.rpartition(":")
        lines.append((text or spec, col if col.startswith("#") else "#FFFFFF"))

    im = Image.open(args.base).convert("RGB")
    base = cover(im, W, H, args.zoom, args.focus).convert("RGBA")
    side = auto_side(base, W, H) if args.side == "auto" else args.side
    args.side = side
    print(f"[side] {side}")

    if args.dim > 0:
        # ไล่เงาบาง ๆ เฉพาะฝั่งที่มีข้อความ ให้ตัวหนังสืออ่านง่ายโดยไม่เป็นฟิลเตอร์ทั้งภาพ
        grad = Image.new("L", (W, 1))
        for x in range(W):
            p = x / (W - 1)
            v = 1 - p if args.side == "left" else p
            grad.putpixel((x, 0), int(255 * args.dim * max(0.0, v * 1.6 - 0.35)))
        mask = grad.resize((W, H))
        shade = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        shade.putalpha(mask)
        base.alpha_composite(shade)

    base = draw_block(base, lines, os.path.join(FONTS, args.font), side, W, H,
                      args.stroke_color)
    base = ImageEnhance.Color(base.convert("RGB")).enhance(1.06)
    base.save(args.out)
    print(f"✅ {args.out} ({W}x{H})")


if __name__ == "__main__":
    main()
