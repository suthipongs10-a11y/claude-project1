#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_vo_eleven.py — ElevenLabs v3 TTS + timestamps ในคำสั่งเดียว (แทนสาย Gemini+align)

eleven_v3 รองรับภาษาไทย และ endpoint /with-timestamps คืนเวลาราย "ตัวอักษร"
มาพร้อมเสียงเลย -> แมปกลับเป็นคำด้วย pythainlp = word-timings.json โดยตรง
ไม่ต้องใช้ whisper / forced alignment อีกต่อไป

ใช้:
  set ELEVENLABS_API_KEY=...   (PowerShell: $env:ELEVENLABS_API_KEY="...")
  python tts/gen_vo_eleven.py --text clips/narration.txt --outdir clips \
      --voice-id <VOICE_ID>

ผลลัพธ์ใน outdir:
  voiceover.wav          เสียงเต็ม 24kHz mono (SOURCE OF TRUTH ของความยาว)
  word-timings.json      [{"w": คำ, "start": s, "end": s}, ...] จาก API โดยตรง
  vo-chunks/chunk-NN.mp3 เสียงรายท่อน (ไว้ re-gen เฉพาะท่อนที่เพี้ยน)
  vo-chunks/chunks.json  manifest ต่อท่อน (ข้อความ + offset + duration)

