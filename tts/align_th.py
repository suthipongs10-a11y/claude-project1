#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
align_th.py — Forced alignment ภาษาไทย: เสียง + บทที่รู้อยู่แล้ว -> word-timings.json

Gemini TTS ไม่คืน timestamp เอง สคริปต์นี้เติมส่วนที่ขาด เพื่อให้ pipeline
(Bones & Firelight) ใช้ต่อได้เหมือนเดิม — ผลลัพธ์ = word-timings.json รูปแบบเดียวกับ
ElevenLabs branch:  [{"w": "คำ", "start": 0.00, "end": 0.42}, ...]

ทำไมต้องตัดคำก่อน: ภาษาไทยไม่มีเว้นวรรค aligner จับ "คำ" ไม่ได้ จึงใช้ pythainlp
ตัดคำ -> ใส่ช่องว่างชั่วคราว -> align ต่อคำ

ติดตั้ง:
  pip install stable-ts pythainlp soundfile
  # stable-ts ดึง openai-whisper มาให้ (โมเดลโหลดครั้งแรก ~1.5GB สำหรับ large-v3)
  # มี GPU จะเร็วมาก ไม่มีก็ได้แต่ช้ากว่า; ใช้ --model medium เพื่อประหยัด

ใช้:
  python align_th.py --audio clips/voiceover.wav --text clips/narration.txt \
      --out clips/word-timings.json --model large-v3

