#!/usr/bin/env python3
"""Build a web-review clip from shotlist.json with ffmpeg.

Shot types
  web_pan   วิ่งสกรอลล์ลงบนภาพ full-page screenshot (PNG)
  web_hold  ภาพ viewport นิ่ง + ken-burns ซูมช้า
  broll     ฟุตเทจ (stock/AI) crop เต็มเฟรม
  title     การ์ดตัวอักษรใหญ่ พื้นสีเดียว

caption วาดเป็น PNG ด้วย Pillow แล้ว overlay (ดู captions.py) — ไม่ใช้ drawtext
เพราะ ffmpeg static ที่ pip ลงให้ไม่มี libfreetype

ใช้:
  python assemble.py shotlist.json --aspect 16x9 -o out/review-16x9.mp4
  python assemble.py shotlist.json --aspect 9x16 -o out/review-9x16.mp4
"""
import argparse
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from captions import render_overlay  # noqa: E402

ASPECTS = {"16x9": (1920, 1080), "9x16": (1080, 1920), "1x1": (1080, 1080)}


def ffmpeg_bin() -> str:
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    p = shutil.which("ffmpeg")
    if p:
        return p
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("ไม่พบ ffmpeg — ติดตั้งด้วย: pip install imageio-ffmpeg")


def png_size(path: Path) -> tuple[int, int]:
    """อ่าน w,h จาก PNG header (ในเครื่องนี้ไม่มี ffprobe)"""
    with open(path, "rb") as fh:
        head = fh.read(26)
    if head[:8] != b"\x89PNG\r\n\x1a\n" or head[12:16] != b"IHDR":
        sys.exit(f"{path} อ่าน PNG header ไม่ได้ — แปลงเป็น PNG ก่อน")
    return struct.unpack(">II", head[16:24])


def even(n: int) -> int:
    return n if n % 2 == 0 else n - 1


