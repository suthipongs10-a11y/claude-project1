# ยืดช็อตวิดีโอให้ปิดช่องว่าง 0.12s ระหว่างเสียง (กันจอดำแวบ)
import json, sys, time, shutil
from pathlib import Path

draft_dir = Path(sys.argv[1])
p = draft_dir / "draft_content.json"
data = json.loads(p.read_text(encoding="utf-8"))
bdir = draft_dir / "_backups"; bdir.mkdir(exist_ok=True)
shutil.copy2(p, bdir / f"draft_content.{time.strftime('%Y%m%d-%H%M%S')}.json")

n = 0
for tr in data.get("tracks", []):
    if tr.get("type") != "video":
        continue
    segs = tr.get("segments", [])
    for i, seg in enumerate(segs):
        t = seg["target_timerange"]
        end = t["start"] + t["duration"]
        next_start = segs[i + 1]["target_timerange"]["start"] if i + 1 < len(segs) else end
        gap = next_start - end
        if 0 < gap <= 200000:  # ปิดช่องว่างไม่เกิน 0.2s
            t["duration"] += gap
            seg["source_timerange"]["duration"] = t["duration"]
            n += 1

data["duration"] = max(data.get("duration", 0), max(
    (s["target_timerange"]["start"] + s["target_timerange"]["duration"])
    for tr in data["tracks"] for s in tr.get("segments", [])))
p.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"ปิดช่องว่างแล้ว {n} จุด")
