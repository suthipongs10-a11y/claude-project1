#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
segment_shots.py — แตกช็อตจาก word-timings + narration (Bones & Firelight step 6)

หลัก: ประโยค (บรรทัดใน narration.txt) = ขอบเขตธรรมชาติของช็อต
- map แต่ละบรรทัด -> ช่วง index คำใน word-timings (เทียบ char-stream ที่ normalize)
- บรรทัด = 1 ช็อตตั้งต้น, เวลา = [คำแรก.start, คำสุดท้าย.end]
- SPLIT ช็อตยาว > 6.5s เป็นชิ้นเท่า ๆ กันที่ขอบคำ
- MERGE ช็อตสั้น < 2.0s เข้ากับเพื่อนบ้าน (ไม่ข้าม act)
- GAPLESS: ปูเต็ม [0, dur] — ช็อต i.end = ช็อต i+1.start

ออก shot-manifest.json (ร่าง) ให้เติม type/caption/mascot ต่อ
"""
import json, os, sys

SPLIT_MAX = 6.5
MERGE_MIN = 2.0
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tts"))
from align_th import _norm  # noqa: E402


def load_lines_with_acts(path):
    """คืน [(act_index, line_text)] — ย่อหน้า (คั่นบรรทัดว่าง) = act"""
    out, act = [], 0
    started = False
    for raw in open(path, encoding="utf-8"):
        line = raw.rstrip("\n")
        if not line.strip():
            if started:
                act += 1  # เจอบรรทัดว่าง = ขึ้น act ใหม่
            continue
        started = True
        out.append((act, line.strip()))
    return out


def map_lines_to_words(lines, words):
    """เดิน char-stream ที่ normalize แล้ว จับคู่แต่ละบรรทัด -> ช่วง index คำ"""
    # char stream ของ word-timings: จำว่าอักษรตัวไหนมาจากคำ index ไหน
    char_word = []
    for i, w in enumerate(words):
        for _ in _norm(w["w"]):
            char_word.append(i)
    spans, pos = [], 0
    for act, line in lines:
        n = len(_norm(line))
        if n == 0:
            continue
        wi_start = char_word[pos]
        wi_end = char_word[pos + n - 1]
        spans.append({"act": act, "text": line,
                      "wi": (wi_start, wi_end)})
        pos += n
    if pos != len(char_word):
        print(f"⚠️ char เหลือ {len(char_word)-pos} (บท/เสียงอาจไม่ตรงเป๊ะ)")
    return spans


def split_long(start, end, words, wi):
    """แตกช็อตยาวเป็นชิ้น ≤ SPLIT_MAX ที่ขอบคำ (แบ่งจำนวนใกล้เท่ากัน)"""
    dur = end - start
    if dur <= SPLIT_MAX:
        return [(start, end, wi)]
    import math
    parts = math.ceil(dur / SPLIT_MAX)
    a, b = wi
    idxs = list(range(a, b + 1))
    if len(idxs) < parts:  # คำน้อยกว่าจำนวนชิ้นที่อยากได้ — แตกไม่ได้
        return [(start, end, wi)]
    per = len(idxs) / parts
    out, prev_end_i = [], a
    for k in range(parts):
        seg_last = a + int(round((k + 1) * per)) - 1 if k < parts - 1 else b
        seg_last = max(seg_last, prev_end_i)
        s = words[prev_end_i]["start"] if k > 0 else start
        e = words[seg_last]["end"] if k < parts - 1 else end
        out.append((s, e, (prev_end_i, seg_last)))
        prev_end_i = seg_last + 1
    return out


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default="projects/video-01-blackhole",
                    help="โฟลเดอร์โปรเจกต์ (มี clips/narration.txt + word-timings.json)")
    args = ap.parse_args()
    ap_dir = os.path.join(ROOT, args.project) if not os.path.isabs(args.project) else args.project
    words = json.load(open(os.path.join(ap_dir, "clips/word-timings.json"), encoding="utf-8"))
    lines = load_lines_with_acts(os.path.join(ap_dir, "clips/narration.txt"))
    total = words[-1]["end"]

    spans = map_lines_to_words(lines, words)

    # 1) ช็อตตั้งต้น = 1 บรรทัด แล้ว SPLIT ยาว
    shots = []
    for sp in spans:
        a, b = sp["wi"]
        s0, e0 = words[a]["start"], words[b]["end"]
        for s, e, wi in split_long(s0, e0, words, (a, b)):
            txt = "".join(words[i]["w"] for i in range(wi[0], wi[1] + 1))
            shots.append({"act": sp["act"], "start": s, "end": e,
                          "wi": wi, "text": txt})

    # 2) MERGE ช็อตสั้น < MERGE_MIN (ไม่ข้าม act)
    merged = []
    for sh in shots:
        if merged and (sh["end"] - sh["start"]) < MERGE_MIN and merged[-1]["act"] == sh["act"]:
            merged[-1]["end"] = sh["end"]
            merged[-1]["wi"] = (merged[-1]["wi"][0], sh["wi"][1])
            merged[-1]["text"] += sh["text"]
        elif merged and (merged[-1]["end"] - merged[-1]["start"]) < MERGE_MIN and merged[-1]["act"] == sh["act"]:
            # ช็อตก่อนหน้าสั้นไป — ดูดช็อตนี้เข้าไป
            merged[-1]["end"] = sh["end"]
            merged[-1]["wi"] = (merged[-1]["wi"][0], sh["wi"][1])
            merged[-1]["text"] += sh["text"]
        else:
            merged.append(dict(sh))

    # 3) GAPLESS: ปูเต็ม — ช็อต i.end = ช็อต i+1.start ; ตัวแรก 0, ตัวท้าย total
    merged[0]["start"] = 0.0
    for i in range(len(merged) - 1):
        merged[i]["end"] = merged[i + 1]["start"]
    merged[-1]["end"] = total

    # เขียนร่าง manifest
    out = []
    for i, sh in enumerate(merged, 1):
        out.append({
            "id": f"s{i:02d}",
            "act": sh["act"],
            "start": round(sh["start"], 3),
            "end": round(sh["end"], 3),
            "dur": round(sh["end"] - sh["start"], 3),
            "text": sh["text"],
            "type": None,      # เติมทีหลัง
            "caption": None,   # เติมทีหลัง
            "mascot": None,    # เติมทีหลัง
        })
    outp = os.path.join(ap_dir, "shot-manifest.draft.json")
    json.dump(out, open(outp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    durs = [s["dur"] for s in out]
    acts = {}
    for s in out:
        acts[s["act"]] = acts.get(s["act"], 0) + 1
    print(f"ช็อตทั้งหมด: {len(out)}")
    print(f"ต่อ act: {dict(sorted(acts.items()))}")
    print(f"dur: min {min(durs):.2f}s / max {max(durs):.2f}s / avg {sum(durs)/len(durs):.2f}s")
    print(f"ปูเต็ม: {out[0]['start']} -> {out[-1]['end']} (เสียง {total})")
    print(f"เขียน: {outp}")


if __name__ == "__main__":
    main()
