# vox_style.py — primitives สำหรับกราฟิกสไตล์ Vox paper-collage
# (กระดาษเท็กซ์เจอร์, ขอบกระดาษฉีก, วงไฮไลต์เขียนมือ, ลูกศร, ป้ายกระดาษ, ลายเส้นแกะสลัก)
import math
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ---------- palette ----------
PAPER   = (237, 231, 218)
INK     = (26, 26, 28)
SEA     = (46, 74, 98)
SEA_LT  = (127, 163, 184)
SAGE    = (168, 181, 160)
MUSTARD = (217, 164, 65)
RED     = (172, 58, 50)
LABEL   = (246, 240, 226)

SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SERIF      = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"

_font_cache = {}
def font(size, bold=True):
    key = (size, bold)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(SERIF_BOLD if bold else SERIF, size)
    return _font_cache[key]


# ---------- paper texture ----------
def paper_texture(w, h, base=PAPER, seed=7):
    rng = np.random.default_rng(seed)
    img = np.zeros((h, w, 3), dtype=np.float32)
    img[:, :] = base

    # low-frequency blotches (คราบกระดาษ)
    small = rng.normal(0, 1, (h // 40 + 1, w // 40 + 1)).astype(np.float32)
    blotch = np.array(Image.fromarray(
        ((small - small.min()) / (np.ptp(small) + 1e-6) * 255).astype(np.uint8)
    ).resize((w, h), Image.BICUBIC), dtype=np.float32)
    img += ((blotch - 128.0) / 128.0 * 7.0)[:, :, None]

    # fine grain
    img += rng.normal(0, 2.6, (h, w, 1)).astype(np.float32)

    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))

    # crumple lines จางๆ
    d = ImageDraw.Draw(out, "RGBA")
    r = random.Random(seed)
    for _ in range(5):
        x0, y0 = r.uniform(-w * .2, w), r.uniform(0, h)
        ang = r.uniform(-.6, .6) + (0 if r.random() < .5 else math.pi / 2)
        L = r.uniform(w * .4, w * 1.2)
        x1, y1 = x0 + L * math.cos(ang), y0 + L * math.sin(ang)
        shade = r.choice([(255, 255, 255, 16), (120, 110, 95, 10)])
        d.line([(x0, y0), (x1, y1)], fill=shade, width=r.randint(2, 4))
    out = out.filter(ImageFilter.GaussianBlur(1.6))

    # vignette เบาๆ
    vg = Image.new("L", (w, h), 0)
    dv = ImageDraw.Draw(vg)
    dv.ellipse([-w * .35, -h * .35, w * 1.35, h * 1.35], fill=255)
    vg = vg.filter(ImageFilter.GaussianBlur(w * .18))
    dark = Image.new("RGB", (w, h), (208, 200, 184))
    out = Image.composite(out, dark, vg)
    return out


