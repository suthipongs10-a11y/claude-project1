#!/usr/bin/env python3
"""เรนเดอร์ caption/ป้ายแหล่งที่มา เป็น PNG โปร่งใสขนาดเท่าเฟรม

ทำเป็น PNG แล้ว overlay แทนการใช้ filter drawtext ของ ffmpeg เพราะ
ffmpeg static ที่มากับ imageio-ffmpeg ถูก build มาโดยไม่มี libfreetype
(ไม่มี drawtext) — และวิธีนี้คุมตัวอักษร/กล่อง/ฟอนต์ไทยได้ดีกว่า
"""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ฟอนต์หัวข้อ: ตัวหนาแบบ display เอาไว้ทำ caption กลางจอ
DISPLAY_FONTS = [
    "/mnt/skills/examples/canvas-design/canvas-fonts/BigShoulders-Bold.ttf",
    "/mnt/skills/examples/canvas-design/canvas-fonts/Anton-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
# ฟอนต์ UI: ป้าย URL / แหล่งที่มา ตัวเล็ก อ่านง่าย
UI_FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
]
# ฟอนต์ไทย — ตัวแรกคือไฟล์ที่ fetch_font.py โหลดมาไว้ในโปรเจกต์
_PROJ = Path(__file__).resolve().parent.parent
THAI_FONTS = [
    str(_PROJ / "fonts" / "NotoSansThai-Bold.ttf"),
    "/usr/share/fonts/truetype/noto/NotoSansThai-Bold.ttf",
    "/usr/share/fonts/truetype/thai/Loma-Bold.ttf",
    os.path.expanduser("~/.fonts/NotoSansThai-Bold.ttf"),
]


def _first_existing(paths: list[str]) -> str | None:
    for p in paths:
        if p and Path(p).exists():
            return p
    return None


def has_thai(text: str) -> bool:
    return any("฀" <= ch <= "๿" for ch in text)


def pick_font(text: str, ui: bool = False) -> str:
    """เลือกฟอนต์ตามภาษาของข้อความ; env CAPTION_FONT ทับได้ทั้งหมด"""
    override = os.environ.get("CAPTION_FONT")
    if override and Path(override).exists():
        return override
    if has_thai(text):
        thai = _first_existing(THAI_FONTS)
        if thai:
            return thai
        raise SystemExit(
            "caption เป็นภาษาไทยแต่ไม่พบฟอนต์ไทย — โหลดด้วย:\n"
            "  python3 pipeline/fetch_font.py --family 'Noto Sans Thai' "
            "--weight 700 -o fonts/NotoSansThai-Bold.ttf"
        )
    found = _first_existing(UI_FONTS if ui else DISPLAY_FONTS) or _first_existing(UI_FONTS)
    if not found:
        raise SystemExit("ไม่พบฟอนต์ใด ๆ — ตั้ง env CAPTION_FONT ชี้ไฟล์ .ttf")
    return found


# สระ/วรรณยุกต์ที่เกาะตัวพยัญชนะ — ห้ามขึ้นบรรทัดใหม่นำหน้าตัวพวกนี้
THAI_COMBINING = set("ัิีึืฺุู"
                     "็่้๊๋์ํ๎")
# สระหน้า — ต้องอยู่ติดกับพยัญชนะที่ตามมา
THAI_LEADING_VOWEL = set("เแโใไ")


def _can_break_before(word: str, i: int) -> bool:
    if i <= 0 or i >= len(word):
        return False
    if word[i] in THAI_COMBINING:
        return False
    if word[i - 1] in THAI_LEADING_VOWEL:
        return False
    return True


def _break_long(draw, word: str, font, max_w: int) -> list[str]:
    """ตัดคำที่ยาวเกินบรรทัด — ภาษาไทยไม่เว้นวรรคระหว่างคำ ทั้งประโยคจึงนับเป็น
    คำเดียว ถ้าไม่ตัดตรงนี้ caption จะล้นจอ

    ไม่มี dictionary ตัดคำ (จะต้องลง pythainlp) แต่กันเคสที่อ่านไม่ออกจริง ๆ ไว้:
    ไม่ตัดหน้าสระ/วรรณยุกต์ที่เกาะพยัญชนะ และไม่ตัดหลังสระหน้า
    """
    out, start = [], 0
    for i in range(1, len(word) + 1):
        if draw.textlength(word[start:i], font=font) <= max_w:
            continue
        # ถอยหาจุดตัดที่ยอมรับได้
        cut = i - 1
        while cut > start + 1 and not _can_break_before(word, cut):
            cut -= 1
        if cut <= start:
            cut = i - 1
        out.append(word[start:cut])
        start = cut
    if start < len(word):
        out.append(word[start:])
    return out or [word]


