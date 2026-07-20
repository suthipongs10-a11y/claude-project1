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


def merge_fuzzy(tokens: list, words: list, chunk_dur: float):
    """กู้กรณีสตรีมโทเคนไม่ตรงบทเป๊ะ (aligner พลาดบางคำ — ท้ายท่อนหรือกลางท่อนก็ได้)

    จับคู่สตรีมอักษรด้วย SequenceMatcher: คำที่มีอักษรจับคู่ได้ใช้เวลาจริง
    คำที่จับคู่ไม่ได้เกลี่ยเวลาระหว่างเพื่อนบ้าน คืน (merged, จำนวนคำที่เกลี่ย)
    หรือ (None, 0) ถ้าตรงกันต่ำกว่า 85%
    """
    import difflib

    char_tok, chars = [], []
    for i, t in enumerate(tokens):
        for c in _norm(t["w"]):
            chars.append(c)
            char_tok.append(i)
    stream = "".join(chars)
    target = "".join(_norm(w) for w in words)
    if not stream or not target:
        return None, 0

    sm = difflib.SequenceMatcher(None, target, stream, autojunk=False)
    t2s = {}
    for a, b, size in sm.get_matching_blocks():
        for k in range(size):
            t2s[a + k] = b + k
    # เกณฑ์: อักษรของบทต้องจับคู่ได้อย่างน้อย 80% ไม่งั้นถือว่าเสียงไม่ตรงบท
    if len(t2s) < 0.8 * len(target):
        return None, 0

    out, pos = [], 0
    for w in words:
        n = len(_norm(w))
        if n == 0:
            continue
        idxs = [t2s[p] for p in range(pos, pos + n) if p in t2s]
        if idxs:
            out.append({"w": w,
                        "start": tokens[char_tok[min(idxs)]]["start"],
                        "end": tokens[char_tok[max(idxs)]]["end"], "_ok": True})
        else:
            out.append({"w": w, "start": None, "end": None, "_ok": False})
        pos += n

    # เกลี่ยช่วงที่จับคู่ไม่ได้ (run ติดกัน) ระหว่างเวลาเพื่อนบ้าน
    filled, i = 0, 0
    while i < len(out):
        if not out[i]["_ok"]:
            j = i
            while j < len(out) and not out[j]["_ok"]:
                j += 1
            t0 = out[i - 1]["end"] if i > 0 else 0.0
            t1 = out[j]["start"] if j < len(out) else chunk_dur
            if t1 <= t0:
                t1 = t0 + 0.3 * (j - i)
            step = (t1 - t0) / (j - i)
            for k in range(i, j):
                out[k]["start"] = round(t0 + (k - i) * step, 3)
                out[k]["end"] = round(t0 + (k - i + 1) * step, 3)
                filled += 1
            i = j
        else:
            i += 1

    # บังคับเวลาไม่ย้อนถอยหลัง
    prev_end = 0.0
    for w in out:
        if w["start"] < prev_end:
            w["start"] = prev_end
        if w["end"] < w["start"]:
            w["end"] = w["start"]
        prev_end = w["end"]
        w.pop("_ok", None)
    return out, filled


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
            merged, filled = merge_fuzzy(toks, word_list, chunk["duration"])
            if merged:
                print(f"  ⚠️ ท่อน {n}: fuzzy merge — เกลี่ยเวลา {filled} คำที่ aligner พลาด")
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
