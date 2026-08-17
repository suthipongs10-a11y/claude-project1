#!/usr/bin/env python3
"""โหลดฟอนต์จาก Google Fonts มาเป็นไฟล์ .ttf ที่ Pillow ใช้ได้

จำเป็นเพราะเครื่อง Claude Code cloud ไม่มีฟอนต์ไทย และ apt ก็ถูกบล็อก
แต่ fonts.googleapis.com / fonts.gstatic.com เข้าได้

Google Fonts แจกเป็น woff2 ที่ซอยเป็น subset ตาม unicode-range สคริปต์นี้จึง
โหลดหลาย subset (ไทย + ละติน) แล้ว merge กลับเป็นไฟล์เดียว ไม่ให้ตัวอักษรอังกฤษ
ในคำบรรยายไทยกลายเป็นสี่เหลี่ยม

ใช้:
  python3 fetch_font.py --family "Noto Sans Thai" --weight 700 -o fonts/NotoSansThai-Bold.ttf
"""
import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path

UA_MODERN = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
             "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
# subset ที่ต้องได้: ไทย + ละตินพื้นฐาน (ชื่อสินค้า/ตัวเลข/หน่วยเงิน)
WANTED = {"thai": "0E01", "latin": "U+0000-00FF", "latin-ext": "U+0100-02BA"}


def fetch_css(family: str, weight: int) -> str:
    url = (f"https://fonts.googleapis.com/css2?family="
           f"{family.replace(' ', '+')}:wght@{weight}&display=swap")
    r = subprocess.run(["curl", "-sS", "-m", "25", "-A", UA_MODERN, url],
                       capture_output=True, text=True)
    if r.returncode != 0 or "@font-face" not in r.stdout:
        sys.exit(f"ขอ CSS ของ {family} ไม่ได้: {r.stderr.strip()[:300] or r.stdout[:300]}")
    return r.stdout


def subset_urls(css: str) -> dict[str, str]:
    found = {}
    for block in css.split("@font-face"):
        m = re.search(r"url\((https://[^)]+\.woff2)\)", block)
        if not m:
            continue
        rng = (re.search(r"unicode-range:\s*([^;]+);", block) or [None, ""])[1]
        for name, marker in WANTED.items():
            if marker in rng and name not in found:
                found[name] = m.group(1)
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--family", default="Noto Sans Thai")
    ap.add_argument("--weight", type=int, default=700)
    ap.add_argument("-o", "--out", required=True)
    a = ap.parse_args()

    try:
        from fontTools.ttLib import TTFont
        from fontTools.ttLib.woff2 import decompress
        from fontTools.merge import Merger
        from fontTools.varLib.instancer import instantiateVariableFont
    except ImportError:
        sys.exit("ต้องมี fonttools + brotli: pip install fonttools brotli")

    urls = subset_urls(fetch_css(a.family, a.weight))
    if "thai" not in urls and "latin" not in urls:
        sys.exit(f"ไม่เจอ subset ที่ต้องการใน CSS ของ {a.family}")
    print(f"subset ที่จะโหลด: {', '.join(urls)}")

    tmp = Path(tempfile.mkdtemp(prefix="font-"))
    parts = []
    for name, url in urls.items():
        w2 = tmp / f"{name}.woff2"
        r = subprocess.run(["curl", "-sS", "-m", "60", "-o", str(w2), url])
        if r.returncode != 0 or not w2.exists():
            print(f"  ข้าม {name}: โหลดไม่ได้", file=sys.stderr)
            continue
        ttf = tmp / f"{name}.ttf"
        with open(w2, "rb") as fh:
            decompress(fh, str(ttf))
        # subset ของ Google เป็น variable font — ตรึงน้ำหนักก่อน merge
        f = TTFont(str(ttf))
        if "fvar" in f:
            f = instantiateVariableFont(f, {"wght": a.weight}, updateFontNames=False)
            f.save(str(ttf))
        f.close()
        parts.append(str(ttf))
        print(f"  {name} ok")

    if not parts:
        sys.exit("โหลด subset ไม่ได้เลย")

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if len(parts) == 1:
        Path(parts[0]).replace(out)
    else:
        merged = Merger().merge(parts)
        merged.save(str(out))
        merged.close()

    check = TTFont(str(out))
    cmap = check.getBestCmap()
    thai = len([c for c in cmap if 0x0E01 <= c <= 0x0E5B])
    latin = len([c for c in cmap if 0x41 <= c <= 0x7A])
    check.close()
    print(f"เสร็จ: {out}  (ไทย {thai} ตัว, ละติน {latin} ตัว)")
    if thai == 0:
        print("เตือน: ไฟล์นี้ไม่มีอักษรไทย — ตรวจชื่อ family อีกครั้ง", file=sys.stderr)


if __name__ == "__main__":
    main()
