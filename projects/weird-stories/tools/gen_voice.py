#!/usr/bin/env python3
"""สร้างเสียงบรรยายไทยด้วย Gemini TTS

ใช้:
    python3 tools/gen_voice.py episodes/<ep>/script.json

script.json รูปแบบ:
{
  "voice": "Charon",
  "style": "เล่าแบบสารคดีลึกลับ พูดช้า เสียงต่ำ เว้นจังหวะให้ขนลุก",
  "segments": [
    {"id": "s01", "text": "..."},
    {"id": "s02", "text": "..."}
  ]
}

ผลลัพธ์: episodes/<ep>/audio/s01.wav ... + audio/timing.json (ความยาวแต่ละท่อน)
แยกไฟล์ต่อ segment เพื่อให้แก้ทีละท่อนได้โดยไม่ต้อง gen ใหม่ทั้งคลิป
"""
import json
import re
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gemini_api import generate, inline_parts  # noqa: E402

MODEL = "gemini-2.5-flash-preview-tts"  # เสถียรสุดกับภาษาไทย
# ทางเลือก: gemini-3.1-flash-tts-preview (ใหม่กว่า), gemini-2.5-pro-preview-tts (คุณภาพสูง ช้ากว่า)


def pcm_to_wav(pcm, mime):
    m = re.search(r"rate=(\d+)", mime)
    rate = int(m.group(1)) if m else 24000
    hdr = (
        b"RIFF"
        + struct.pack("<I", 36 + len(pcm))
        + b"WAVEfmt "
        + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
        + b"data"
        + struct.pack("<I", len(pcm))
    )
    return hdr + pcm, rate


def synth(text, voice, style=None):
    prompt = f"{style}: {text}" if style else text
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}
            },
        },
    }
    parts = inline_parts(generate(MODEL, body))
    if not parts:
        raise SystemExit("TTS ไม่คืนเสียงกลับมา")
    return pcm_to_wav(*parts[0])


def main():
    script_path = Path(sys.argv[1])
    cfg = json.loads(script_path.read_text(encoding="utf-8"))
    only = sys.argv[2:]  # ระบุ id ท้ายคำสั่งเพื่อ gen ซ้ำเฉพาะท่อนนั้น

    voice = cfg.get("voice", "Charon")
    style = cfg.get("style")
    outdir = script_path.parent / "audio"
    outdir.mkdir(exist_ok=True)

    timing = {}
    tpath = outdir / "timing.json"
    if tpath.exists():
        timing = json.loads(tpath.read_text())

    for seg in cfg["segments"]:
        sid = seg["id"]
        if only and sid not in only:
            continue
        wav_path = outdir / f"{sid}.wav"
        if wav_path.exists() and not only:
            print(f"  ข้าม {sid} (มีแล้ว)")
            continue
        wav, rate = synth(seg["text"], seg.get("voice", voice), seg.get("style", style))
        wav_path.write_bytes(wav)
        dur = round((len(wav) - 44) / 2 / rate, 3)
        timing[sid] = dur
        print(f"  {sid}: {dur}s -> {wav_path.name}")

    tpath.write_text(json.dumps(timing, ensure_ascii=False, indent=2))
    print(f"\nรวม {round(sum(timing.values()), 1)} วินาที | timing -> {tpath}")


if __name__ == "__main__":
    main()