ดู voice ที่มี:  python tts/gen_vo_eleven.py --list-voices
"""
import argparse, base64, json, os, subprocess, sys, wave

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from align_th import tokenize_th, _norm  # noqa: E402

API = "https://api.elevenlabs.io/v1"
RATE = 24000
MAX_CHARS = 1200  # v3 รับได้ ~3,000/ครั้ง — ใช้ท่อนกลางๆ ให้ re-gen เฉพาะจุดได้


def split_chunks(text: str) -> list:
    """แตกบทเป็นท่อน: ห้ามข้ามย่อหน้า, รวมบรรทัด (ประโยค) จนใกล้ MAX_CHARS"""
    chunks = []
    for para in text.split("\n\n"):
        cur = ""
        for line in para.splitlines():
            line = line.strip()
            if not line:
                continue
            cand = (cur + "\n" + line) if cur else line
            if cur and len(cand.replace("\n", "")) > MAX_CHARS:
                chunks.append(cur)
                cur = line
            else:
                cur = cand
        if cur:
            chunks.append(cur)
    return chunks


def tts_with_timestamps(key: str, voice_id: str, text: str,
                        prev_text: str, next_text: str) -> dict:
    """เรียก /with-timestamps — คืน dict ที่มี audio_base64 + alignment รายตัวอักษร"""
    import requests
    body = {
        "text": text,
        "model_id": "eleven_v3",
        # stability ของ v3 รับเฉพาะ 0.0/0.5/1.0 — 0.5 = Natural เหมาะกับสารคดี
        "voice_settings": {"stability": 0.5},
    }
    # ส่งบริบทท่อนข้างเคียงให้โทนเสียงต่อเนื่อง ไม่สะดุดตรงรอยต่อ
    if prev_text:
        body["previous_text"] = prev_text
    if next_text:
        body["next_text"] = next_text
    r = requests.post(
        f"{API}/text-to-speech/{voice_id}/with-timestamps",
        params={"output_format": "mp3_44100_128"},
        headers={"xi-api-key": key, "Content-Type": "application/json"},
        json=body, timeout=300,
    )
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
    return r.json()


def mp3_to_wav(mp3_path: str, wav_path: str):
    """แปลงเป็น 24kHz mono s16 ด้วย ffmpeg (timestamps เป็นวินาที ไม่กระทบจากการ resample)"""
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", mp3_path,
         "-ar", str(RATE), "-ac", "1", "-sample_fmt", "s16", wav_path],
        check=True,
    )


def chars_to_words(alignment: dict, text: str) -> list:
    """แมปเวลารายตัวอักษรจาก API กลับเป็นคำตาม pythainlp

    ต่างจากสาย whisper: อักษรใน alignment คือ "ข้อความที่เราส่งไปเอง" เป๊ะๆ
    การแมปจึงตรงไปตรงมา — เดินสตรีมอักษร (เฉพาะ isalnum) เทียบกับคำที่ตัดไว้
    """
    chars = alignment["characters"]
    starts = alignment["character_start_times_seconds"]
    ends = alignment["character_end_times_seconds"]

    # สตรีมอักษรพร้อมเวลา (ตัดวรรคตอน/ช่องว่างทิ้งเหมือน _norm)
    stream = [(c, starts[i], ends[i]) for i, c in enumerate(chars) if _norm(c)]
    words = tokenize_th(text)
    target = "".join(_norm(w) for w in words)
    got = "".join(c for c, _, _ in stream)
    if got != target:
        raise RuntimeError(
            f"อักษรจาก API ไม่ตรงกับบท ({len(got)} vs {len(target)} ตัว) — "
            "เช็คว่า narration ไม่มีอักขระแปลก")

    merged, pos = [], 0
    for w in words:
        n = len(_norm(w))
        if n == 0:
            continue
        merged.append({"w": w,
                       "start": round(stream[pos][1], 3),
                       "end": round(stream[pos + n - 1][2], 3)})
        pos += n
    return merged


def list_voices(key: str):
    import requests
    r = requests.get(f"{API}/voices", headers={"xi-api-key": key}, timeout=60)
    r.raise_for_status()
    for v in r.json().get("voices", []):
        labels = " ".join(f"{k}={val}" for k, val in (v.get("labels") or {}).items())
        print(f"{v['voice_id']}  {v['name']:<20} {labels}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", help="ไฟล์บทพากย์ (UTF-8)")
    ap.add_argument("--outdir", help="โฟลเดอร์ clips ของคลิป")
    ap.add_argument("--voice-id", help="voice_id จาก ElevenLabs (ดูด้วย --list-voices)")
    ap.add_argument("--only", type=int, default=0,
                    help="re-gen เฉพาะท่อนหมายเลขนี้ (ท่อนอื่นใช้ไฟล์เดิม)")
    ap.add_argument("--list-voices", action="store_true", help="แสดง voice ในบัญชีแล้วจบ")
    args = ap.parse_args()

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ERROR: ตั้ง env ELEVENLABS_API_KEY ก่อน (ห้ามฝังคีย์ในไฟล์)")

    try:
        import requests  # noqa: F401
    except ImportError:
        sys.exit("ERROR: pip install requests pythainlp")

    if args.list_voices:
        list_voices(key)
        return
    if not (args.text and args.outdir and args.voice_id):
        sys.exit("ERROR: ต้องระบุ --text --outdir --voice-id (หรือใช้ --list-voices)")

    text = open(args.text, encoding="utf-8").read().strip()
    chunks = split_chunks(text)
    cdir = os.path.join(args.outdir, "vo-chunks")
    os.makedirs(cdir, exist_ok=True)

    print(f"[split] {len(chunks)} ท่อน (~{MAX_CHARS} ตัวอักษร/ท่อน)")

    # gen ต่อท่อน: เก็บ mp3 + timings รายท่อน (chunk-NN.json)
    for i, chunk in enumerate(chunks, 1):
        mp3 = os.path.join(cdir, f"chunk-{i:02d}.mp3")
        tj = os.path.join(cdir, f"chunk-{i:02d}.json")
        if args.only and i != args.only and os.path.exists(mp3) and os.path.exists(tj):
            print(f"[skip] ท่อน {i} (มีอยู่แล้ว)")
            continue
        print(f"[gen] ท่อน {i}/{len(chunks)}: {chunk.replace(chr(10), ' ')[:40]}...")
        prev_text = chunks[i - 2] if i >= 2 else ""
        next_text = chunks[i] if i < len(chunks) else ""
        last_err = None
        for attempt in range(3):
            try:
                res = tts_with_timestamps(key, args.voice_id, chunk, prev_text, next_text)
                words = chars_to_words(res["alignment"], chunk)
                with open(mp3, "wb") as f:
                    f.write(base64.b64decode(res["audio_base64"]))
                with open(tj, "w", encoding="utf-8") as f:
                    json.dump(words, f, ensure_ascii=False, indent=1)
                last_err = None
                break
            except Exception as e:
                last_err = e
                print(f"  retry {attempt+1}/3: {e}")
        if last_err:
            sys.exit(f"ERROR: ท่อน {i} gen ไม่สำเร็จ: {last_err}")

    # ต่อทุกท่อนเป็น voiceover.wav เดียว + เลื่อนเวลาคำด้วย offset จริงของไฟล์
    manifest, all_words, offset_frames = [], [], 0
    out_wav = os.path.join(args.outdir, "voiceover.wav")
    with wave.open(out_wav, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        for i, chunk in enumerate(chunks, 1):
            mp3 = os.path.join(cdir, f"chunk-{i:02d}.mp3")
            wav = os.path.join(cdir, f"chunk-{i:02d}.wav")
            mp3_to_wav(mp3, wav)
            with wave.open(wav, "rb") as w:
                frames = w.getnframes()
                out.writeframes(w.readframes(frames))
            os.remove(wav)
            offset = offset_frames / RATE
            duration = frames / RATE
            words = json.load(open(os.path.join(cdir, f"chunk-{i:02d}.json"),
                                   encoding="utf-8"))
            if words and words[-1]["end"] > duration + 1.0:
                sys.exit(f"ERROR: ท่อน {i} เวลาคำเกินความยาวเสียง "
                         f"({words[-1]['end']:.1f}s > {duration:.1f}s) — ลอง re-gen: --only {i}")
            for w in words:
                all_words.append({"w": w["w"],
                                  "start": round(w["start"] + offset, 3),
                                  "end": round(w["end"] + offset, 3)})
            manifest.append({"n": i, "file": f"chunk-{i:02d}.mp3", "text": chunk,
                             "start": round(offset, 3), "duration": round(duration, 3)})
            offset_frames += frames

    with open(os.path.join(cdir, "chunks.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    out_json = os.path.join(args.outdir, "word-timings.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(all_words, f, ensure_ascii=False, indent=1)

    total = offset_frames / RATE
    print(f"\n[done] voiceover.wav = {total:.1f}s ({total/60:.1f} นาที)")
    print(f"       word-timings.json = {len(all_words)} คำ "
          f"(คำแรก {all_words[0]['start']}s, คำสุดท้ายจบ {all_words[-1]['end']}s)")
    print("✅ เสียง + timing เสร็จในขั้นเดียว — ไม่ต้อง align อีก")


if __name__ == "__main__":
    main()
