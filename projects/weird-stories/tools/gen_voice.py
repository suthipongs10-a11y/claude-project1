#!/usr/bin/env python3
"""สร้างเสียงบรรยายไทยด้วย Gemini TTS

ใช้:
    python3 tools/gen_voice.py episodes/<ep>/script.json          # ใช้แคช + batch ถ้าโมเดลรองรับ
    python3 tools/gen_voice.py episodes/<ep>/script.json --now    # เรียกทีละท่อน ได้ผลเร็วแต่เต็มราคา
    python3 tools/gen_voice.py episodes/<ep>/script.json s03 s07  # ทำเฉพาะท่อนที่ระบุ

script.json รูปแบบ:
{
  "voice": "Charon",
  "style": "อ่านด้วยความเร็วปกติแบบผู้บรรยายสารคดี เสียงต่ำ นิ่ง ชัดถ้อยชัดคำ ไม่ยืดเสียง",
  "rate": 1.0,
  "segments": [
    {"id": "s01", "text": "..."},
    {"id": "s02", "text": "...", "voice": "Kore"}
  ]
}

ผลลัพธ์: episodes/<ep>/audio/s01.wav ... + audio/timing.json (ความยาวแต่ละท่อน)
แยกไฟล์ต่อ segment เพื่อให้แก้ทีละท่อนได้โดยไม่ต้อง gen ใหม่ทั้งคลิป

ประหยัดค่า API:
  - แคช content-addressed เก็บเป็น FLAC (เล็กกว่า WAV ~45% และไม่เสียคุณภาพ)
    ข้อความเดิม = ไม่จ่ายซ้ำ แม้จะย้าย segment เปลี่ยนชื่อ id หรือลบไฟล์ในโปรเจกต์ไปแล้ว
  - แคชเก็บนอก repo และซิงก์ขึ้น S3/R2/B2 ได้ (ดู tools/cache.py)
"""
import json
import re
import struct
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

sys.path.insert(0, str(Path(__file__).parent))
import cache  # noqa: E402
import gemini_batch  # noqa: E402
from gemini_api import GeminiError, generate, inline_parts  # noqa: E402

MODEL = "gemini-2.5-flash-preview-tts"  # เสถียรสุดกับภาษาไทย
# ทางเลือก: gemini-3.1-flash-tts-preview / gemini-2.5-pro-preview-tts
#   สองตัวนี้รองรับ Batch API (ถูกลงครึ่งหนึ่ง) ส่วน 2.5-flash-preview-tts ไม่รองรับ
#   แต่คนละโมเดลก็คนละน้ำเสียง ถ้าจะเปลี่ยนควรฟังเทียบก่อน เพราะเสียงคลิปจะเปลี่ยนไปด้วย
BATCH_MODELS = {"gemini-3.1-flash-tts-preview", "gemini-2.5-pro-preview-tts"}

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


def _convert(data, in_ext, out_ext, extra=()):
    """แปลงไฟล์เสียงผ่าน ffmpeg โดยไม่แตะดิสก์ของโปรเจกต์"""
    import tempfile

    with tempfile.TemporaryDirectory() as td:
        src, dst = Path(td) / f"a{in_ext}", Path(td) / f"b{out_ext}"
        src.write_bytes(data)
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(src),
                        *extra, str(dst)], check=True)
        return dst.read_bytes()


def wav_to_flac(wav):
    return _convert(wav, ".wav", ".flac", ("-c:a", "flac", "-compression_level", "8"))


def flac_to_wav(flac):
    return _convert(flac, ".flac", ".wav")


def retime(wav, rate):
    """ปรับความเร็วเสียงโดยไม่เปลี่ยน pitch"""
    return _convert(wav, ".wav", ".wav", ("-af", f"atempo={rate:.3f}",))


def body_for(text, voice, style):
    prompt = f"{style}: {text}" if style else text
    return {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}
            },
        },
    }


def audio_from(resp):
    import base64

    for part in resp.get("candidates", [{}])[0].get("content", {}).get("parts", []):
        if "inlineData" in part:
            return pcm_to_wav(base64.b64decode(part["inlineData"]["data"]),
                              part["inlineData"]["mimeType"])
    return None, None


