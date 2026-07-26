#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bind_shots.py — จับช็อตจาก shot-manifest.draft.json เข้ากับฉากใน scenes.json

รันหลังมี voiceover + word-timings + segment_shots.py แล้ว:
  python tools/segment_shots.py --project channels/health/projects/ep01-lean-fatty-liver
  python channels/health/projects/ep01-lean-fatty-liver/bind_shots.py

วิธีจับ: ฉากผูกกับ "บรรทัดในบท" อยู่แล้ว ส่วนช็อตมาจากการแตกบรรทัด
เลยเทียบด้วย char-stream ของบท -> รู้ว่าช็อตไหนกินบรรทัดไหน -> ได้ฉาก
ช็อตที่คาบหลายบรรทัด เลือกฉากของบรรทัดที่กินเวลามากที่สุด

ออก shot-manifest.json พร้อม scene/visual/mascot/type/caption/punch
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../../.."))
sys.path.insert(0, os.path.join(ROOT, "tts"))
from align_th import _norm  # noqa

TEAL, CORAL, YELLOW, SKY, GREEN = "#2BB6A3", "#FF6F61", "#FFCB47", "#6FC9E8", "#3FBF6F"

# caption นิ่ง (ฟอนต์ Mali) — key = บรรทัดในบท
CAP = {
 2: "ไม่มีอาการเตือน",
 7: "เกิน 5% = ไขมันพอกตับ", 8: "อักเสบ → พังผืด → ตับแข็ง",
 10: "ผอมนอก แต่ไขมันใน", 15: "กล้ามเนื้อน้อย = ตับรับภาระ", 17: "บางคนเป็นง่ายกว่า",
 22: "ฟรุกโตส → ตรงเข้าตับ", 24: "งานวิจัย 7 สัปดาห์",
 35: "จะรู้ได้ยังไง", 36: "ตรวจเลือด + อัลตราซาวด์",
 41: "ข้อ 1 ตัดน้ำหวาน", 45: "ผลไม้สดยังกินได้", 46: "ข้อ 2 ขยับให้มากขึ้น",
 51: "ข้อ 3 ลดสัก 3-5%", 54: "ข้อ 4 กาแฟดำ",
 57: "3 เรื่องที่เข้าใจผิด", 59: "เปลี่ยนชื่อโรคปี 2023", 63: "ไม่มีอาการ ≠ ไม่เป็นไร",
 71: "ปรึกษาแพทย์เพื่อความแน่ใจ",
}

# คำเด็ดเคลื่อนไหว — key = บรรทัด, ค่า = (คำ, คำ trigger ในบท, เอฟเฟกต์, สี)
PUNCH = {
 1: ("ผอมก็เป็นได้!", "ผอม", "stamp", CORAL),
 3: ("ค่าตับผิดปกติ", "ผิดปกติ", "drop", CORAL),
 5: ("อยู่ในแก้วนี้", "แก้ว", "zoom-punch", TEAL),
 12: ("ชั่งไม่รู้", "ชั่ง", "pop", YELLOW),
 20: ("น้ำตาล!", "น้ำตาล", "stamp", CORAL),
 27: ("2 เท่า!", "สองเท่า", "zoom-punch", CORAL),
 29: ("คนละแบบ", "คนละแบบ", "shake", YELLOW),
 32: ("ทั้งวัน!", "ทั้งวัน", "pop-out", CORAL),
 39: ("ฟื้นตัวได้!", "ฟื้นตัว", "pop", GREEN),
 48: ("ไม่ลดก็ได้ผล", "ไม่ลด", "pop", GREEN),
 53: ("แค่ 2-3 กิโล", "กิโล", "count-up", SKY),
 65: ("อย่ามองข้าม", "มองข้าม", "stamp", CORAL),
 68: ("เริ่มวันนี้", "วันนี้", "pop", GREEN),
 72: ("กดติดตาม", "ติดตาม", "zoom-punch", TEAL),
}