def _wrap(draw, text: str, font, max_w: int) -> list[str]:
    """ตัดบรรทัดตามความกว้างจริง เคารพ \\n ที่ผู้เขียนใส่มา"""
    lines: list[str] = []
    for para in text.split("\n"):
        words = para.split()
        if not words:
            lines.append("")
            continue
        cur = ""
        for w in words:
            trial = f"{cur} {w}".strip()
            if draw.textlength(trial, font=font) <= max_w:
                cur = trial
                continue
            if cur:
                lines.append(cur)
            if draw.textlength(w, font=font) > max_w:
                chunks = _break_long(draw, w, font, max_w)
                lines.extend(chunks[:-1])
                cur = chunks[-1]
            else:
                cur = w
        if cur:
            lines.append(cur)
    return lines


def _draw_centered(d, text, font, w, y, fill, stroke_w, stroke_fill, max_w):
    """วาดข้อความกลางจอ ตัดบรรทัดให้ คืนความสูงที่ใช้ไป"""
    lines = _wrap(d, text, font, max_w)
    asc, desc = font.getmetrics()
    lh = int((asc + desc) * 1.12)
    for line in lines:
        tw = d.textlength(line, font=font)
        d.text(((w - tw) / 2, y), line, font=font, fill=fill,
               stroke_width=stroke_w, stroke_fill=stroke_fill)
        y += lh
    return lh * len(lines)


def render_overlay(
    w: int,
    h: int,
    out_path: Path,
    caption: str | None = None,
    source_label: str | None = None,
    caption_scale: float = 0.062,
    caption_y: float | None = None,
    headline: str | None = None,
    headline_scale: float = 0.15,
    headline_color: tuple = (108, 158, 255, 255),
    headline_y: float = 0.42,
) -> Path | None:
    """สร้าง PNG โปร่งใส WxH; คืน None ถ้าไม่มีอะไรวาด

    headline = ตัวเลขใหญ่สำหรับการ์ดสเปก/ราคา (เช่น "9,999 หยวน") วาดเหนือ caption
    """
    if not caption and not source_label and not headline:
        return None

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    base = min(w, h)
    vertical = h > w

    if headline:
        size = max(20, int(base * headline_scale))
        font = ImageFont.truetype(pick_font(headline), size)
        used = _draw_centered(d, headline, font, w, int(h * headline_y),
                              headline_color, max(2, size // 16),
                              (0, 0, 0, 200), int(w * 0.88))
        if caption_y is None:
            # caption_y เป็นจุดกลางของบล็อก caption จึงต้องบวกครึ่งความสูงบรรทัดเข้าไป
            gap = base * 0.045
            half_line = base * caption_scale * 1.16 / 2
            caption_y = headline_y + (used + gap + half_line) / h

    if caption:
        size = max(14, int(base * caption_scale))
        font = ImageFont.truetype(pick_font(caption), size)
        max_w = int(w * 0.86)
        lines = _wrap(d, caption, font, max_w)
        lh = int(size * 1.16)
        block_h = lh * len(lines)
        anchor = caption_y if caption_y is not None else (0.74 if vertical else 0.80)
        y = int(h * anchor) - block_h // 2
        stroke = max(2, size // 12)
        for line in lines:
            tw = d.textlength(line, font=font)
            d.text(
                ((w - tw) / 2, y),
                line,
                font=font,
                fill=(255, 255, 255, 255),
                stroke_width=stroke,
                stroke_fill=(0, 0, 0, 235),
            )
            y += lh

    if source_label:
        size = max(11, int(base * 0.030))
        font = ImageFont.truetype(pick_font(source_label, ui=True), size)
        pad = int(base * 0.022)
        tw = d.textlength(source_label, font=font)
        box_h = int(size * 1.95)
        box_w = int(tw + size * 1.5)
        d.rounded_rectangle(
            [pad, pad, pad + box_w, pad + box_h],
            radius=int(size * 0.5),
            fill=(8, 11, 18, 165),
            outline=(255, 255, 255, 46),
            width=max(1, size // 14),
        )
        d.text(
            (pad + size * 0.75, pad + (box_h - size * 1.22) / 2),
            source_label,
            font=font,
            fill=(240, 245, 252, 245),
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)
    return out_path
