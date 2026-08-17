#!/usr/bin/env python3
"""ยืด/ย่อความยาว shot ทั้งหมดให้รวมเท่ากับไฟล์เสียงพากย์

ใช้ตอนที่ VO มาแล้วแต่ยังไม่รู้ว่าแต่ละ shot ควรยาวเท่าไหร่:
  python fit_timing.py shotlist.json --vo vo/full.mp3 --tail 1.2 -o shotlist.json

น้ำหนักการแบ่งเวลาใช้ค่า dur เดิมเป็นสัดส่วน (dur เดิมคือ "อยากให้ยาวประมาณนี้")
shot ที่ใส่ "lock": true จะไม่ถูกยืด — เอาไว้ล็อกการ์ดไทเทิล/เอาท์โทร
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

DUR_RE = re.compile(r"Duration:\s*(\d+):(\d\d):(\d\d\.\d+)")


def ffmpeg_bin() -> str:
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    p = shutil.which("ffmpeg")
    if p:
        return p
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def media_duration(path: Path) -> float:
    """อ่านความยาวจาก stderr ของ ffmpeg (image ไม่มี ffprobe ในเครื่อง)"""
    r = subprocess.run([ffmpeg_bin(), "-hide_banner", "-i", str(path)],
                       capture_output=True, text=True)
    m = DUR_RE.search(r.stderr)
    if not m:
        sys.exit(f"อ่านความยาวของ {path} ไม่ได้")
    h, mm, s = m.groups()
    return int(h) * 3600 + int(mm) * 60 + float(s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("shotlist")
    ap.add_argument("--vo", required=True, help="ไฟล์เสียงพากย์")
    ap.add_argument("--tail", type=float, default=1.0,
                    help="วินาทีที่เผื่อไว้ท้ายคลิปหลังเสียงจบ")
    ap.add_argument("--min-dur", type=float, default=1.2)
    ap.add_argument("-o", "--out")
    a = ap.parse_args()

    sl_path = Path(a.shotlist)
    sl = json.loads(sl_path.read_text(encoding="utf-8"))
    vo_path = (sl_path.parent / a.vo) if not Path(a.vo).is_absolute() else Path(a.vo)
    target = media_duration(vo_path) + a.tail

    shots = [s for s in sl["shots"] if not s.get("skip")]
    locked = sum(float(s["dur"]) for s in shots if s.get("lock"))
    flex = [s for s in shots if not s.get("lock")]
    flex_total = sum(float(s["dur"]) for s in flex)
    if not flex or flex_total <= 0:
        sys.exit("ไม่มี shot ที่ยืดได้ (ทุกอันถูก lock)")

    budget = target - locked
    if budget < len(flex) * a.min_dur:
        sys.exit(f"เสียงสั้นเกินไป ({target:.1f}s) สำหรับ {len(flex)} shot ที่ยืดได้ "
                 f"+ {locked:.1f}s ที่ล็อกไว้")

    scale = budget / flex_total
    for s in flex:
        s["dur"] = round(max(a.min_dur, float(s["dur"]) * scale), 2)

    # ปัดเศษที่หายไปใส่ shot ที่ยาวที่สุด ให้ผลรวมตรงเป๊ะ
    drift = target - (locked + sum(float(s["dur"]) for s in flex))
    biggest = max(flex, key=lambda s: float(s["dur"]))
    biggest["dur"] = round(float(biggest["dur"]) + drift, 2)

    sl.setdefault("audio", {})["vo"] = a.vo
    out = Path(a.out or a.shotlist)
    out.write_text(json.dumps(sl, ensure_ascii=False, indent=2), encoding="utf-8")
    total = locked + sum(float(s["dur"]) for s in flex)
    print(f"VO {target - a.tail:.2f}s + tail {a.tail}s → shot รวม {total:.2f}s "
          f"({len(flex)} ยืด ×{scale:.3f}, {len(shots) - len(flex)} ล็อก) → {out}")


if __name__ == "__main__":
    main()