แล้วตรวจ: เปิด word-timings.json ดูว่าคำแรก/คำสุดท้ายเวลาสมเหตุสมผล + ตรงกับหูจริง
(นี่คือ "จุดตัดสิน" ของ A/B — เสียงเพราะแต่ align เพี้ยน = ภาพหลุดจังหวะทั้งคลิป)
"""
import argparse, json, os, sys, wave, contextlib


def audio_duration(path: str) -> float:
    try:
        with contextlib.closing(wave.open(path, "rb")) as w:
            return w.getnframes() / float(w.getframerate())
    except Exception:
        try:
            import soundfile as sf
            info = sf.info(path)
            return info.frames / float(info.samplerate)
        except Exception:
            return 0.0


def tokenize_th(text: str) -> list:
    """ตัดคำไทยด้วย pythainlp — คืน list คำ (ใช้ทั้งป้อน aligner และ merge ผลกลับ)"""
    from pythainlp.tokenize import word_tokenize
    words = word_tokenize(text.replace("\n", " "), engine="newmm", keep_whitespace=False)
    return [w for w in words if w.strip()]


def _norm(s: str) -> str:
    """เก็บเฉพาะอักษร/ตัวเลขไว้เทียบ — ตัดช่องว่างและเครื่องหมายวรรคตอน ("...", ! ฯลฯ)"""
    return "".join(c for c in s if c.isalnum())


def merge_to_words(tokens: list, words: list) -> list:
    """stable-ts มักคืนผลไทยเป็นรายตัวอักษร — merge กลับเป็นคำตาม pythainlp

    เทียบแบบ character-stream (หลัง normalize ตัดวรรคตอน): สตรีมอักษรของโทเคน
    ต้องตรงกับสตรีมอักษรของคำ แล้วแมปช่วงอักษรของแต่ละคำกลับเป็นช่วงเวลา
    — ทนกรณีโทเคนคร่อมรอยต่อคำ และโทเคนที่เป็นวรรคตอนล้วน ("\" ส)
    คืน None ถ้าสตรีมไม่ตรงกัน ให้ผู้เรียก fallback เป็นโทเคนดิบ
    """
    # สตรีมอักษรจากโทเคน: จำว่าอักษรตัวไหนมาจากโทเคนไหน
    char_tok = []          # index ของโทเคนต่ออักษร
    stream = []
    for i, t in enumerate(tokens):
        for c in _norm(t["w"]):
            stream.append(c)
            char_tok.append(i)
    stream = "".join(stream)

    target = "".join(_norm(w) for w in words)
    if stream != target:
        return None

    merged, pos = [], 0
    for word in words:
        n = len(_norm(word))
        if n == 0:          # คำที่เป็นวรรคตอนล้วน — ข้าม ไม่มีประโยชน์เชิงเวลา
            continue
        first_tok = tokens[char_tok[pos]]
        last_tok = tokens[char_tok[pos + n - 1]]
        merged.append({"w": word, "start": first_tok["start"], "end": last_tok["end"]})
        pos += n
    return merged


def quality_report(words: list, dur: float) -> bool:
    """ตรวจสุขภาพ alignment — คืน True ถ้าน่าเชื่อถือ"""
    zero = sum(1 for w in words if w["end"] - w["start"] <= 0)
    jumps = [
        (words[i - 1]["end"], words[i]["start"])
        for i in range(1, len(words))
        if words[i]["start"] - words[i - 1]["end"] > 3.0
    ]
    zero_pct = zero / len(words) * 100
    print(f"[quality] zero-duration {zero}/{len(words)} ({zero_pct:.0f}%) | ช่วงกระโดด>3s: {len(jumps)}")
    ok = zero_pct < 25 and len(jumps) <= 1
    if not ok:
        print("       ❌ alignment ไม่น่าเชื่อถือ (aligner หลุดราง — พบบ่อยกับเสียงยาว+โมเดลเล็ก)")
        print("       ทางแก้: รันใหม่ด้วย --model large-v3 (แม่นขึ้นมาก ช้าลงหน่อย)")
        if jumps:
            print(f"       จุดกระโดดแรกๆ: {jumps[:5]}")
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True, help="ไฟล์เสียง .wav/.mp3")
    ap.add_argument("--text", required=True, help="ไฟล์บทพากย์ที่ใช้ gen เสียง (UTF-8)")
    ap.add_argument("--out", default="clips/word-timings.json")
    ap.add_argument("--model", default="large-v3", help="whisper model (large-v3/medium/small)")
    args = ap.parse_args()

    for p in (args.audio, args.text):
        if not os.path.exists(p):
            sys.exit(f"ERROR: ไม่พบไฟล์ {p}")

    raw = open(args.text, encoding="utf-8").read().strip()
    word_list = tokenize_th(raw)
    tokenized = " ".join(word_list)
    print(f"[tokenize] {len(word_list)} คำ")

    try:
        import stable_whisper
    except ImportError:
        sys.exit("ERROR: pip install stable-ts pythainlp soundfile")

    print(f"[load] whisper {args.model} ...")
    model = stable_whisper.load_model(args.model)

    # align() = forced alignment กับข้อความที่รู้อยู่แล้ว (แม่นกว่า transcribe เพราะไม่เดาคำ)
    print("[align] ...")
    result = model.align(args.audio, tokenized, language="th")

    words = []
    for seg in result.segments:
        for w in (seg.words or []):
            token = w.word.strip()
            if not token:
                continue
            words.append({"w": token, "start": round(w.start, 3), "end": round(w.end, 3)})

    if not words:
        sys.exit("ERROR: align ไม่ได้คำเลย — ลองโมเดลใหญ่ขึ้น หรือเช็คว่าบทตรงกับเสียง")

    # stable-ts คืนไทยเป็นรายตัวอักษร -> รวมกลับเป็นคำตาม pythainlp
    merged = merge_to_words(words, word_list)
    if merged:
        print(f"[merge] {len(words)} โทเคน -> {len(merged)} คำ")
        words = merged
    else:
        print("⚠️ merge โทเคน->คำ ไม่สำเร็จ — บันทึกผลดิบแทน (เช็คว่าบทตรงกับเสียง)")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=1)

    dur = audio_duration(args.audio)
    print(f"[done] {len(words)} คำ -> {args.out}")
    print(f"       คำแรก={words[0]['start']}s  คำสุดท้ายจบ={words[-1]['end']}s  เสียงยาว={dur:.2f}s")
    if dur and words[-1]["end"] > dur + 0.5:
        print("       ⚠️ เวลาคำสุดท้ายเกินความยาวเสียง — alignment อาจเพี้ยน ตรวจดู")
    if not quality_report(words, dur):
        sys.exit(2)


if __name__ == "__main__":
    main()
