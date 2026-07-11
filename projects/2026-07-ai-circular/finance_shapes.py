# finance_shapes.py — ภาพลายเส้นเฉพาะคลิป "ดีลวนเวียน AI"
# (ชิป, โหนดบริษัท, ธนบัตร, กราฟฟองสบู่ดิ่ง, หมี, แว่นขยาย)
import math
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from vox_style import (PAPER, INK, SEA, SEA_LT, SAGE, MUSTARD, RED, LABEL,
                       font, _hatch_layer, _taper_line, paper_texture)

GREEN = (74, 122, 86)


def chip_illustration(W=520, label="AI", seed=3):
    """ไมโครชิปลายเส้น + ขาชิปรอบด้าน + ข้อความกลาง"""
    H = W
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = W * 0.24
    box = [m, m, W - m, H - m]
    # ขาชิป
    pins = 6
    for i in range(pins):
        t = (i + .5) / pins
        x = m + (W - 2 * m) * t
        d.line([(x, m - W * .10), (x, m)], fill=INK, width=7)          # บน
        d.line([(x, H - m), (x, H - m + W * .10)], fill=INK, width=7)  # ล่าง
        y = m + (H - 2 * m) * t
        d.line([(m - W * .10, y), (m, y)], fill=INK, width=7)          # ซ้าย
        d.line([(W - m, y), (W - m + W * .10, y)], fill=INK, width=7)  # ขวา
    # ตัวชิป
    d.rounded_rectangle(box, radius=W * .03, fill=PAPER + (255,), outline=INK, width=8)
    inner = [box[0] + W * .06, box[1] + W * .06, box[2] - W * .06, box[3] - W * .06]
    d.rounded_rectangle(inner, radius=W * .02, outline=INK, width=4)
    def m_mask(dm): dm.rounded_rectangle(box, radius=W * .03, fill=255)
    img.alpha_composite(_hatch_layer((W, H), m_mask, spacing=14, angle=.6, alpha=45))
    d = ImageDraw.Draw(img)
    f = font(int(W * .17))
    bb = d.textbbox((0, 0), label, font=f)
    d.text(((W - (bb[2] - bb[0])) / 2, (H - (bb[3] - bb[1])) / 2 - bb[1]), label, font=f, fill=INK)
    return img


def banknote(W=460, seed=5):
    """ธนบัตรลายเส้น มี $ กลาง"""
    H = int(W * .46)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([6, 6, W - 6, H - 6], fill=PAPER + (255,), outline=INK, width=6)
    d.rectangle([20, 20, W - 20, H - 20], outline=INK, width=3)
    d.ellipse([W / 2 - H * .28, H / 2 - H * .28, W / 2 + H * .28, H / 2 + H * .28], outline=INK, width=4)
    f = font(int(H * .42))
    bb = d.textbbox((0, 0), "$", font=f)
    d.text(((W - (bb[2] - bb[0])) / 2, (H - (bb[3] - bb[1])) / 2 - bb[1]), "$", font=f, fill=GREEN)
    for cx in (W * .13, W * .87):
        fc = font(int(H * .2))
        bb = d.textbbox((0, 0), "$", font=fc)
        d.text((cx - (bb[2] - bb[0]) / 2, H / 2 - (bb[3] - bb[1]) / 2 - bb[1]), "$", font=fc, fill=INK)
    return img


def node_badge(name, sub=None, W=300, accent=INK, seed=1):
    """โหนดบริษัทวงกลม (ชื่อ + คำบรรยายเล็ก) สำหรับไดอะแกรมเงินไหลวน"""
    H = W
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # เงา
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([16, 22, W - 8, H - 2], fill=(30, 25, 20, 80))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6)))
    d = ImageDraw.Draw(img)
    d.ellipse([12, 12, W - 12, H - 12], fill=PAPER + (255,), outline=accent, width=9)
    d.ellipse([26, 26, W - 26, H - 26], outline=accent, width=3)
    # ปรับขนาดฟอนต์ให้ชื่อยาว (MICROSOFT/BROADCOM) พอดีในวง
    fsz = int(W * .16)
    while fsz > 12 and max(font(fsz).getbbox(t)[2] for t in name.split("\n")) > W * 0.70:
        fsz -= 2
    f = font(fsz)
    lines = name.split("\n")
    total = sum(f.getbbox(t)[3] + 6 for t in lines) - 6
    y = H / 2 - total / 2 - (H * .05 if sub else 0)
    for t in lines:
        bb = d.textbbox((0, 0), t, font=f)
        d.text(((W - (bb[2] - bb[0])) / 2, y), t, font=f, fill=INK)
        y += bb[3] + 6
    if sub:
        fs = font(int(W * .085))
        bb = d.textbbox((0, 0), sub, font=fs)
        d.text(((W - (bb[2] - bb[0])) / 2, H * .60), sub, font=fs, fill=accent)
    return img


