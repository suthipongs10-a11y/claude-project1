#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
align_chunks.py — forced alignment รายท่อน (คู่กับ gen_vo_chunked.py)

align เสียงทีละท่อนสั้น (~25s ซึ่งแม่นชัวร์ ต่างจากเสียงยาวที่ aligner หลุดราง)
แล้วเลื่อนเวลาด้วย offset ของท่อนใน voiceover.wav รวม -> word-timings.json เดียว

ใช้:
  python tts/align_chunks.py --chunks clips/vo-chunks/chunks.json \
      --out clips/word-timings.json --model medium
"""
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from align_th import tokenize_th, merge_to_words, _norm  # noqa: E402


def merge_with_tail_fill(tokens: list, words: list, chunk_dur: float) -> list:
    """กู้กรณี aligner พลาดเฉพาะคำท้ายท่อน (พบบ่อย: 'Failed to align the last N words')

    เงื่อนไข: สตรีมอักษรของโทเคนต้องเป็น prefix ของสตรีมคำ และครอบคลุม >=90%
    คำที่เหลือท้ายท่อนจะถูกเกลี่ยเวลาเท่าๆ กันจากจุดจบล่าสุดถึงจบท่อน
    """
    char_tok, stream = [], []
    for i, t in enumerate(tokens):
        for c in _norm(t["w"]):
            stream.append(c)
            char_tok.append(i)
    stream = "".join(stream)
    target = "".join(_norm(w) for w in words)

    if not target.startswith(stream) or len(stream) < 0.9 * len(target):
        return None

    merged, pos = [], 0
    covered = len(stream)
    for wi, word in enumerate(words):
        n = len(_norm(word))
        if n == 0:
            continue
        if pos + n > covered:          # คำแรกที่หลุดจากช่วงที่ align ได้
            tail_words = [w for w in words[wi:] if _norm(w)]
            t0 = merged[-1]["end"] if merged else 0.0
            step = max(chunk_dur - t0, 0.1) / len(tail_words)
            for k, tw in enumerate(tail_words):
                merged.append({
                    "w": tw,
                    "start": round(t0 + k * step, 3),
                    "end": round(t0 + (k + 1) * step, 3),
                })
            return merged
        first_tok = tokens[char_tok[pos]]
        last_tok = tokens[char_tok[pos + n - 1]]
        merged.append({"w": word, "start": first_tok["start"], "end": last_tok["end"]})
        pos += n
    return merged


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chunks", required=True, help="vo-chunks/chunks.json จาก gen_vo_chunked.py")
    ap.add_argument("--out", required=True, help="word-timings.json ผลรวม")
    ap.add_argument("--model", default="medium", help="ท่อนสั้น medium ก็แม่นพอ")
    args = ap.parse_args()

    manifest = json.load(open(args.chunks, encoding="utf-8"))
    cdir = os.path.dirname(os.path.abspath(args.chunks))

    try:
        import stable_whisper
    except ImportError:
        sys.exit("ERROR: pip install stable-ts pythainlp soundfile")

    print(f"[load] whisper {args.model} ...")
    model = stable_whisper.load_model(args.model)

    all_words, failed = [], []
    for chunk in manifest:
        n, offset = chunk["n"], chunk["start"]
        path = os.path.join(cdir, chunk["file"])
        word_list = tokenize_th(chunk["text"])
        print(f"[align] ท่อน {n}/{len(manifest)} ({chunk['duration']:.1f}s, {len(word_list)} คำ)")

        result = model.align(path, " ".join(word_list), language="th")
        toks = []
        for seg in result.segments:
            for w in (seg.words or []):
                t = w.word.strip()
                if t:
                    toks.append({"w": t, "start": round(w.start, 3), "end": round(w.end, 3)})

        merged = merge_to_words(toks, word_list)
        if not merged:
            merged = merge_with_tail_fill(toks, word_list, chunk["duration"])
            if merged:
                print(f"  ⚠️ ท่อน {n}: aligner พลาดคำท้ายท่อน — เกลี่ยเวลาคำท้ายให้แล้ว")
        if not merged:
            failed.append(n)
            print(f"  ❌ ท่อน {n}: merge ไม่สำเร็จ")
            continue

        # เช็คสุขภาพรายท่อน: คำจบต้องไม่เกินความยาวท่อน + zero-duration ต้องต่ำ
        zero = sum(1 for w in merged if w["end"] - w["start"] <= 0)
        if zero / len(merged) > 0.4 or merged[-1]["end"] > chunk["duration"] + 1.0:
            failed.append(n)
            print(f"  ⚠️ ท่อน {n}: คุณภาพต่ำ (zero {zero}/{len(merged)})")
            continue

        for w in merged:
            all_words.append({
                "w": w["w"],
                "start": round(w["start"] + offset, 3),
                "end": round(w["end"] + offset, 3),
            })

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(all_words, f, ensure_ascii=False, indent=1)

    total_words = sum(len(tokenize_th(c["text"])) for c in manifest)
    print(f"\n[done] {len(all_words)}/{total_words} คำ -> {args.out}")
    if failed:
        print(f"❌ ท่อนที่มีปัญหา: {failed}")
        print("   ฟังท่อนนั้นใน vo-chunks/ ว่าอ่านตรงบทไหม — ถ้าเพี้ยน re-gen เฉพาะท่อน:")
        print(f"   python tts/gen_vo_chunked.py --text <narration> --outdir <clips> --only {failed[0]}")
        sys.exit(2)
    print("✅ ทุกท่อนผ่าน — timing พร้อมใช้ทำ shot-manifest ต่อ")


if __name__ == "__main__":
    main()
