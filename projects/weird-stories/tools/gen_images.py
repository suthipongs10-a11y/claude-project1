#!/usr/bin/env python3
"""สร้างภาพประกอบด้วย Gemini image models

ใช้:
    python3 tools/gen_images.py episodes/<ep>/shots.json          # ใช้ Batch API (ถูกลงครึ่งหนึ่ง)
    python3 tools/gen_images.py episodes/<ep>/shots.json --now    # เรียกทีละใบ ได้ผลเร็วแต่เต็มราคา
    python3 tools/gen_images.py episodes/<ep>/shots.json v03 v07  # ทำเฉพาะช็อตที่ระบุ

ประหยัดค่า API สองชั้น:
  1. แคช content-addressed — prompt เดิม = ไม่จ่ายซ้ำ แม้จะลบไฟล์ในโปรเจกต์ไปแล้ว
     (ของเดิมเช็คแค่ว่ามีไฟล์ชื่อนี้ไหม ซึ่งทั้งจ่ายซ้ำเวลาลบไฟล์
      และ "ไม่" สร้างใหม่เวลาแก้ prompt ซึ่งผิด)
  2. Batch API — ราคาครึ่งเดียว แลกกับรอคิวสักพัก
     เหมาะกับงานนี้เพราะภาพทุกใบถูกสร้างจนครบก่อนเริ่มเรนเดอร์อยู่แล้ว

shots.json รูปแบบ:
{
  "model": "gemini-3.1-flash-image",
  "aspect": "16:9",
  "style": "cinematic documentary still, no text, no watermark",
  "shots": [
    {"id": "v01", "seg": "s01", "prompt": "..."},
    {"id": "v02", "seg": "s01", "prompt": "...", "model": "gemini-3-pro-image"}
  ]
}

หมายเหตุลิขสิทธิ์: ทุกภาพเป็นภาพที่โมเดลสร้างขึ้นใหม่ ไม่ใช่ภาพถ่ายจริงของเหตุการณ์
→ ในคลิปต้องขึ้นข้อความกำกับว่าเป็นภาพจำลอง (ดู README หัวข้อ "กติกาภาพ")
"""
import base64
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import cache  # noqa: E402
import gemini_batch  # noqa: E402
from gemini_api import GeminiError, generate, inline_parts  # noqa: E402

EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
MIME = {v: k for k, v in EXT.items()}

# หน่วงระหว่างรูปสำหรับโหมด --now — Gemini มี spend-based rate limit ที่ผูกกับ "บัญชี" ไม่ใช่ผูกกับ key
# (ยืนยันแล้ว: ตอนโดน 429 แม้แต่ gemini-2.5-flash ที่เป็นโมเดล text ก็โดนด้วย)
# โหมด batch ไม่ต้องหน่วง เพราะส่งเป็นชุดเดียว
DELAY = float(os.environ.get("WS_IMAGE_DELAY", "8"))


def body_for(prompt, aspect):
    return {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": aspect},
        },
    }


def save(outdir, sid, data, mime):
    for old in outdir.glob(f"{sid}.*"):
        old.unlink()
    out = outdir / (sid + EXT.get(mime, ".png"))
    out.write_bytes(data)
    return out


def first_image(resp):
    for part in resp.get("candidates", [{}])[0].get("content", {}).get("parts", []):
        if "inlineData" in part:
            return base64.b64decode(part["inlineData"]["data"]), part["inlineData"]["mimeType"]
    return None, None


def main():
    shots_path = Path(sys.argv[1])
    flags = {a for a in sys.argv[2:] if a.startswith("--")}
    only = [a for a in sys.argv[2:] if not a.startswith("--")]
    use_batch = "--now" not in flags

    cfg = json.loads(shots_path.read_text(encoding="utf-8"))
    default_model = cfg.get("model", "gemini-3.1-flash-image")
    style = cfg.get("style", "")
    default_aspect = cfg.get("aspect", "16:9")
    outdir = shots_path.parent / "images"
    outdir.mkdir(exist_ok=True)

    # --- รอบแรก: เคลียร์ทุกอย่างที่หยิบจากแคชได้ก่อน จะได้เหลือเฉพาะของที่ต้องจ่ายจริง ---
    todo, hits = [], 0
    for shot in cfg["shots"]:
        sid = shot["id"]
        if only and sid not in only:
            continue
        model = shot.get("model", default_model)
        aspect = shot.get("aspect", default_aspect)
        prompt = f"{shot['prompt']}. {style}" if style else shot["prompt"]
        key = cache.key_for(kind="image", model=model, prompt=prompt, aspect=aspect)

        for ext in (".jpg", ".png", ".webp"):
            cached = cache.get("image", key, ext)
            if cached is not None:
                save(outdir, sid, cached, MIME[ext])
                hits += 1
                break
        else:
            todo.append((sid, model, aspect, prompt, key))

    if hits:
        print(f"  หยิบจากแคช {hits} ภาพ (ไม่เสียเงิน)")
    if not todo:
        print("  ครบทุกภาพแล้ว")
        return

    print(f"  ต้องสร้างใหม่ {len(todo)} ภาพ "
          f"({'Batch API ราคาครึ่งเดียว' if use_batch else 'เรียกทีละใบ เต็มราคา'})")

    failed = []
    if use_batch:
        # จัดกลุ่มตามโมเดล เพราะ batch หนึ่งชุดใช้ได้โมเดลเดียว
        by_model = {}
        for sid, model, aspect, prompt, key in todo:
            by_model.setdefault(model, []).append((sid, aspect, prompt, key))
        for model, items in by_model.items():
            print(f"  [{model}] {len(items)} ภาพ")
            reqs = [(sid, body_for(prompt, aspect)) for sid, aspect, prompt, _ in items]
            try:
                results = gemini_batch.run(
                    model, reqs, display_name=shots_path.parent.name,
                    on_progress=lambda m: print(f"    {m}", flush=True))
            except GeminiError as e:
                print(f"    batch ล้มเหลว: {str(e)[:200]}")
                failed += [sid for sid, *_ in items]
                continue
            for sid, aspect, prompt, key in items:
                resp = results.get(sid)
                data, mime = first_image(resp) if resp else (None, None)
                if data is None:
                    failed.append(sid)
                    continue
                cache.put("image", key, EXT.get(mime, ".png"), data)
                out = save(outdir, sid, data, mime)
                print(f"    {sid}: {len(data) // 1024} KB -> {out.name}", flush=True)
    else:
        for sid, model, aspect, prompt, key in todo:
            try:
                parts = inline_parts(generate(model, body_for(prompt, aspect)))
                if not parts:
                    raise GeminiError("โมเดลไม่คืนรูปกลับมา (อาจโดน safety filter)")
                data, mime = parts[0]
            except GeminiError as e:
                # ล้มใบเดียวไม่ควรทิ้งงานทั้งชุด — จดไว้แล้วไปใบถัดไป
                print(f"  {sid}: ล้มเหลว — {str(e)[:120]}", flush=True)
                failed.append(sid)
                time.sleep(DELAY)
                continue
            cache.put("image", key, EXT.get(mime, ".png"), data)
            out = save(outdir, sid, data, mime)
            print(f"  {sid}: {len(data) // 1024} KB -> {out.name}", flush=True)
            time.sleep(DELAY)

    if failed:
        print(f"\nยังขาด {len(failed)} ภาพ: {' '.join(failed)}")
        print("รันคำสั่งเดิมซ้ำได้เลย ภาพที่มีแล้วจะถูกข้าม")
        sys.exit(1)


if __name__ == "__main__":
    main()