def wav_seconds(wav):
    rate = struct.unpack("<I", wav[24:28])[0]
    return round((len(wav) - 44) / 2 / rate, 3)


def main():
    script_path = Path(sys.argv[1])
    flags = {a for a in sys.argv[2:] if a.startswith("--")}
    only = [a for a in sys.argv[2:] if not a.startswith("--")]

    cfg = json.loads(script_path.read_text(encoding="utf-8"))
    model = cfg.get("model", MODEL)
    voice = cfg.get("voice", "Charon")
    style = cfg.get("style")
    rate = float(cfg.get("rate", 1.0))
    use_batch = "--now" not in flags and model in BATCH_MODELS

    outdir = script_path.parent / "audio"
    outdir.mkdir(exist_ok=True)
    tpath = outdir / "timing.json"
    timing = json.loads(tpath.read_text()) if tpath.exists() else {}

    def finish(sid, wav, seg_rate):
        if abs(seg_rate - 1.0) > 0.01:
            wav = retime(wav, seg_rate)
        (outdir / f"{sid}.wav").write_bytes(wav)
        timing[sid] = wav_seconds(wav)
        return timing[sid]

    # --- รอบแรก: เคลียร์ทุกอย่างที่หยิบจากแคชได้ก่อน ---
    todo, hits = [], 0
    for seg in cfg["segments"]:
        sid = seg["id"]
        if only and sid not in only:
            continue
        seg_voice = seg.get("voice", voice)
        seg_style = seg.get("style", style)
        seg_rate = float(seg.get("rate", rate))
        # rate ไม่ต้องอยู่ใน key เพราะเป็นการแปลงหลังบ้าน ไม่ได้เรียก API ใหม่
        key = cache.key_for(kind="audio", model=model, voice=seg_voice,
                            style=seg_style, text=seg["text"])
        flac = cache.get("audio", key, ".flac")
        if flac is not None:
            dur = finish(sid, flac_to_wav(flac), seg_rate)
            print(f"  {sid}: {dur}s (แคช)")
            hits += 1
        else:
            todo.append((sid, seg_voice, seg_style, seg_rate, seg["text"], key))

    if hits:
        print(f"  หยิบจากแคช {hits} ท่อน (ไม่เสียเงิน)")

    if todo:
        print(f"  ต้องสร้างใหม่ {len(todo)} ท่อน "
              f"({'Batch API ราคาครึ่งเดียว' if use_batch else 'เรียกทีละท่อน เต็มราคา'})")
        if use_batch:
            reqs = [(sid, body_for(text, v, st)) for sid, v, st, _, text, _ in todo]
            results = gemini_batch.run(model, reqs, display_name=script_path.parent.name,
                                       on_progress=lambda m: print(f"    {m}", flush=True))
            for sid, v, st, seg_rate, text, key in todo:
                resp = results.get(sid)
                wav, _ = audio_from(resp) if resp else (None, None)
                if wav is None:
                    print(f"    {sid}: ไม่ได้เสียงกลับมา")
                    continue
                cache.put("audio", key, ".flac", wav_to_flac(wav))
                print(f"    {sid}: {finish(sid, wav, seg_rate)}s")
        else:
            for sid, v, st, seg_rate, text, key in todo:
                parts = inline_parts(generate(model, body_for(text, v, st)))
                if not parts:
                    raise GeminiError(f"TTS ไม่คืนเสียงของ {sid} กลับมา")
                wav, _ = pcm_to_wav(*parts[0])
                cache.put("audio", key, ".flac", wav_to_flac(wav))
                print(f"  {sid}: {finish(sid, wav, seg_rate)}s")

    tpath.write_text(json.dumps(timing, ensure_ascii=False, indent=2))
    print(f"\nรวม {round(sum(timing.values()), 1)} วินาที | timing -> {tpath}")


if __name__ == "__main__":
    try:
        main()
    except GeminiError as e:
        sys.exit(f"เรียก Gemini ไม่สำเร็จ: {e}\n"
                 f"ถ้าเป็น 429 ให้รอสัก 5-10 นาทีแล้วรันคำสั่งเดิมซ้ำ ของที่ทำไปแล้วจะถูกข้าม")
