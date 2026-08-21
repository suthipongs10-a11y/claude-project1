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
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gemini_api import GeminiError, generate, inline_parts  # noqa: E402

EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}

# หน่วงระหว่างรูป — Gemini มี spend-based rate limit ที่ผูกกับ "บัญชี" ไม่ใช่ผูกกับ key
# (ยืนยันแล้ว: ตอนโดน 429 แม้แต่ gemini-2.5-flash ที่เป็นโมเดล text ก็โดนด้วย)
# ยิงรัวๆ หลายสิบใบติดกันจะตันกลางทาง หน่วงไว้ถูกกว่ารอ backoff ทีหลังมาก
# ปรับได้ด้วย env WS_IMAGE_DELAY
DELAY = float(os.environ.get("WS_IMAGE_DELAY", "8"))


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
        raise GeminiError("โมเดลไม่คืนรูปกลับมา (อาจโดน safety filter — ลองแก้ prompt)")
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

    failed = []
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
        try:
            data, mime = render(
                shot.get("model", model), prompt, shot.get("aspect", default_aspect)
            )
        except GeminiError as e:
            # ล้มใบเดียวไม่ควรทิ้งงานทั้งชุด — จดไว้แล้วไปใบถัดไป
            # รันคำสั่งเดิมซ้ำได้เลย ของที่มีแล้วจะถูกข้าม
            print(f"  {sid}: ล้มเหลว — {str(e)[:120]}", flush=True)
            failed.append(sid)
            time.sleep(DELAY)
            continue
        out = outdir / (sid + EXT.get(mime, ".png"))
        out.write_bytes(data)
        print(f"  {sid}: {len(data) // 1024} KB -> {out.name}", flush=True)
        time.sleep(DELAY)

    if failed:
        print(f"\nยังขาด {len(failed)} ภาพ: {' '.join(failed)}")
        print("รันคำสั่งเดิมซ้ำได้เลย ภาพที่มีแล้วจะถูกข้าม")
        sys.exit(1)


if __name__ == "__main__":
    main()
