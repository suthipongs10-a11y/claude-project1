#!/usr/bin/env python3
"""à¹à¸à¹‰ draft à¸£à¸­à¸š polish:
1. à¹€à¸ªà¸µà¸¢à¸‡à¸žà¸²à¸à¸¢à¹Œ (audio track) volume -> 1.8
2. à¸Šà¹‡à¸­à¸•à¸§à¸´à¸”à¸µà¹‚à¸­à¸—à¸µà¹ˆà¹€à¸›à¸´à¸”à¹€à¸ªà¸µà¸¢à¸‡à¸ˆà¸£à¸´à¸‡ (vol=1.0) -> 0.7
3. Caption: à¸‚à¸¢à¸²à¸¢ size 15 -> 28 + à¸ªà¸µà¸•à¸²à¸¡à¸­à¸²à¸£à¸¡à¸“à¹Œà¸„à¸³ (à¸¢à¸à¹€à¸§à¹‰à¸™ TEMPLATE)
à¹ƒà¸Šà¹‰: python restyle_and_mix.py <draft_dir>
"""
import json, sys, time, shutil
from pathlib import Path

COLOR = {
    "default":     [1.0, 0.9, 0.0],
    "GOODBYE":     [1.0, 0.18, 0.18],
    "HE CAME BACK":[0.2, 1.0, 0.45],
    "7.5 MILLION": [1.0, 1.0, 1.0],
}
NEW_SIZE = 28

draft_dir = Path(sys.argv[1])
p = draft_dir / "draft_content.json"
data = json.loads(p.read_text(encoding="utf-8"))

bdir = draft_dir / "_backups"
bdir.mkdir(exist_ok=True)
shutil.copy2(p, bdir / f"draft_content.{time.strftime('%Y%m%d-%H%M%S')}.json")

# 1) boost à¹€à¸ªà¸µà¸¢à¸‡à¸žà¸²à¸à¸¢à¹Œ
n_tts = 0
for tr in data.get("tracks", []):
    if tr.get("type") == "audio":
        for seg in tr.get("segments", []):
            seg["volume"] = 1.8
            n_tts += 1

# 2) à¸¥à¸”à¹€à¸ªà¸µà¸¢à¸‡à¸ˆà¸£à¸´à¸‡à¹ƒà¸™à¸Šà¹‡à¸­à¸•à¸§à¸´à¸”à¸µà¹‚à¸­
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
print(f"\nà¹€à¸ªà¸µà¸¢à¸‡à¸žà¸²à¸à¸¢à¹Œ x1.8 ({n_tts} segments) | à¹€à¸ªà¸µà¸¢à¸‡à¸ˆà¸£à¸´à¸‡à¸¥à¸”à¹€à¸«à¸¥à¸·à¸­ 0.7 ({n_real} à¸Šà¹‡à¸­à¸•) | restyle {n_cap} captions")