def crash_curve(W=900, seed=8):
    """กราฟฟองสบู่: พุ่งขึ้นชันแล้วดิ่งเหว (dot-com echo)"""
    H = int(W * .62)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0, y0 = W * .1, H * .9
    d.line([(x0, H * .06), (x0, y0)], fill=INK, width=5)   # แกน Y
    d.line([(x0, y0), (W * .96, y0)], fill=INK, width=5)   # แกน X
    pts = []
    n = 120
    peak = 0.62
    for i in range(n):
        t = i / (n - 1)
        if t < peak:
            v = (t / peak) ** 2.4                       # พุ่งเร่ง
        else:
            u = (t - peak) / (1 - peak)
            v = 1 - (u ** .7) * 0.92                     # ดิ่งเร็ว
        x = x0 + (W * .96 - x0) * t
        y = y0 - (y0 - H * .12) * v
        pts.append((x, y))
    peak_i = int(peak * n)
    d.line(pts[:peak_i + 1], fill=GREEN, width=9, joint="curve")
    d.line(pts[peak_i:], fill=RED, width=9, joint="curve")
    px, py = pts[peak_i]
    d.ellipse([px - 11, py - 11, px + 11, py + 11], fill=RED)
    return img, (px, py)


def bear_icon(W=360, seed=4):
    """หมี (ตลาดหมี / เดิมพันขาลง) แบบลายเส้นมินิมอล"""
    H = W
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = W / 2
    # หัว
    d.ellipse([cx - W * .26, H * .12, cx + W * .26, H * .60], fill=PAPER + (255,), outline=INK, width=8)
    # หู
    for s in (-1, 1):
        d.ellipse([cx + s * W * .26 - W * .11, H * .12, cx + s * W * .26 + W * .11, H * .12 + W * .22],
                  fill=PAPER + (255,), outline=INK, width=7)
    # จมูก/ปาก
    d.ellipse([cx - W * .12, H * .34, cx + W * .12, H * .56], fill=PAPER + (255,), outline=INK, width=5)
    d.ellipse([cx - W * .04, H * .40, cx + W * .04, H * .46], fill=INK)
    # ตา
    for s in (-1, 1):
        d.ellipse([cx + s * W * .12 - 8, H * .28 - 8, cx + s * W * .12 + 8, H * .28 + 8], fill=INK)
    # ลูกศรลง (ขาลง)
    ax = cx
    d.line([(ax, H * .64), (ax, H * .92)], fill=RED, width=12)
    d.polygon([(ax - W * .09, H * .84), (ax + W * .09, H * .84), (ax, H * .99)], fill=RED)
    return img


def magnifier(W=320, seed=6):
    """แว่นขยาย (มองเห็นก่อนใคร)"""
    H = W
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = W * .30
    cx, cy = W * .42, H * .40
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=PAPER + (255,), outline=INK, width=10)
    d.line([(cx + r * .7, cy + r * .7), (W * .92, H * .92)], fill=INK, width=16)
    # ประกาย
    d.arc([cx - r * .6, cy - r * .6, cx + r * .2, cy + r * .2], start=180, end=270, fill=INK, width=4)
    return img


def brain_node(W=340, seed=7):
    """โหนด OpenAI กลางวง: ชิปที่มี 'สมอง/ประกาย' """
    img = chip_illustration(W, label="", seed=seed)
    d = ImageDraw.Draw(img)
    cx, cy = W / 2, W / 2
    # ประกายดาว (spark)
    for a in range(8):
        ang = a * math.pi / 4
        r1, r2 = W * .10, W * .19
        d.line([(cx + r1 * math.cos(ang), cy + r1 * math.sin(ang)),
                (cx + r2 * math.cos(ang), cy + r2 * math.sin(ang))], fill=MUSTARD, width=6)
    d.ellipse([cx - W * .085, cy - W * .085, cx + W * .085, cy + W * .085],
              fill=MUSTARD, outline=INK, width=4)
    return img
