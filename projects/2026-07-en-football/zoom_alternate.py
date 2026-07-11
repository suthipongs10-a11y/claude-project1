#!/usr/bin/env python3
"""ใส่ zoom สลับทิศ (เข้า/ออก) ให้ทุกช็อตวิดีโอใน draft — ช็อตคู่ซูมเข้า 1.0->1.12, ช็อตคี่ซูมออก 1.12->1.0
ใช้: python zoom_alternate.py <draft_dir>
"""
import json, sys, time, shutil, uuid
from pathlib import Path

draft_dir = Path(sys.argv[1])
p = draft_dir / "draft_content.json"
data = json.loads(p.read_text(encoding="utf-8"))

bdir = draft_dir / "_backups"
bdir.mkdir(exist_ok=True)
shutil.copy2(p, bdir / f"draft_content.{time.strftime('%Y%m%d-%H%M%S')}.json")

def nid():
    return str(uuid.uuid4()).upper()

def kf(prop, dur, v_from, v_to):
    return {
        "id": nid(), "property_type": prop, "material_id": "",
        "keyframe_list": [
            {"id": nid(), "time_offset": 0, "values": [v_from], "curveType": "Line",
             "graphID": "", "left_control": {"x": 0, "y": 0}, "right_control": {"x": 0, "y": 0}},
            {"id": nid(), "time_offset": dur, "values": [v_to], "curveType": "Line",
             "graphID": "", "left_control": {"x": 0, "y": 0}, "right_control": {"x": 0, "y": 0}},
        ],
    }

count = 0
for tr in data.get("tracks", []):
    if tr.get("type") != "video":
        continue
    for i, seg in enumerate(tr.get("segments", [])):
        dur = seg.get("target_timerange", {}).get("duration", 0)
        if dur <= 0:
            continue
        zin = (i % 2 == 0)
        vf, vt = (1.0, 1.12) if zin else (1.12, 1.0)
        seg["common_keyframes"] = [kf("KFTypeScaleX", dur, vf, vt), kf("KFTypeScaleY", dur, vf, vt)]
        count += 1
        print(f"  shot {i+1}: zoom {'IN' if zin else 'OUT'} {vf}->{vt}")

p.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"zoom สลับทิศใส่แล้ว {count} ช็อต")
