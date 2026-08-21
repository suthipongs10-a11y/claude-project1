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
import cache  # noqa: E402
from gemini_api import GeminiError, generate, inline_parts  # noqa: E402

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

    key = cache.key_for(kind="music", model=MODEL, prompt=prompt)
    for ext in (".mp3", ".wav"):
        cached = cache.get("music", key, ext)
        if cached is not None:
            out = outdir / (name + ext)
            out.write_bytes(cached)
            print(f"BGM: {len(cached) // 1024} KB -> {out} (แคช ไม่เสียเงิน)")
            return

    parts = inline_parts(generate(MODEL, {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["AUDIO"]},
    }))
    if not parts:
        raise GeminiError("Lyria ไม่คืนเสียงกลับมา")
    data, mime = parts[0]
    ext = EXT.get(mime, ".mp3")
    cache.put("music", key, ext, data)
    out = outdir / (name + ext)
    out.write_bytes(data)
    print(f"BGM: {len(data) // 1024} KB ({mime}) -> {out}")


if __name__ == "__main__":
    try:
        main()
    except GeminiError as e:
        sys.exit(f"เรียก Gemini ไม่สำเร็จ: {e}\n"
                 f"ถ้าเป็น 429 ให้รอสัก 5-10 นาทีแล้วรันคำสั่งเดิมซ้ำ ของที่ทำไปแล้วจะถูกข้าม")
