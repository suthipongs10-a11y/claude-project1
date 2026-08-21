#!/usr/bin/env python3
"""สร้างดนตรีประกอบ (BGM) ด้วย Lyria

ใช้:
    python3 tools/gen_music.py episodes/<ep>/ "dark ambient drone, sparse piano, tense, no vocals"

ได้ไฟล์ audio/bgm.mp3 (คลิปสั้น — ถ้าคลิปยาวกว่านั้น build_video.py จะวนลูปให้เอง)
เพลงที่ได้เป็นเพลงที่โมเดลสร้างใหม่ ไม่ติดลิขสิทธิ์ค่ายเพลง ปลอดภัยกับ Content ID
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gemini_api import generate, inline_parts  # noqa: E402

MODEL = "lyria-3-clip-preview"
EXT = {"audio/mpeg": ".mp3", "audio/wav": ".wav"}


def main():
    outdir = Path(sys.argv[1]) / "audio"
    outdir.mkdir(parents=True, exist_ok=True)
    prompt = sys.argv[2] if len(sys.argv) > 2 else (
        "dark ambient documentary underscore, deep low drone, sparse detuned piano, "
        "slow tension build, unsettling, no vocals, no drums"
    )
    name = sys.argv[3] if len(sys.argv) > 3 else "bgm"

    parts = inline_parts(generate(MODEL, {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["AUDIO"]},
    }))
    if not parts:
        raise SystemExit("Lyria ไม่คืนเสียงกลับมา")
    data, mime = parts[0]
    out = outdir / (name + EXT.get(mime, ".mp3"))
    out.write_bytes(data)
    print(f"BGM: {len(data) // 1024} KB ({mime}) -> {out}")


if __name__ == "__main__":
    main()