def _rough_edge(n, amp, seed):
    """ขอบฉีกแบบนุ่ม: จุดควบคุมห่างๆ + interpolate + สั่นละเอียดเบาๆ"""
    r = random.Random(seed)
    step = 42
    ctrl = [r.uniform(-amp, amp) * .8 for _ in range(n // step + 3)]
    off = []
    for x in range(n):
        i, f = divmod(x, step)
        f /= step
        f = f * f * (3 - 2 * f)                       # smoothstep
        base = ctrl[i] * (1 - f) + ctrl[i + 1] * f
        off.append(base + r.uniform(-1.4, 1.4))
    return off


def torn_strip(w, h, color, seed=1, tear_top=True, tear_bottom=False, amp=26):
    """แถบกระดาษสีขอบฉีก + เส้นใยขาวตรงรอยฉีก + เงา (มี margin ในตัว)"""
    M = 40
    layer = Image.new("RGBA", (w + M * 2, h + M * 2), (0, 0, 0, 0))
    top = _rough_edge(w, amp, seed) if tear_top else [0] * w
    bot = _rough_edge(w, amp, seed + 99) if tear_bottom else [0] * w
    poly = [(M + x, M + amp + top[x]) for x in range(w)] + \
           [(M + x, M + h - amp + bot[x]) for x in range(w - 1, -1, -1)]

    # เงา
    sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).polygon([(x + 6, y + 9) for x, y in poly], fill=(30, 25, 20, 90))
    layer.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6)))

    # เส้นใยกระดาษขาว (ใต้ตัวแถบ โผล่ตรงรอยฉีก)
    fib = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    df = ImageDraw.Draw(fib)
    if tear_top:
        df.line([(M + x, M + amp + top[x] - 3) for x in range(w)], fill=(250, 247, 238, 255), width=7)
    if tear_bottom:
        df.line([(M + x, M + h - amp + bot[x] + 3) for x in range(w)], fill=(250, 247, 238, 255), width=7)
    layer.alpha_composite(fib)

    body = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(body).polygon(poly, fill=color + (255,))
    # เท็กซ์เจอร์บนแถบ
    tex = paper_texture(layer.size[0], layer.size[1], base=color, seed=seed + 5)
    body_tex = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    body_tex.paste(tex, (0, 0), body.split()[3])
    layer.alpha_composite(body_tex)
    return layer, M


def label_paper(text, size=54, pad=(34, 22), color=INK, paper=LABEL, rotate=0, max_w=None):
    """ป้ายกระดาษสี่เหลี่ยม + ข้อความ serif + เงา"""
    f = font(size)
    lines = text.split("\n")
    tw = max(f.getbbox(t)[2] for t in lines)
    th = sum(f.getbbox(t)[3] + 10 for t in lines) - 10
    w, h = tw + pad[0] * 2, th + pad[1] * 2
    M = 30
    layer = Image.new("RGBA", (w + M * 2, h + M * 2), (0, 0, 0, 0))
    sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([M + 5, M + 8, M + w + 5, M + h + 8], fill=(30, 25, 20, 95))
    layer.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5)))
    tex = paper_texture(w, h, base=paper, seed=len(text))
    layer.paste(tex, (M, M))
    d = ImageDraw.Draw(layer)
    y = M + pad[1] - 4
    for t in lines:
        d.text((M + pad[0], y), t, font=f, fill=color)
        y += f.getbbox(t)[3] + 10
    if rotate:
        layer = layer.rotate(rotate, expand=True, resample=Image.BICUBIC)
    return layer


# ---------- hand-drawn marks ----------
def hand_ellipse_points(cx, cy, rx, ry, loops=1.75, seed=3, n=260):
    """จุดของวงรีเขียนมือ (สั่นเล็กน้อย, วนเกิน 1 รอบ)"""
    r = random.Random(seed)
    ph1, ph2 = r.uniform(0, 6.28), r.uniform(0, 6.28)
    start = r.uniform(-.6, -.2)
    pts = []
    for i in range(n):
        t = start + loops * 2 * math.pi * i / (n - 1)
        j = 1 + .045 * math.sin(3.1 * t + ph1) + .03 * math.sin(6.7 * t + ph2)
        drift = 1 + .04 * (i / n)          # รอบสองเบี้ยวออกเล็กน้อย
        pts.append((cx + rx * j * drift * math.cos(t),
                    cy + ry * j * drift * math.sin(t)))
    return pts


def draw_stroke(draw, pts, color, width, progress=1.0):
    """วาด polyline แบบปลายมน รองรับ draw-on (progress 0..1)"""
    k = max(2, int(len(pts) * progress))
    seg = pts[:k]
    draw.line(seg, fill=color, width=width, joint="curve")
    for p in (seg[0], seg[-1]):
        draw.ellipse([p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2], fill=color)


