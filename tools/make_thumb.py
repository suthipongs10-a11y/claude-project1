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


def draw_block(base, lines, font_path, side, W, H, stroke_col="#1E3A1E",
               width_frac=0.56, align="side", y_offset=0.0):
    """วางข้อความหลายบรรทัด พร้อมขอบหนาตัดกัน + เงาอ่อน

    lines = [(ข้อความ, สี, ตัวคูณขนาด)] — ตัวคูณใช้เน้นบรรทัดสำคัญให้ใหญ่กว่า
    ย่อขนาดอัตโนมัติจนพอดีทั้ง "ความกว้าง" และ "ความสูงรวม"
    align: side = ชิดซ้าย/ขวาตาม side, center = กลางจอ
    """
    d0 = ImageDraw.Draw(base)
    avail_w = int(W * width_frac)
    avail_h = int(H * 0.84)
    size = int(H * 0.17)

    def layout(base_size):
        fonts, dims = [], []
        for text, _, sc in lines:
            fs = max(10, int(base_size * sc))
            f = ImageFont.truetype(font_path, fs)
            st = max(4, fs // 9)
            l, tp, r, b = d0.textbbox((0, 0), text, font=f, stroke_width=st)
            fonts.append((f, st))
            dims.append((l, tp, r - l, b - tp))
        gap = int(base_size * 0.14)
        tot_h = sum(d[3] for d in dims) + gap * (len(lines) - 1)
        max_w = max(d[2] for d in dims)
        return fonts, dims, gap, tot_h, max_w

    while size > 12:
        fonts, dims, gap, tot_h, max_w = layout(size)
        if max_w <= avail_w and tot_h <= avail_h:
            break
        size -= 2

    # เลื่อนได้ แต่ล็อกไม่ให้บล็อกหลุดขอบ (สระ/วรรณยุกต์ไทยจะโดนตัด)
    pad = int(H * 0.035)
    y = (H - tot_h) // 2 + int(H * y_offset)
    y = min(max(y, pad), max(pad, H - tot_h - pad))
    margin = int(W * 0.05)
    for (text, col, _), (f, st), (l, tp, tw, th) in zip(lines, fonts, dims):
        if align == "center":
            x = (W - tw) // 2
        else:
            x = margin if side == "left" else W - margin - tw
        lay = Image.new("RGBA", base.size, (0, 0, 0, 0))
        dl = ImageDraw.Draw(lay)
        # เงาอ่อนให้ลอยจากพื้นหลัง
        dl.text((x - l + 5, y - tp + 6), text, font=f, fill=(0, 0, 0, 100),
                stroke_width=st, stroke_fill=(0, 0, 0, 100))
        dl.text((x - l, y - tp), text, font=f, fill=hexrgb(col) + (255,),
                stroke_width=st, stroke_fill=hexrgb(stroke_col) + (255,))
        base.alpha_composite(lay)
        y += th + gap
    return base


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="ไฟล์ภาพพื้นหลัง (เฟรมในโปรเจกต์)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--font", default="Itim-Regular.ttf")
    ap.add_argument("--line", action="append", required=True,
                    help='บรรทัด "ข้อความ:#SICOL" หรือ "ข้อความ:#SICOL:1.4" (1.4 = ตัวคูณขนาด)')
    ap.add_argument("--width-frac", type=float, default=0.56,
                    help="สัดส่วนความกว้างที่ให้ข้อความใช้ (0.9 = เกือบเต็มจอ)")
    ap.add_argument("--align", default="side", choices=["side", "center"])
    ap.add_argument("--y-offset", type=float, default=0.0,
                    help="เลื่อนบล็อกข้อความขึ้น/ลง (-0.2 = ขึ้น 20% ของความสูง)")
    ap.add_argument("--side", default="auto", choices=["left", "right", "auto"],
                    help="auto = ให้หาฝั่งที่ว่างกว่าเอง")
    ap.add_argument("--stroke-color", default="#1E3A1E")
    ap.add_argument("--zoom", type=float, default=1.0)
    ap.add_argument("--focus", type=float, default=0.5, help="crop แนวนอน 0=ซ้าย 1=ขวา")
    ap.add_argument("--dim", type=float, default=0.0, help="หรี่ฝั่งข้อความ 0..0.5 กันตัวจม")
    ap.add_argument("--dim-all", type=float, default=0.0,
                    help="หรี่ทั้งภาพเท่ากัน 0..0.6 (ใช้ตอนข้อความคลุมทั้งจอ)")
    ap.add_argument("--size", default="1280x720")
    args = ap.parse_args()

    W, H = (int(v) for v in args.size.split("x"))
    lines = []
    for spec in args.line:
        parts = spec.split(":")
        scale = 1.0
        if len(parts) >= 3 and parts[-2].startswith("#"):
            try:
                scale = float(parts[-1]); parts = parts[:-1]
            except ValueError:
                pass
        col = parts[-1] if parts[-1].startswith("#") else "#FFFFFF"
        text = ":".join(parts[:-1]) if parts[-1].startswith("#") else spec
        lines.append((text, col, scale))

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

    if args.dim_all > 0:
        base.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, int(255 * args.dim_all))))

    base = draw_block(base, lines, os.path.join(FONTS, args.font), side, W, H,
                      args.stroke_color, args.width_frac, args.align, args.y_offset)
    base = ImageEnhance.Color(base.convert("RGB")).enhance(1.06)
    base.save(args.out)
    print(f"✅ {args.out} ({W}x{H})")


if __name__ == "__main__":
    main()
