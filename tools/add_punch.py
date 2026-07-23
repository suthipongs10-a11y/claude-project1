#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
add_punch.py — เพิ่มชั้น "punch word" (คำเด็ดเคลื่อนไหว) ลง shot-manifest

ต่างจาก caption ปกติ (ไฮไลต์เหลือง นิ่ง ๆ ให้ข้อมูล): punch word = คำสั้นกระแทก
เด้งเข้ามาพร้อมเอฟเฟกต์ ตอนพูด "คำ trigger" นั้นเป๊ะ (ผูกกับ word-timings)
ใส่ ~20-25% ของช็อต เฉพาะจังหวะพีค — ตัวย้ำอารมณ์ ทำให้วิดีโอมีชีวิต

โครง punch: {word (คำที่โชว์), trigger (คำในบทที่ทริกเกอร์), effect, color}
- ช็อตไหนได้ punch แล้ว จะถอด caption นิ่งออก (punch เป็นตัวย้ำแทน ไม่ให้ซ้อน)
HyperFrames จะหา timestamp ของ trigger ในช่วงช็อต แล้ว pop คำตามเอฟเฟกต์
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APDIR = os.path.join(ROOT, "projects/video-01-blackhole")
sys.path.insert(0, os.path.join(ROOT, "tts"))
from align_th import _norm  # noqa: E402

# สี: coral=อันตราย/ตาย, orange=พลัง, cyan=วิทย์/ตัวเลข, yellow=ย้ำทั่วไป
CORAL, ORANGE, CYAN, YELLOW = "#FF5C5C", "#FF8A3C", "#17C3D6", "#FFE14D"

# shot -> (คำที่โชว์, คำ trigger ในบท, effect, color)
PUNCH = {
    "s01": ("ตาย",            "ตาย",   "stamp",          CORAL),
    "s02": ("×2 ครั้ง!",       "สอง",   "pop-double",     CORAL),
    "s08": ("ศพดาว",          "ศพ",    "drop",           YELLOW),
    "s11": ("บี้!",            "บีบ",   "crush-squash",   YELLOW),
    "s15": ("ไม่มีทาง!",       "อนุญาต", "shake",         CORAL),
    "s16": ("No Return",      "ขอบฟ้า", "stamp",          CYAN),
    "s23": ("4.3M เท่า",       "สี่",    "count-up",       CYAN),
    "s32": ("SPAGHETTI!",     "สปา",   "stretch-wobble", ORANGE),
    "s35": ("เงียบสนิท",       "รู้สึก",  "fade-in",        YELLOW),
    "s46": ("3 ชั่วโมง",       "สาม",   "count-up",       YELLOW),
    "s50": ("ช้า...ลง",        "ช้า",   "slow-drag",      YELLOW),
    "s53": ("FROZEN",         "ค้าง",   "freeze-snap",    CYAN),
    "s57": ("ตายครั้งที่ 1",    "ตาย",   "stamp",          CORAL),
    "s60": ("จริงทั้งคู่",       "ถูกต้อง", "split-pop",     YELLOW),
    "s67": ("∞",              "อนันต์",  "zoom-punch",     CYAN),
    "s68": ("พัง!",            "พัง",   "glitch-shatter", ORANGE),
    "s74": ("10⁶⁷ ปี",         "ระเหย",  "count-up",       CYAN),
    "s76": ("ก็ตาย!",          "ตาย",   "pop-out",        CORAL),
    "s79": ("เปลี่ยนรูป",       "เปลี่ยน", "sparkle",       YELLOW),
    "s84": ("กล้าไหม?",        "คนแรก",  "zoom-punch",     ORANGE),
}


def main():
    path = os.path.join(APDIR, "shot-manifest.json")
    shots = json.load(open(path, encoding="utf-8"))
    by_id = {s["id"]: s for s in shots}

    warns = []
    for sid, (word, trigger, effect, color) in PUNCH.items():
        if sid not in by_id:
            warns.append(f"ไม่พบช็อต {sid}")
            continue
        sh = by_id[sid]
        if _norm(trigger) not in _norm(sh["text"]):
            warns.append(f"{sid}: trigger '{trigger}' ไม่อยู่ในบทช็อต")
        sh["punch"] = {"word": word, "trigger": trigger,
                       "effect": effect, "color": color}
        sh["caption"] = None  # punch แทน caption นิ่ง กันข้อความซ้อน

    # ช็อตอื่น ๆ ให้มี field punch = None เพื่อความสม่ำเสมอ
    for s in shots:
        s.setdefault("punch", None)

    json.dump(shots, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    n_punch = sum(1 for s in shots if s["punch"])
    n_cap = sum(1 for s in shots if s["caption"])
    print(f"punch words: {n_punch} ({100*n_punch//len(shots)}% ของช็อต)")
    print(f"caption นิ่งที่เหลือ: {n_cap} ({100*n_cap//len(shots)}%)")
    print(f"รวมช็อตมีข้อความ: {n_punch+n_cap} ({100*(n_punch+n_cap)//len(shots)}%)")
    if warns:
        print("\n⚠️ เตือน:")
        for w in warns:
            print("  -", w)
    else:
        print("✅ trigger ทุกคำอยู่ในบทจริง — ผูก timestamp ได้")


if __name__ == "__main__":
    main()
