"""เรนเดอร์ซับไทยเป็น PNG โปร่งใสด้วย Pillow (Raqm/HarfBuzz)

ทำไมไม่ใช้ libass (ffmpeg -vf subtitles):
    libass ที่มากับ ffmpeg build นี้ "ทิ้ง" วรรณยุกต์ที่ซ้อนอยู่บนสระบน
    เช่น "ที่" เรนเดอร์ออกมาเป็น "ที", "หนึ่ง" -> "หนึง"
    เกิดกับทุกฟอนต์ที่ทดสอบ ยกเว้น Loma
    ส่วน Pillow ใช้ Raqm (HarfBuzz + FriBidi) จัดรูปภาษาไทยถูกต้องกับทุกฟอนต์
    → เรนเดอร์ซับเป็น PNG เองแล้วให้ ffmpeg overlay ทับ
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
FONT_FILE = "NotoSansThai-Bold.ttf"


def _font(size):
    return ImageFont.truetype(str(FONT_DIR / FONT_FILE), size)


def wrap_lines(text, font, max_width):
    """ตัดบรรทัดตามความกว้างจริงที่วัดได้ (ไทยไม่มีเว้นวรรคระหว่างคำ จึงตัดที่ช่องว่าง)"""
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))

    def width(s):
        return probe.textlength(s, font=font)

    lines, cur = [], ""
    for word in text.split(" "):
        trial = f"{cur} {word}".strip()
        if cur and width(trial) > max_width:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def render_cue(lines, size, out, fill="white", stroke="black"):
    """เรนเดอร์ข้อความ 1 คิวเป็น PNG โปร่งใส คืน (path, w, h)"""
    font = _font(size)
    stroke_w = max(2, round(size * 0.11))
    pad = stroke_w * 2 + 6
    line_h = round(size * 1.42)

    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    text_w = max(probe.textlength(l, font=font) for l in lines)
    w = int(text_w) + pad * 2
    h = line_h * len(lines) + pad * 2

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        lw = probe.textlength(line, font=font)
        x = (w - lw) / 2
        y = pad + i * line_h
        # เงาอ่อนๆ ช่วยให้ตัวอักษรลอยขึ้นมาจากภาพพื้นหลังที่สว่าง
        d.text((x + 2, y + 3), line, font=font, fill=(0, 0, 0, 130),
               stroke_width=stroke_w, stroke_fill=(0, 0, 0, 130))
        d.text((x, y), line, font=font, fill=fill,
               stroke_width=stroke_w, stroke_fill=stroke)

    img.save(out)
    return out, w, h


def build_cues(segments, seg_times, frame_w, frame_h, outdir, max_lines=2):
    """สร้าง PNG ของทุกคิวจากสคริปต์ คืน list ของ dict {png,w,h,start,end}"""
    size = round(frame_h * 0.048)
    font = _font(size)
    max_width = frame_w * 0.82
    cues = []

    for seg in segments:
        start, dur = seg_times[seg["id"]]
        lines = wrap_lines(seg["text"], font, max_width)
        total_chars = sum(len(l) for l in lines) or 1
        t = start
        for i in range(0, len(lines), max_lines):
            chunk = lines[i:i + max_lines]
            d = dur * (sum(len(l) for l in chunk) / total_chars)
            png = Path(outdir) / f"cue{len(cues):04d}.png"
            _, w, h = render_cue(chunk, size, png)
            cues.append({"png": png, "w": w, "h": h, "start": t, "end": t + d})
            t += d
    return cues