# กล้อง — โทนช่องสุขภาพนิ่ง สงบ (~30% มีมูฟ) key = บรรทัด
TYPES = {
 0: "push-in", 3: "push-in", 5: "zoom-punch", 8: "pan-R", 11: "push-in",
 15: "pan-R", 20: "pop", 22: "push-in", 27: "zoom-punch", 29: "shake",
 32: "push-in", 35: "push-in", 39: "pull-out", 46: "pan-R", 48: "pop",
 50: "pan-R", 53: "count-up", 56: "push-in", 63: "pan-R", 64: "push-in",
 68: "push-in", 72: "pop", 73: "card-slide",
}


def line_spans(lines, words):
    """คืน [(บรรทัด, index คำแรก, index คำท้าย)] เทียบด้วย char-stream"""
    char_word = []
    for i, w in enumerate(words):
        for _ in _norm(w["w"]):
            char_word.append(i)
    out, pos = [], 0
    for li, line in enumerate(lines):
        n = len(_norm(line))
        if n == 0:
            continue
        out.append((li, char_word[pos], char_word[pos + n - 1]))
        pos += n
    if pos != len(char_word):
        print(f"⚠️ char เหลือ {len(char_word)-pos} (บท/เสียงอาจไม่ตรงเป๊ะ)")
    return out


def main():
    draft_p = os.path.join(HERE, "shot-manifest.draft.json")
    if not os.path.exists(draft_p):
        sys.exit("❌ ยังไม่มี shot-manifest.draft.json — รัน tools/segment_shots.py ก่อน")
    draft = json.load(open(draft_p, encoding="utf-8"))
    words = json.load(open(os.path.join(HERE, "clips/word-timings.json"), encoding="utf-8"))
    lines = open(os.path.join(HERE, "clips/narration.txt"), encoding="utf-8").read().strip().splitlines()
    scenes = json.load(open(os.path.join(HERE, "scenes.json"), encoding="utf-8"))

    scene_of_line = {}
    for sc in scenes:
        for li in sc["lines"]:
            scene_of_line[li] = sc

    spans = line_spans(lines, words)
    # เวลาเริ่ม/จบของแต่ละบรรทัด
    line_time = {li: (words[a]["start"], words[b]["end"]) for li, a, b in spans}

    out = []
    for sh in draft:
        # หาบรรทัดที่ทับกับช็อตนี้มากที่สุด (ตามเวลา)
        best, best_ov = None, -1
        for li, (ls, le) in line_time.items():
            ov = min(sh["end"], le) - max(sh["start"], ls)
            if ov > best_ov:
                best_ov, best = ov, li
        sc = scene_of_line.get(best)
        if sc is None:
            sys.exit(f"❌ ช็อต {sh['id']} จับฉากไม่ได้ (บรรทัด {best})")
        p = PUNCH.get(best)
        out.append({
            "id": sh["id"], "act": sh["act"], "start": sh["start"], "end": sh["end"],
            "dur": sh["dur"], "text": sh["text"], "line": best,
            "scene": sc["id"], "visual": sc["visual"], "mascot": sc["mascot"],
            "type": TYPES.get(best, "static"),
            "caption": None if p else CAP.get(best),
            "punch": ({"word": p[0], "trigger": p[1], "effect": p[2], "color": p[3]}
                      if p else None),
        })

    json.dump(out, open(os.path.join(HERE, "shot-manifest.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    used = {x["scene"] for x in out}
    ncap = sum(1 for x in out if x["caption"])
    npu = sum(1 for x in out if x["punch"])
    print(f"ช็อต {len(out)} | ภาพที่ใช้ {len(used)}/{len(scenes)} | "
          f"caption {ncap} + punch {npu} = {ncap+npu} ({100*(ncap+npu)//len(out)}%)")
    unused = [s["id"] for s in scenes if s["id"] not in used]
    if unused:
        print(f"  ⚠️ ภาพที่ไม่ได้ใช้: {unused}")
    for x in out:
        if x["punch"] and _norm(x["punch"]["trigger"]) not in _norm(x["text"]):
            print(f"  ⚠️ punch {x['id']}: '{x['punch']['trigger']}' ไม่อยู่ในบทช็อตนี้")


if __name__ == "__main__":
    main()
