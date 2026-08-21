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
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

sys.path.insert(0, str(Path(__file__).parent))
from gemini_api import GeminiError, generate, inline_parts  # noqa: E402

MODEL = "gemini-2.5-flash-preview-tts"  # เสถียรสุดกับภาษาไทย
# ทางเลือก: gemini-3.1-flash-tts-preview (ใหม่กว่า), gemini-2.5-pro-preview-tts (คุณภาพสูง ช้ากว่า)

# จังหวะการอ่านคุมด้วย style prompt เป็นหลัก — ทดสอบแล้วได้ผลจริง:
#   "พูดช้า เว้นจังหวะ"        -> ~4.4 ตัวอักษร/วินาที  (ช้าเกินไป ฟังแล้วอืด)
#   "ความเร็วปกติ ไม่ยืดเสียง" -> ~10.9 ตัวอักษร/วินาที (ค่าเริ่มต้นตอนนี้)
#   ไม่ใส่ style เลย            -> ~9.9 ตัวอักษร/วินาที
# ถ้าอยากจูนละเอียดอีก ใส่ "rate" ใน script.json (1.0 = ตามที่ TTS ให้มา,
# 1.1 = เร็วขึ้น 10%, 0.9 = ช้าลง 10%) — ใช้ atempo ซึ่งรักษาระดับเสียงไว้ไม่ให้เพี้ยน
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


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


def retime(wav_path, rate):
    """ปรับความเร็วเสียงโดยไม่เปลี่ยน pitch คืนความยาวใหม่"""
    tmp = wav_path.with_suffix(".tmp.wav")
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(wav_path),
                    "-af", f"atempo={rate:.3f}", str(tmp)], check=True)
    tmp.replace(wav_path)


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
    rate = float(cfg.get("rate", 1.0))
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
        wav, sr = synth(seg["text"], seg.get("voice", voice), seg.get("style", style))
        wav_path.write_bytes(wav)
        seg_rate = float(seg.get("rate", rate))
        if abs(seg_rate - 1.0) > 0.01:
            retime(wav_path, seg_rate)
        dur = round((wav_path.stat().st_size - 44) / 2 / sr, 3)
        timing[sid] = dur
        print(f"  {sid}: {dur}s -> {wav_path.name}")

    tpath.write_text(json.dumps(timing, ensure_ascii=False, indent=2))
    print(f"\nรวม {round(sum(timing.values()), 1)} วินาที | timing -> {tpath}")


if __name__ == "__main__":
    try:
        main()
    except GeminiError as e:
        sys.exit(f"เรียก Gemini ไม่สำเร็จ: {e}\n"
                 f"ถ้าเป็น 429 ให้รอสัก 5-10 นาทีแล้วรันคำสั่งเดิมซ้ำ ของที่ทำไปแล้วจะถูกข้าม")