class Builder:
    def __init__(self, canvas, fps, workdir, ff):
        self.w, self.h = canvas
        self.fps = fps
        self.work = workdir
        self.ff = ff

    # ---------- ส่วนกลาง ----------

    def _overlay(self, shot, idx) -> Path | None:
        return render_overlay(
            self.w, self.h, self.work / f"ov{idx:03d}.png",
            caption=shot.get("caption"),
            source_label=shot.get("source_label"),
            caption_scale=float(shot.get("caption_scale", 0.062)),
            caption_y=shot.get("caption_y"),
        )

    def _post(self, shot, dur) -> list[str]:
        """filter ที่ต้องมาหลัง overlay — fade ต้องกินทั้ง caption ด้วย"""
        parts = []
        fi = float(shot.get("fade_in", 0) or 0)
        fo = float(shot.get("fade_out", 0) or 0)
        if fi > 0:
            parts.append(f"fade=t=in:st=0:d={fi}")
        if fo > 0:
            parts.append(f"fade=t=out:st={max(0.0, dur - fo):.3f}:d={fo}")
        parts.append("format=yuv420p")
        return parts

    def _run(self, in_args, geom: list[str], shot, idx, dur, out: Path):
        geom = [*geom, f"fps={self.fps}", "setsar=1"]
        post = self._post(shot, dur)
        ov = self._overlay(shot, idx)

        args = [self.ff, "-y", "-hide_banner", "-loglevel", "error", *in_args]
        if ov:
            args += ["-i", str(ov), "-filter_complex",
                     f"[0:v]{','.join(geom)}[base];"
                     f"[base][1:v]overlay=0:0:shortest=0[ov];"
                     f"[ov]{','.join(post)}[out]",
                     "-map", "[out]"]
        else:
            args += ["-vf", ",".join(geom + post)]
        args += ["-t", f"{dur}", "-c:v", "libx264", "-preset", "veryfast",
                 "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(self.fps),
                 "-an", str(out)]

        r = subprocess.run(args, capture_output=True, text=True)
        if r.returncode != 0:
            print(" ".join(args), file=sys.stderr)
            sys.exit(f"ffmpeg ล้ม: {r.stderr.strip()[:900]}")

    # ---------- shot types ----------

    def web_pan(self, shot, idx, out):
        """สกรอลล์ลง/ขึ้น บนภาพหน้าเว็บเต็มหน้า"""
        src = Path(shot["src"])
        dur = float(shot["dur"])
        iw, ih = png_size(src)

        tw = even(int(self.w * float(shot.get("zoom", 1.0))))
        th = even(int(ih * tw / iw))

        if th <= self.h:
            geom = [f"scale={tw}:{th}:flags=lanczos",
                    f"pad={max(tw, self.w)}:{self.h}:(ow-iw)/2:(oh-ih)/2:color=0x101418",
                    f"crop={self.w}:{self.h}"]
        else:
            travel = th - self.h
            frac = min(max(float(shot.get("travel", 1.0)), 0.0), 1.0)
            span = max(1, int(travel * frac))
            y0 = int(travel * float(shot.get("start_at", 0.0)))
            y0 = min(y0, max(0, travel - span))
            expr = (f"{y0}+({span})*t/{dur}" if shot.get("pan", "down") == "down"
                    else f"{y0 + span}-({span})*t/{dur}")
            x = f"(iw-{self.w})/2" if tw > self.w else "0"
            geom = [f"scale={tw}:{th}:flags=lanczos",
                    f"crop={self.w}:{self.h}:{x}:'min(max({expr}\\,0)\\,{travel})'"]

        self._run(["-loop", "1", "-framerate", str(self.fps), "-i", str(src)],
                  geom, shot, idx, dur, out)

    def web_hold(self, shot, idx, out):
        """ภาพนิ่ง + ken burns ซูมเข้าจุดที่สนใจ

        fit=cover  ครอปให้เต็มเฟรม (ค่าเริ่มต้นของแนวนอน)
        fit=width  พอดีความกว้าง เติมพื้นด้านบน/ล่าง (ค่าเริ่มต้นของแนวตั้ง —
                   หน้าเว็บกว้างถ้าครอปเป็น 9:16 จะเหลือแค่กลางจอ)
        """
        src = Path(shot["src"])
        dur = float(shot["dur"])
        zmax = float(shot.get("zoom_to", 1.14))
        fx, fy = shot.get("focus", [0.5, 0.5])
        frames = max(2, int(dur * self.fps))
        # ทำ base ที่ 2x ก่อนเข้า zoompan เพื่อไม่ให้ภาพแตกตอนซูม
        bw, bh = self.w * 2, self.h * 2
        fit = shot.get("fit") or ("width" if self.h > self.w else "cover")
        pad = shot.get("pad_color", "0x0B0E13")

        if fit == "width":
            base = [f"scale={bw}:-2:flags=lanczos",
                    f"pad={bw}:'max({bh}\\,ih)':(ow-iw)/2:(oh-ih)/2:color={pad}",
                    f"crop={bw}:{bh}"]
        else:
            base = [f"scale={bw}:{bh}:force_original_aspect_ratio=increase:flags=lanczos",
                    f"crop={bw}:{bh}"]

        geom = base + [
            f"zoompan=z='1+{zmax - 1:.4f}*on/{frames}':"
            f"x='iw*{fx}-(iw/zoom/2)':y='ih*{fy}-(ih/zoom/2)':"
            f"d=1:s={self.w}x{self.h}:fps={self.fps}",
        ]
        self._run(["-loop", "1", "-framerate", str(self.fps), "-i", str(src)],
                  geom, shot, idx, dur, out)

    def broll(self, shot, idx, out):
        """ฟุตเทจวิดีโอ crop เต็มเฟรม (วนซ้ำถ้าสั้นกว่าที่ต้องการ)"""
        src = Path(shot["src"])
        dur = float(shot["dur"])
        ss = float(shot.get("in", 0.0))
        in_args = (["-ss", f"{ss}"] if ss else []) + \
                  ["-stream_loop", "-1", "-i", str(src)]
        geom = [f"scale={self.w}:{self.h}:force_original_aspect_ratio=increase",
                f"crop={self.w}:{self.h}"]
        self._run(in_args, geom, shot, idx, dur, out)

    def title(self, shot, idx, out):
        dur = float(shot["dur"])
        bg = shot.get("bg", "0x0B0E13")
        self._run(["-f", "lavfi", "-i",
                   f"color=c={bg}:s={self.w}x{self.h}:r={self.fps}:d={dur}"],
                  ["null"], shot, idx, dur, out)

    def build(self, shot, idx) -> Path:
        out = self.work / f"shot{idx:03d}.mp4"
        kind = shot.get("type", "broll")
        fn = {"web_pan": self.web_pan, "web_hold": self.web_hold,
              "broll": self.broll, "title": self.title}.get(kind)
        if not fn:
            sys.exit(f"shot type ไม่รู้จัก: {kind}")
        fn(shot, idx, out)
        return out