def hand_arrow_points(p0, p1, bend=.25, seed=5, n=70):
    """ลูกศรโค้งเขียนมือ: คืน (จุดลำตัว, จุดหัวลูกศร 2 เส้น)"""
    r = random.Random(seed)
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy)
    cx, cy = mx - dy / L * bend * L, my + dx / L * bend * L
    pts = []
    for i in range(n):
        t = i / (n - 1)
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * cx + t ** 2 * p1[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * cy + t ** 2 * p1[1]
        x += r.uniform(-1.5, 1.5); y += r.uniform(-1.5, 1.5)
        pts.append((x, y))
    tx, ty = pts[-1][0] - pts[-4][0], pts[-1][1] - pts[-4][1]
    tl = math.hypot(tx, ty); tx, ty = tx / tl, ty / tl
    hl = max(18, L * .12)
    head = []
    for s in (1, -1):
        a = math.atan2(ty, tx) + math.pi + s * .45
        head.append([p1, (p1[0] + hl * math.cos(a), p1[1] + hl * math.sin(a))])
    return pts, head


# ---------- engraving-style illustrations ----------
def _hatch_layer(size, mask_draw_fn, spacing=9, angle=0.5, width=2, color=INK, alpha=120):
    """เส้น hatch ผ่าน mask"""
    w, h = size
    mask = Image.new("L", size, 0)
    mask_draw_fn(ImageDraw.Draw(mask))
    hatch = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(hatch)
    diag = int(math.hypot(w, h))
    ca, sa = math.cos(angle), math.sin(angle)
    for i in range(-diag, diag * 2, spacing):
        x0, y0 = i * ca - diag * sa, i * sa + diag * ca
        x1, y1 = i * ca + diag * sa, i * sa - diag * ca
        d.line([(x0, y0), (x1, y1)], fill=color + (alpha,), width=width)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(hatch, (0, 0), mask)
    return out


def _taper_line(d, pts, w0, w1, color=INK):
    """เส้นหนาไล่บาง (ขาปู, เสากระโดง)"""
    n = len(pts)
    for i in range(n - 1):
        w = w0 + (w1 - w0) * i / (n - 1)
        d.line([pts[i], pts[i + 1]], fill=color, width=max(1, int(w)))
        d.ellipse([pts[i][0] - w / 2, pts[i][1] - w / 2, pts[i][0] + w / 2, pts[i][1] + w / 2], fill=color)


def crab_illustration(W=900, seed=2):
    """ปูอลาสก้า (king crab) มุมมองบน — วาดครึ่งขวาแล้ว mirror ให้สมมาตร"""
    H = int(W * .74)
    cx, cy = W / 2, H * .44
    rx, ry = W * .185, H * .23
    r = random.Random(seed)

    def draw_leg(d, base_ang, L, w0):
        """ขาเดิน 3 ท่อน กางออกแล้วโค้งลง (พิกัดฝั่งขวา)"""
        x = cx + rx * .88 * math.cos(base_ang)
        y = cy + ry * .80 * math.sin(base_ang)
        a = base_ang * .55
        w = w0
        for i, (fl, bend) in enumerate([(.36, 0), (.32, .55), (.28, 1.05)]):
            sl = L * fl
            na = a + bend
            nx, ny = x + sl * math.cos(na), y + sl * math.sin(na)
            pts = [(x + (nx - x) * t + r.uniform(-1.2, 1.2),
                    y + (ny - y) * t + r.uniform(-1.2, 1.2)) for t in np.linspace(0, 1, 7)]
            _taper_line(d, pts, w, w * .62)
            # หนามตามขา ชี้ออกนอก
            for t in (.3, .65):
                px, py = x + (nx - x) * t, y + (ny - y) * t
                d.line([(px, py), (px + 8 * math.cos(na - 1.2), py + 8 * math.sin(na - 1.2))],
                       fill=INK, width=3)
            x, y, w = nx, ny, w * .62
        # ปลายแหลม
        tip = (x + L * .06 * math.cos(a + 1.35), y + L * .06 * math.sin(a + 1.35))
        d.line([(x, y), tip], fill=INK, width=max(2, int(w * .5)))

    def draw_claw(d, scale):
        """แขน + ก้ามคีบ (พิกัดฝั่งขวา ชี้ขึ้นหน้า)"""
        ax, ay = cx + rx * .62, cy - ry * .62
        mx, my = ax + W * .10 * scale, ay - H * .10 * scale
        ex, ey = mx + W * .09 * scale, my - H * .13 * scale
        _taper_line(d, [(ax, ay), (mx, my)], W * .022, W * .018)
        _taper_line(d, [(mx, my), (ex, ey)], W * .018, W * .015)
        # ก้าม: วงรีเอียงตามแนวแขน + ปากคีบ 2 แฉก
        ang = math.atan2(ey - my, ex - mx)
        cw = W * .075 * scale
        claw = Image.new("RGBA", (int(cw * 3.4), int(cw * 2.4)), (0, 0, 0, 0))
        dc = ImageDraw.Draw(claw)
        ccx, ccy = cw * 1.2, cw * 1.2
        dc.ellipse([ccx - cw, ccy - cw * .62, ccx + cw * .6, ccy + cw * .62],
                   fill=PAPER + (255,), outline=INK, width=6)
        # นิ้วคีบบน-ล่าง
        dc.polygon([(ccx + cw * .45, ccy - cw * .5), (ccx + cw * 1.9, ccy - cw * .28),
                    (ccx + cw * .55, ccy - cw * .05)], fill=PAPER + (255,), outline=INK, width=5)
        dc.polygon([(ccx + cw * .5, ccy + cw * .45), (ccx + cw * 1.7, ccy + cw * .12),
                    (ccx + cw * .55, ccy - cw * .02)], fill=PAPER + (255,), outline=INK, width=5)
        # hatch บนก้าม
        def cm(dm):
            dm.ellipse([ccx - cw, ccy - cw * .62, ccx + cw * .6, ccy + cw * .62], fill=255)
        claw.alpha_composite(_hatch_layer(claw.size, cm, spacing=8, angle=.9, alpha=80))
        claw = claw.rotate(-math.degrees(ang) , resample=Image.BICUBIC, expand=True)
        d._image.alpha_composite(claw, dest=(int(ex - claw.width * .38), int(ey - claw.height * .55)))

    # --- ครึ่งขวา (ขา 3 เส้น) ---
    half = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dh = ImageDraw.Draw(half)
    for ang, L in [(-.42, W * .42), (.05, W * .47), (.5, W * .44)]:
        draw_leg(dh, ang, L, W * .017)

    img = half.copy()
    img.alpha_composite(half.transpose(Image.FLIP_LEFT_RIGHT))
    d = ImageDraw.Draw(img)

    # --- ก้ามซ้าย-ขวา (ขวาใหญ่กว่า ตามปูจริง) ---
    right = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(right)
    draw_claw(dr, 1.15)
    img.alpha_composite(right)
    left = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dl = ImageDraw.Draw(left)
    draw_claw(dl, .88)
    img.alpha_composite(left.transpose(Image.FLIP_LEFT_RIGHT))
    d = ImageDraw.Draw(img)

    # --- ลำตัว (carapace) รูปหยดน้ำมน หนามรอบ ---
    body = []
    for i in range(56):
        t = 2 * math.pi * i / 56
        rr = 1 + .07 * math.cos(2 * t + 2.4) + .04 * math.sin(4 * t + .5)
        rr *= 1 + .06 * math.sin(t - math.pi / 2)      # หน้าแคบ ท้ายกว้างเล็กน้อย
        body.append((cx + rx * rr * math.cos(t), cy + ry * rr * math.sin(t)))
    d.polygon(body, fill=PAPER + (255,))
    for i in range(0, 56, 4):
        bx, by = body[i]
        vx, vy = bx - cx, by - cy
        vl = math.hypot(vx, vy)
        d.line([(bx, by), (bx + vx / vl * 15, by + vy / vl * 15)], fill=INK, width=4)
    d.line(body + [body[0]], fill=INK, width=7, joint="curve")
    def body_mask(dm, pts=body):
        dm.polygon(pts, fill=255)
    img.alpha_composite(_hatch_layer((W, H), body_mask, spacing=11, angle=.55, alpha=70))
    d = ImageDraw.Draw(img)
    # หนามกลางหลัง 3 จุด (เอกลักษณ์ red king crab) + ตา
    for px, py in [(cx, cy - ry * .15), (cx - rx * .3, cy + ry * .2), (cx + rx * .3, cy + ry * .2)]:
        d.ellipse([px - 6, py - 6, px + 6, py + 6], fill=INK)
    for s in (-1, 1):
        ex, ey = cx + s * rx * .3, cy - ry * .98
        d.ellipse([ex - 10, ey - 10, ex + 10, ey + 10], fill=INK)
        d.line([(ex, ey), (ex + s * 4, ey - 16)], fill=INK, width=4)
    return img


def boat_illustration(W=980, seed=4):
    """เรือปูใน คลื่น สไตล์ลายเส้น"""
    H = int(W * .62)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = random.Random(seed)
    hy = H * .58                       # แนวดาดฟ้า
    # ตัวเรือ
    hull = [(W * .08, hy), (W * .92, hy), (W * .86, H * .82), (W * .18, H * .82)]
    d.polygon(hull, fill=PAPER + (255,))
    d.line(hull + [hull[0]], fill=INK, width=7, joint="curve")
    d.line([(W * .08, hy), (W * .05, hy - H * .10)], fill=INK, width=7)   # หัวเรือเชิด
    def hull_mask(dm): dm.polygon(hull, fill=255)
    img.alpha_composite(_hatch_layer((W, H), hull_mask, spacing=9, angle=.15, alpha=70))
    # เก๋งเรือ (หน้า)
    d.rectangle([W * .14, hy - H * .30, W * .34, hy], fill=PAPER + (255,), outline=INK, width=6)
    d.rectangle([W * .17, hy - H * .26, W * .31, hy - H * .16], outline=INK, width=4)  # หน้าต่าง
    d.line([(W * .24, hy - H * .30), (W * .24, hy - H * .44)], fill=INK, width=5)      # เสาอากาศ
    # เครนยกลอบ (A-frame ท้ายเรือ)
    d.line([(W * .62, hy), (W * .70, hy - H * .38)], fill=INK, width=6)
    d.line([(W * .80, hy), (W * .70, hy - H * .38)], fill=INK, width=6)
    d.line([(W * .70, hy - H * .38), (W * .70, hy - H * .12)], fill=INK, width=4)      # สลิง
    # ลอบซ้อนบนดาดฟ้า
    for i in range(3):
        x0 = W * (.40 + i * .11)
        d.rectangle([x0, hy - H * .12, x0 + W * .09, hy], outline=INK, width=4)
        d.line([(x0, hy - H * .12), (x0 + W * .09, hy)], fill=INK, width=3)
        d.line([(x0 + W * .09, hy - H * .12), (x0, hy)], fill=INK, width=3)
    # ลอบห้อยเครน
    d.rectangle([W * .655, hy - H * .12, W * .745, hy - H * .02], outline=INK, width=4)
    # คลื่นเขียนมือ
    for row in range(3):
        y0 = H * (.80 + row * .07)
        pts = []
        for x in range(0, W, 6):
            pts.append((x, y0 + 10 * math.sin(x / 46 + row * 2) + r.uniform(-2, 2)))
        d.line(pts, fill=SEA + (255,), width=6 - row, joint="curve")
    return img


def pot_illustration(W=760, seed=6):
    """ลอบปูเหล็ก (crab pot) มุมเฉียง"""
    H = int(W * .78)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # กล่อง perspective
    f = [(W * .12, H * .38), (W * .72, H * .30), (W * .78, H * .78), (W * .18, H * .88)]  # หน้า
    off = (W * .16, -H * .16)
    b = [(x + off[0], y + off[1]) for x, y in f]
    for i in range(4):                          # เส้นเชื่อมหลัง-หน้า
        d.line([f[i], b[i]], fill=INK, width=5)
    d.line(b + [b[0]], fill=INK, width=5, joint="curve")
    d.line(f + [f[0]], fill=INK, width=8, joint="curve")
    # ตาข่ายหน้า
    for t in np.linspace(.14, .86, 6):
        p0 = (f[0][0] + (f[1][0] - f[0][0]) * t, f[0][1] + (f[1][1] - f[0][1]) * t)
        p1 = (f[3][0] + (f[2][0] - f[3][0]) * t, f[3][1] + (f[2][1] - f[3][1]) * t)
        d.line([p0, p1], fill=INK, width=2)
        q0 = (f[0][0] + (f[3][0] - f[0][0]) * t, f[0][1] + (f[3][1] - f[0][1]) * t)
        q1 = (f[1][0] + (f[2][0] - f[1][0]) * t, f[1][1] + (f[2][1] - f[1][1]) * t)
        d.line([q0, q1], fill=INK, width=2)
    # ช่องทางเข้า (tunnel) วงรีบนหน้า
    cxp = ((f[0][0] + f[2][0]) / 2, (f[0][1] + f[2][1]) / 2)
    d.ellipse([cxp[0] - W * .13, cxp[1] - H * .10, cxp[0] + W * .13, cxp[1] + H * .10],
              outline=INK, width=7)
    d.ellipse([cxp[0] - W * .07, cxp[1] - H * .055, cxp[0] + W * .07, cxp[1] + H * .055],
              outline=INK, width=4)
    # เชือกทุ่นด้านบน (ผูกกลางขอบบนด้านหลัง)
    top = ((b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2)
    d.ellipse([top[0] - 9, top[1] - 9, top[0] + 9, top[1] + 9], outline=INK, width=5)
    rope = [(top[0] + 14 * math.sin(i / 2.2), top[1] - 6 - i * H * .012) for i in range(16)]
    d.line(rope, fill=INK, width=4, joint="curve")
    d.ellipse([rope[-1][0] - 16, rope[-1][1] - 16, rope[-1][0] + 16, rope[-1][1] + 16],
              outline=INK, width=5)
    return img


# ตำแหน่ง Dutch Harbor บนเลเยอร์แผนที่ (สัดส่วน 0..1)
DUTCH_HARBOR = (.115, .885)

def alaska_map(W=880, seed=8):
    """แผนที่อลาสก้า (เส้นชายฝั่งอย่างง่ายแต่จำได้) + หมู่เกาะ Aleutian"""
    H = int(W * .80)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = [
        (.08, .18),                                  # Point Hope
        (.18, .10), (.30, .06), (.46, .08), (.60, .12), (.72, .16),   # ชายฝั่งเหนือ
        (.72, .34), (.72, .55),                      # พรมแดนแคนาดา
        (.79, .61), (.87, .71), (.95, .82),          # แพนแฮนเดิล SE
        (.90, .84), (.80, .74), (.71, .67), (.63, .61),
        (.56, .63), (.51, .57), (.45, .63),          # ชายฝั่งใต้ (Kenai)
        (.37, .67), (.28, .73), (.19, .79), (.11, .85),  # คาบสมุทรอลาสก้า
        (.14, .78), (.20, .70), (.17, .62),          # Bristol Bay
        (.23, .55), (.15, .49),                      # ปากแม่น้ำ Yukon
        (.21, .41), (.10, .35), (.22, .28),          # คาบสมุทร Seward
        (.15, .22),
    ]
    poly = [(x * W, y * H) for x, y in pts]
    d.polygon(poly, fill=PAPER + (255,))
    d.line(poly + [poly[0]], fill=INK, width=6, joint="curve")
    def m(dm): dm.polygon(poly, fill=255)
    img.alpha_composite(_hatch_layer((W, H), m, spacing=13, angle=.9, alpha=50))
    # หมู่เกาะ Aleutian ต่อจากปลายคาบสมุทร โค้งลงซ้าย
    d = ImageDraw.Draw(img)
    for i in range(8):
        t = i / 7
        x = W * (.095 - .085 * t)
        y = H * (.88 + .06 * math.sin(t * 2.6) + .02 * t)
        rr = 6.5 - 3.5 * t
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=INK)
    return img


def snow_crab_swarm(W=900, n=60, seed=11):
    """ฝูงปูตัวเล็กๆ (สำหรับฉาก 10 พันล้านตัว)"""
    H = int(W * .95)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = random.Random(seed)
    for _ in range(n):
        x, y = r.uniform(30, W - 30), r.uniform(30, H - 30)
        s = r.uniform(9, 20)
        col = INK + (r.randint(120, 230),)
        d.ellipse([x - s, y - s * .7, x + s, y + s * .7], outline=col, width=3)
        for side in (-1, 1):
            for k in range(3):
                a = -0.5 + k * .5
                d.line([(x + side * s * .8, y), (x + side * s * 1.8, y + s * (a))], fill=col, width=2)
    return img


def clock_icon(W=250):
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([12, 12, W - 12, W - 12], outline=INK, width=9)
    d.line([(W / 2, W / 2), (W / 2, W * .22)], fill=INK, width=8)
    d.line([(W / 2, W / 2), (W * .70, W * .58)], fill=INK, width=8)
    for i in range(12):
        a = i * math.pi / 6
        d.line([(W / 2 + (W * .40) * math.cos(a), W / 2 + (W * .40) * math.sin(a)),
                (W / 2 + (W * .45) * math.cos(a), W / 2 + (W * .45) * math.sin(a))], fill=INK, width=5)
    return img


def hook_icon(W=250):
    """ลอบถูกดึงขึ้น (haul) — ลูกศรขึ้น + ลอบ"""
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(W * .36, W * .22), (W * .64, W * .22), (W * .5, W * .03)], fill=INK)
    d.line([(W * .5, W * .16), (W * .5, W * .48)], fill=INK, width=9)
    d.rectangle([W * .25, W * .55, W * .75, W * .9], outline=INK, width=8)
    d.line([(W * .25, W * .55), (W * .75, W * .9)], fill=INK, width=4)
    d.line([(W * .75, W * .55), (W * .25, W * .9)], fill=INK, width=4)
    return img


def down_icon(W=250):
    """ลอบจม (drop)"""
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([W * .25, W * .1, W * .75, W * .45], outline=INK, width=8)
    d.line([(W * .25, W * .1), (W * .75, W * .45)], fill=INK, width=4)
    d.line([(W * .75, W * .1), (W * .25, W * .45)], fill=INK, width=4)
    d.line([(W * .5, W * .55), (W * .5, W * .86)], fill=INK, width=9)
    d.polygon([(W * .36, W * .78), (W * .64, W * .78), (W * .5, W * .97)], fill=INK)
    return img


def thermo_icon(W=250):
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([W * .42, W * .08, W * .58, W * .62], radius=W * .08, outline=INK, width=8)
    d.ellipse([W * .32, W * .55, W * .68, W * .92], outline=INK, width=8)
    d.ellipse([W * .40, W * .63, W * .60, W * .84], fill=RED)
    d.line([(W * .5, W * .68), (W * .5, W * .30)], fill=RED, width=int(W * .07))
    return img
