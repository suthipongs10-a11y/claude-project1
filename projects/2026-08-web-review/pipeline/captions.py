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
# ฟอนต์ไทย (ถ้าจะทำคลิปภาษาไทย ต้องมีอันใดอันหนึ่ง)
THAI_FONTS = [
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
            "caption เป็นภาษาไทยแต่ไม่พบฟอนต์ไทยในเครื่อง — ติดตั้ง Noto Sans Thai "
            "แล้วชี้ด้วย env CAPTION_FONT=/path/NotoSansThai-Bold.ttf"
        )
    found = _first_existing(UI_FONTS if ui else DISPLAY_FONTS) or _first_existing(UI_FONTS)
    if not found:
        raise SystemExit("ไม่พบฟอนต์ใด ๆ — ตั้ง env CAPTION_FONT ชี้ไฟล์ .ttf")
    return found


def _wrap(draw, text: str, font, max_w: int) -> list[str]:
    """ตัดบรรทัดตามความกว้างจริง เคารพ \\n ที่ผู้เขียนใส่มา"""
    lines: list[str] = []
    for para in text.split("\n"):
        words, cur = para.split(), ""
        if not words:
            lines.append("")
            continue
        for w in words:
            trial = f"{cur} {w}".strip()
            if draw.textlength(trial, font=font) <= max_w or not cur:
                cur = trial
            else:
                lines.append(cur)
                cur = w
        lines.append(cur)
    return lines


def render_overlay(
    w: int,
    h: int,
    out_path: Path,
    caption: str | None = None,
    source_label: str | None = None,
    caption_scale: float = 0.062,
    caption_y: float | None = None,
) -> Path | None:
    """สร้าง PNG โปร่งใส WxH ที่มี caption + ป้ายแหล่งที่มา; คืน None ถ้าไม่มีอะไรวาด"""
    if not caption and not source_label:
        return None

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    base = min(w, h)
    vertical = h > w

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
