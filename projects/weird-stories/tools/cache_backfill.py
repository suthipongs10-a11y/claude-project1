#!/usr/bin/env python3
"""เอาเสียง/ภาพที่สร้างไปแล้วในตอนเก่า ใส่กลับเข้าแคช

ใช้ตอนเพิ่งเปิดใช้ระบบแคช หรือตอนได้ไฟล์มาจากที่อื่น จะได้ไม่ต้องจ่ายสร้างซ้ำ

    python3 tools/cache_backfill.py episodes/<ep> [episodes/<ep2> ...]

จะข้ามท่อนที่ตั้ง rate ไม่เท่ากับ 1.0 เพราะไฟล์บนดิสก์ถูกยืด/หดความเร็วไปแล้ว
ไม่ใช่ผลดิบจาก TTS จึงเอามาเป็นแคชไม่ได้
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import cache  # noqa: E402
from gen_images import EXT  # noqa: E402
from gen_voice import MODEL as TTS_MODEL, wav_to_flac  # noqa: E402


def backfill(ep):
    added = skipped = 0

    script_path = ep / "script.json"
    if script_path.exists():
        cfg = json.loads(script_path.read_text(encoding="utf-8"))
        model = cfg.get("model", TTS_MODEL)
        voice, style = cfg.get("voice", "Charon"), cfg.get("style")
        rate = float(cfg.get("rate", 1.0))
        for seg in cfg["segments"]:
            wav = ep / "audio" / f"{seg['id']}.wav"
            if not wav.exists():
                continue
            if abs(float(seg.get("rate", rate)) - 1.0) > 0.01:
                skipped += 1
                continue
            key = cache.key_for(kind="audio", model=model,
                                voice=seg.get("voice", voice),
                                style=seg.get("style", style), text=seg["text"])
            if cache.get("audio", key, ".flac") is None:
                cache.put("audio", key, ".flac", wav_to_flac(wav.read_bytes()))
                added += 1

    shots_path = ep / "shots.json"
    if shots_path.exists():
        cfg = json.loads(shots_path.read_text(encoding="utf-8"))
        model, style = cfg.get("model", "gemini-3.1-flash-image"), cfg.get("style", "")
        aspect = cfg.get("aspect", "16:9")
        for shot in cfg["shots"]:
            found = sorted((ep / "images").glob(f"{shot['id']}.*"))
            if not found:
                continue
            img = found[0]
            shot_style = shot.get("style", style)
            prompt = f"{shot['prompt']}. {shot_style}" if shot_style else shot["prompt"]
            key = cache.key_for(kind="image", model=shot.get("model", model),
                                prompt=prompt, aspect=shot.get("aspect", aspect))
            ext = img.suffix if img.suffix in EXT.values() else ".png"
            if cache.get("image", key, ext) is None:
                cache.put("image", key, ext, img.read_bytes())
                added += 1

    return added, skipped


def main():
    total_added = total_skipped = 0
    for arg in sys.argv[1:]:
        ep = Path(arg)
        added, skipped = backfill(ep)
        print(f"  {ep.name}: เพิ่มเข้าแคช {added} ไฟล์"
              + (f" ข้าม {skipped} (rate ไม่ใช่ 1.0)" if skipped else ""))
        total_added += added
        total_skipped += skipped
    print(f"\nรวมเพิ่ม {total_added} ไฟล์")
    for kind, (n, size) in cache.stats().items():
        print(f"  {kind:8} {n:5} ไฟล์  {size / 1048576:8.1f} MB")


if __name__ == "__main__":
    main()
