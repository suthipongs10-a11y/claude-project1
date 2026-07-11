#!/usr/bin/env python3
"""แก้ draft รอบ polish:
1. เสียงพากย์ (audio track) volume -> 1.8
2. ช็อตวิดีโอที่เปิดเสียงจริง (vol=1.0) -> 0.7
3. Caption: ขยาย size 15 -> 28 + สีตามอารมณ์คำ (ยกเว้น TEMPLATE)
ใช้: python restyle_and_mix.py <draft_dir>
"""
import json, sys, time, shutil
from pathlib import Path

COLOR = {
    "default":   [1.0, 0.9, 0.0],   # เหลือง #FFE600
    "CRYING":    [1.0, 0.18, 0.18], # แดง — อารมณ์เศร้า/พีค
    "FOREVER":   [1.0, 0.18, 0.18],
    "I LOVE YOU":[1.0, 0.18, 0.18],
    "I DID IT":  [0.2, 1.0, 0.45],  # เขียว — ชัยชนะ
    "BACKFLIP":  [0.2, 1.0, 0.45],
    "2022":      [1.0, 1.0, 1.0],   # ขาว — ปี/วันที่
    "JULY 6":    [1.0, 1.0, 1.0],
}
NEW_SIZE = 28

draft_dir = Path(sys.argv[1])
p = draft_dir / "draft_content.json"
data = json.loads(p.read_text(encoding="utf-8"))

bdir = draft_dir / "_backups"
bdir.mkdir(exist_ok=True)
shutil.copy2(p, bdir / f"draft_content.{time.strftime('%Y%m%d-%H%M%S')}.json")

# 1) boost เสียงพากย์
n_tts = 0
for tr in data.get("tracks", []):
    if tr.get("type") == "audio":
        for seg in tr.get("segments", []):
            seg["volume"] = 1.8
            n_tts += 1

# 2) ลดเสียงจริงในช็อตวิดีโอ
n_real = 0
for tr in data.get("tracks", []):
    if tr.get("type") == "video":
        for seg in tr.get("segments", []):
            if seg.get("volume", 0) >= 0.99:
                seg["volume"] = 0.7
                n_real += 1

# 3) restyle captions
n_cap = 0
for m in data.get("materials", {}).get("texts", []):
    try:
        c = json.loads(m.get("content", ""))
    except Exception:
        continue
    txt = c.get("text", "")
    if txt.strip() == "TEMPLATE":
        continue
    color = COLOR.get(txt.strip(), COLOR["default"])
    for s in c.get("styles", []):
        s["size"] = NEW_SIZE
        s.setdefault("fill", {}).setdefault("content", {})["render_type"] = "solid"
        s["fill"]["content"]["solid"] = {"color": color}
    m["content"] = json.dumps(c, ensure_ascii=False)
    n_cap += 1
    print(f"  caption {txt!r}: size={NEW_SIZE}, color={color}")

p.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"\nเสียงพากย์ x1.8 ({n_tts} segments) | เสียงจริงลดเหลือ 0.7 ({n_real} ช็อต) | restyle {n_cap} captions")
