#!/usr/bin/env python3
"""สร้างภาพประกอบด้วย Gemini image models

ใช้:
    python3 tools/gen_images.py episodes/<ep>/shots.json          # gen ทั้งหมด (ข้ามอันที่มีแล้ว)
    python3 tools/gen_images.py episodes/<ep>/shots.json v03 v07  # gen ซ้ำเฉพาะช็อต

shots.json รูปแบบ:
{
  "model": "gemini-3-pro-image",
  "aspect": "16:9",
  "style": "cinematic documentary still, 35mm film grain, desaturated cold palette, no text, no watermark",
  "shots": [
    {"id": "v01", "prompt": "..."},
    {"id": "v02", "prompt": "...", "aspect": "9:16"}
  ]
}

หมายเหตุลิขสิทธิ์: ทุกภาพเป็นภาพที่โมเดลสร้างขึ้นใหม่ ไม่ใช่ภาพถ่ายจริงของเหตุการณ์
→ ในคลิปต้องขึ้นข้อความกำกับว่าเป็นภาพจำลอง (ดู README หัวข้อ "กติกาภาพ")
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gemini_api import generate, inline_parts  # noqa: E402

EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}


def render(model, prompt, aspect):
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": aspect},
        },
    }
    parts = inline_parts(generate(model, body))
    if not parts:
        raise SystemExit("โมเดลไม่คืนรูปกลับมา (อาจโดน safety filter — ลองแก้ prompt)")
    return parts[0]


def main():
    shots_path = Path(sys.argv[1])
    cfg = json.loads(shots_path.read_text(encoding="utf-8"))
    only = sys.argv[2:]

    model = cfg.get("model", "gemini-3-pro-image")
    style = cfg.get("style", "")
    default_aspect = cfg.get("aspect", "16:9")
    outdir = shots_path.parent / "images"
    outdir.mkdir(exist_ok=True)

    for shot in cfg["shots"]:
        sid = shot["id"]
        if only and sid not in only:
            continue
        existing = list(outdir.glob(f"{sid}.*"))
        if existing and not only:
            print(f"  ข้าม {sid} (มีแล้ว)")
            continue
        for old in existing:
            old.unlink()

        prompt = shot["prompt"]
        if style:
            prompt = f"{prompt}. {style}"
        data, mime = render(
            shot.get("model", model), prompt, shot.get("aspect", default_aspect)
        )
        out = outdir / (sid + EXT.get(mime, ".png"))
        out.write_bytes(data)
        print(f"  {sid}: {len(data) // 1024} KB -> {out.name}")


if __name__ == "__main__":
    main()
