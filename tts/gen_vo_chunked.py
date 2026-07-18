#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_vo_chunked.py — gen เสียงพากย์แบบแตกท่อนสั้น (ทางแก้ปัญหา align เสียงยาวหลุดราง)

แตกบทเป็นท่อน ~25 วินาที (ตัดตามย่อหน้า/ประโยค) -> gen Gemini TTS ทีละท่อน
-> ต่อกลับเป็น voiceover.wav เดียว + chunks.json (ตำแหน่งเริ่มของแต่ละท่อน)
จากนั้นใช้ tts/align_chunks.py ทำ word-timings.json ต่อ (align ท่อนสั้น = แม่นชัวร์)

ใช้:
  python tts/gen_vo_chunked.py --text clips/narration.txt --outdir clips --voice Iapetus

ผลลัพธ์ใน outdir:
  voiceover.wav          เสียงเต็มต่อแล้ว (SOURCE OF TRUTH ของความยาว)
  vo-chunks/chunk-NN.wav เสียงรายท่อน (ไว้ re-gen เฉพาะท่อนที่เพี้ยน)
  vo-chunks/chunks.json  manifest: ข้อความ + offset + duration ต่อท่อน
"""
import argparse, json, os, sys, wave

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_gemini_tts import RATE, pcm_to_wav, synth  # noqa: E402

MAX_CHARS = 350  # ~25 วินาที/ท่อน — สั้นพอให้ forced alignment แม่น


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


def wav_duration_frames(path: str):
    with wave.open(path, "rb") as w:
        return w.getnframes(), w.getframerate()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True, help="ไฟล์บทพากย์ (UTF-8)")
    ap.add_argument("--outdir", required=True, help="โฟลเดอร์ clips ของคลิป")
    ap.add_argument("--voice", default="Iapetus")
    ap.add_argument("--model", default="gemini-2.5-flash-preview-tts")
    ap.add_argument("--only", type=int, default=0,
                    help="re-gen เฉพาะท่อนหมายเลขนี้ (แล้วต่อไฟล์ใหม่)")
    args = ap.parse_args()

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("ERROR: ตั้ง env GEMINI_API_KEY ก่อน")

    try:
        from google import genai
    except ImportError:
        sys.exit("ERROR: pip install google-genai")

    text = open(args.text, encoding="utf-8").read().strip()
    chunks = split_chunks(text)
    cdir = os.path.join(args.outdir, "vo-chunks")
    os.makedirs(cdir, exist_ok=True)
    client = genai.Client(api_key=key)

    print(f"[split] {len(chunks)} ท่อน (~{MAX_CHARS} ตัวอักษร/ท่อน)")

    for i, chunk in enumerate(chunks, 1):
        path = os.path.join(cdir, f"chunk-{i:02d}.wav")
        if args.only and i != args.only and os.path.exists(path):
            print(f"[skip] ท่อน {i} (มีอยู่แล้ว)")
            continue
        preview = chunk.replace("\n", " ")[:40]
        print(f"[gen] ท่อน {i}/{len(chunks)}: {preview}...")
        last_err = None
        for attempt in range(3):
            try:
                pcm = synth(client, args.model, args.voice, chunk)
                pcm_to_wav(pcm, path)
                last_err = None
                break
            except Exception as e:
                last_err = e
                print(f"  retry {attempt+1}/3: {e}")
        if last_err:
            sys.exit(f"ERROR: ท่อน {i} gen ไม่สำเร็จ: {last_err}")

    # ต่อทุกท่อนเป็นไฟล์เดียว + คำนวณ offset จริงจากความยาวไฟล์
    manifest, offset_frames = [], 0
    out_wav = os.path.join(args.outdir, "voiceover.wav")
    with wave.open(out_wav, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        for i, chunk in enumerate(chunks, 1):
            path = os.path.join(cdir, f"chunk-{i:02d}.wav")
            frames, rate = wav_duration_frames(path)
            if rate != RATE:
                sys.exit(f"ERROR: ท่อน {i} sample rate {rate} != {RATE}")
            with wave.open(path, "rb") as w:
                out.writeframes(w.readframes(frames))
            manifest.append({
                "n": i,
                "file": f"chunk-{i:02d}.wav",
                "text": chunk,
                "start": round(offset_frames / RATE, 3),
                "duration": round(frames / RATE, 3),
            })
            offset_frames += frames

    with open(os.path.join(cdir, "chunks.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)

    total = offset_frames / RATE
    print(f"[done] voiceover.wav = {total:.1f}s ({total/60:.1f} นาที) | manifest: vo-chunks/chunks.json")
    print("ต่อไป: python tts/align_chunks.py --chunks <outdir>/vo-chunks/chunks.json "
          "--out <outdir>/word-timings.json")


if __name__ == "__main__":
    main()