def mux(ff, video: Path, audio: dict, out: Path):
    vo, bgm = audio.get("vo"), audio.get("bgm")
    if not vo and not bgm:
        shutil.copy2(video, out)
        return

    args = [ff, "-y", "-hide_banner", "-loglevel", "error", "-i", str(video)]
    fc, labels, idx = [], [], 1
    if vo:
        args += ["-i", str(vo)]
        fc.append(f"[{idx}:a]volume={audio.get('vo_gain', 1.0)}[vo]")
        labels.append("[vo]")
        idx += 1
    if bgm:
        args += ["-stream_loop", "-1", "-i", str(bgm)]
        fc.append(f"[{idx}:a]volume={audio.get('bgm_db', -24)}dB[bg]")
        labels.append("[bg]")
        idx += 1

    if len(labels) == 2:
        fc.append("[vo][bg]amix=inputs=2:duration=first:"
                  "dropout_transition=0:normalize=0[aout]")
    else:
        fc.append(f"{labels[0]}anull[aout]")

    args += ["-filter_complex", ";".join(fc), "-map", "0:v", "-map", "[aout]",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
             "-movflags", "+faststart", str(out)]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"mux ล้ม: {r.stderr.strip()[:900]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("shotlist")
    ap.add_argument("--aspect", default="16x9", choices=sorted(ASPECTS))
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--fps", type=int, default=0)
    ap.add_argument("--keep-work", action="store_true")
    a = ap.parse_args()

    sl_path = Path(a.shotlist).resolve()
    sl = json.loads(sl_path.read_text(encoding="utf-8"))
    out = Path(a.out).resolve()
    os.chdir(sl_path.parent)  # path ใน shotlist อ้างอิงจากที่ตั้งไฟล์

    fps = a.fps or int(sl.get("fps", 30))
    ff = ffmpeg_bin()
    out.parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="wrc-"))

    try:
        b = Builder(ASPECTS[a.aspect], fps, work, ff)
        shots = [s for s in sl["shots"] if not s.get("skip")]
        parts = []
        for i, shot in enumerate(shots):
            print(f"  [{i + 1}/{len(shots)}] {shot.get('type')} "
                  f"{shot.get('dur')}s {shot.get('id', '')}")
            parts.append(b.build(shot, i))
        if not parts:
            sys.exit("shotlist ว่าง")

        lst = work / "concat.txt"
        lst.write_text("".join(f"file '{p}'\n" for p in parts), encoding="utf-8")
        silent = work / "video.mp4"
        r = subprocess.run([ff, "-y", "-hide_banner", "-loglevel", "error",
                            "-f", "concat", "-safe", "0", "-i", str(lst),
                            "-c", "copy", str(silent)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit(f"concat ล้ม: {r.stderr.strip()[:900]}")

        mux(ff, silent, sl.get("audio", {}), out)
        print(f"เสร็จ: {out}  ({out.stat().st_size / 1e6:.2f} MB)")
    finally:
        if a.keep_work:
            print(f"work: {work}")
        else:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
