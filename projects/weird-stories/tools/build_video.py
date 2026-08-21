#!/usr/bin/env python3
"""ประกอบคลิปจาก ภาพ + เสียงบรรยาย + BGM + ซับไทย

ใช้:
    python3 tools/build_video.py episodes/<ep>                 # 16:9 (1920x1080)
    python3 tools/build_video.py episodes/<ep> --vertical      # 9:16 (1080x1920) สำหรับ Shorts/Reels
    python3 tools/build_video.py episodes/<ep> --no-subs       # ไม่ฝังซับ

ต้องมีก่อน:
    <ep>/script.json          สคริปต์ (segments)
    <ep>/shots.json           รายการภาพ + field "seg" บอกว่าช็อตนี้คลุม segment ไหน
    <ep>/audio/*.wav          จาก gen_voice.py
    <ep>/audio/timing.json    จาก gen_voice.py
    <ep>/images/*             จาก gen_images.py
    <ep>/audio/bgm.mp3        (ไม่บังคับ) จาก gen_music.py

ผลลัพธ์: <ep>/output.mp4
"""
import json
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

import imageio_ffmpeg

sys.path.insert(0, str(Path(__file__).resolve().parent))
from captions import build_cues, build_notice  # noqa: E402

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

FPS = 30
GAP = 0.28          # ช่องว่างระหว่างท่อนบรรยาย (วินาที) — ให้คนดูหายใจ
XFADE = 0.6         # ความยาวรอยต่อ cross-fade ระหว่างภาพ
BGM_VOL = 0.073     # ระดับเสียงดนตรี = 0.13 เดิม ลดลง 5 dB (0.13 * 10^(-5/20))
SUB_MARGIN = 0.075  # ระยะซับจากขอบล่าง (สัดส่วนของความสูงเฟรม)
MAX_SHOT = 12       # ช็อตที่ค้างจอนานกว่านี้จะขึ้นเตือน (ควรเพิ่มภาพให้ segment นั้น)
# CRF ของไฟล์สุดท้าย — เทียบที่ 1:1 แล้ว 19/21/23 แทบแยกไม่ออกเพราะเกรนกลบ artifact
# แต่ขนาดต่างกันมาก (คลิป 4.6 นาที: 331 / 242 / 177 MB) จึงใช้ 21 เป็นจุดสมดุล
CRF = 21
UPSCALE = 2         # อัพสเกลก่อน zoompan กันภาพกระตุก (ซูมสูงสุด 1.14 เท่า 2 ก็พอ)

# --- เกรนฟิล์ม ---
# วัดจริงกับคลิป 10 วินาที 1080p (CRF 19) แล้วได้ผลนี้:
#   ไม่มีเกรน                        2.2 Mbps
#   เกรน 9 ทุกช่องสี สุ่มใหม่ทุกเฟรม  108.6 Mbps   <- แพงกว่า 47 เท่า
#   เกรน 9 เฉพาะ luma สุ่มทุกเฟรม     70.8 Mbps
#   เกรน 9 เฉพาะ luma แบบคงที่         8.9 Mbps   <- ใช้ตัวนี้
# เกรนที่สุ่มใหม่ทุกเฟรมทำลายการบีบอัดระหว่างเฟรมของ x264 จนบิตเรตพุ่ง
# ส่วนเกรนคงที่ให้เท็กซ์เจอร์แบบฟิล์มเหมือนกัน แต่ไฟล์เล็กกว่าสิบเท่า
GRAIN = 9           # ความแรงเกรน 0 = ปิด (แนะนำ 6-14)
GRAIN_TEMPORAL = False  # True = เกรนวิ่งเหมือนฟิล์มจริง แต่ไฟล์ใหญ่ขึ้น ~8 เท่า
VIGNETTE = True     # ขอบมืดรอบเฟรม ช่วยให้ภาพดูเก่าเหมือนฟิล์ม


def run(args, cwd=None):
    p = subprocess.run(args, capture_output=True, text=True, cwd=cwd)
    if p.returncode != 0:
        sys.exit(f"ffmpeg ล้มเหลว:\n{' '.join(str(a) for a in args[:14])} ...\n{p.stderr[-2500:]}")
    return p


def build_shot_clip(img, dur, w, h, out, idx):
    """1 ภาพ -> 1 คลิป พร้อม Ken Burns (ซูมเข้า/ออกสลับกันไปตามลำดับช็อต)"""
    frames = max(2, int(round(dur * FPS)))
    zoom_in = idx % 2 == 0
    z = "min(1.0006+0.0006*on,1.14)" if zoom_in else "max(1.14-0.0006*on,1.0006)"
    # อัพสเกลก่อน zoompan เพื่อกันภาพกระตุกเป็นขั้นบันไดตอนซูม
    chain = [
        f"scale={w * UPSCALE}:{h * UPSCALE}:force_original_aspect_ratio=increase",
        f"crop={w * UPSCALE}:{h * UPSCALE}",
        f"zoompan=z='{z}':d={frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={w}x{h}:fps={FPS}",
    ]
    if VIGNETTE:
        chain.append("vignette=PI/6")
    chain.append("format=yuv420p")
    # เกรนไม่ได้ใส่ตรงนี้ — ใส่ตอนเข้ารหัสรอบสุดท้ายรอบเดียว
    # ถ้าใส่ที่นี่ ไฟล์กลางจะใหญ่มากและถูกเข้ารหัสทับอีกรอบโดยไม่จำเป็น
    vf = ",".join(chain)
    run([FFMPEG, "-y", "-loop", "1", "-i", str(img), "-t", f"{dur:.3f}",
         "-vf", vf, "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "16", "-pix_fmt", "yuv420p", str(out)])


def main():
    ep = Path(sys.argv[1])
    vertical = "--vertical" in sys.argv
    want_subs = "--no-subs" not in sys.argv
    w, h = (1080, 1920) if vertical else (1920, 1080)

    script = json.loads((ep / "script.json").read_text(encoding="utf-8"))
    timing = json.loads((ep / "audio" / "timing.json").read_text())
    shots = json.loads((ep / "shots.json").read_text(encoding="utf-8"))["shots"]

    # --- วางไทม์ไลน์ของแต่ละ segment ---
    t, seg_times = 0.0, {}
    for seg in script["segments"]:
        d = timing[seg["id"]]
        seg_times[seg["id"]] = (t, d)
        t += d + GAP
    total = max(t - GAP, 0.1)

    tmp = Path(tempfile.mkdtemp(prefix="wsbuild-"))
    try:
        # --- เสียงบรรยาย: pad ความเงียบท้ายแต่ละท่อนให้ตรงกับ seg_times แล้วต่อกัน ---
        padded = []
        for i, seg in enumerate(script["segments"]):
            p = tmp / f"pad{i}.wav"
            run([FFMPEG, "-y", "-i", str(ep / "audio" / f"{seg['id']}.wav"),
                 "-af", f"aresample=48000,apad=pad_dur={GAP}", str(p)])
            padded.append(p)
        lst = tmp / "alist.txt"
        lst.write_text("".join(f"file '{p}'\n" for p in padded))
        narration = tmp / "narration.wav"
        run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
             "-c:a", "pcm_s16le", "-ar", "48000", str(narration)])

        # --- ความยาวช็อต ---
        # ช็อตหนึ่งคลุมได้หลาย segment และ segment หนึ่งก็แชร์ได้หลายช็อต
        # (ใส่หลายภาพในท่อนเดียวเพื่อให้ภาพเปลี่ยนบ่อยขึ้น) → หารเวลาเท่าๆ กันตามจำนวนช็อตที่แชร์
        shot_segs = []
        for idx, shot in enumerate(shots):
            segs = shot.get("seg")
            shot_segs.append([segs] if isinstance(segs, str)
                             else (segs or [script["segments"][idx]["id"]]))
        claims = Counter(s for segs in shot_segs for s in segs)
        missing = [s["id"] for s in script["segments"] if s["id"] not in claims]
        if missing:
            sys.exit(f"segment เหล่านี้ยังไม่มีช็อตไหนคลุมเลย: {', '.join(missing)}\n"
                     f"ทุก segment ต้องถูกอ้างถึงใน shots.json อย่างน้อยหนึ่งช็อต")

        clips = []
        for idx, (shot, segs) in enumerate(zip(shots, shot_segs)):
            dur = sum((timing[s] + GAP) / claims[s] for s in segs)
            img = next(iter(sorted((ep / "images").glob(f"{shot['id']}.*"))), None)
            if img is None:
                sys.exit(f"ไม่พบภาพของช็อต {shot['id']} ใน {ep / 'images'}")
            out = tmp / f"clip{idx:03d}.mp4"
            build_shot_clip(img, dur + (XFADE if idx < len(shots) - 1 else 0), w, h, out, idx)
            clips.append((out, dur))
            print(f"  ช็อต {shot['id']}: {dur:.2f}s")
        long_shots = [(sh["id"], d) for sh, (_, d) in zip(shots, clips) if d > MAX_SHOT]
        if long_shots:
            print("  เตือน: ช็อตเหล่านี้ค้างจอนานเกิน {}s คนดูจะเริ่มหลุด "
                  "ลองเพิ่มช็อตให้ segment นั้น: {}"
                  .format(MAX_SHOT, ", ".join(f"{i} ({d:.1f}s)" for i, d in long_shots)))

        short = [(sh["id"], d) for sh, (_, d) in zip(shots, clips) if d <= XFADE]
        if short:
            sys.exit("ช็อตเหล่านี้สั้นกว่ารอยต่อ cross-fade ({}s) จนต่อคลิปไม่ได้: {}\n"
                     "ลดจำนวนช็อตที่แชร์ segment เดียวกัน หรือลดค่า XFADE"
                     .format(XFADE, ", ".join(f"{i} ({d:.2f}s)" for i, d in short)))

        # --- ซับไทย: เรนเดอร์เป็น PNG ก่อน (ดูเหตุผลใน captions.py) ---
        cues = []
        if want_subs:
            cuedir = tmp / "cues"
            cuedir.mkdir()
            cues = build_cues(script["segments"], seg_times, w, h, cuedir)
            if script.get("disclaimer"):
                cues.append(build_notice(script["disclaimer"], w, h, cuedir))
            print(f"  ซับ {len(cues)} คิว")

        # --- ประกอบทั้งหมดในรอบเดียว ---
        # ต่อภาพด้วย cross-fade + แปะซับ + มิกซ์เสียง จบใน ffmpeg คำสั่งเดียว
        # (เดิมต่อทีละคู่แล้วเข้ารหัสใหม่ทุกครั้ง ซึ่งช้าเป็น O(n²) เมื่อภาพเยอะ
        #  และคุณภาพตกลงทุกรอบที่เข้ารหัสซ้ำ)
        bgm = next(iter((ep / "audio").glob("bgm.*")), None)
        inputs, chain = [], []
        for clip, _ in clips:
            inputs += ["-i", str(clip)]
        for c in cues:
            inputs += ["-i", str(c["png"])]
        i_narr = len(clips) + len(cues)
        inputs += ["-i", str(narration)]
        if bgm:
            inputs += ["-stream_loop", "-1", "-i", str(bgm)]

        cur, offset = "0:v", clips[0][1]
        for i in range(1, len(clips)):
            chain.append(f"[{cur}][{i}:v]xfade=transition=fade:duration={XFADE}:"
                         f"offset={offset - XFADE:.3f}[x{i}]")
            cur, offset = f"x{i}", offset + clips[i][1]

        for n, c in enumerate(cues):
            idx = len(clips) + n
            x = int((w - c["w"]) / 2)
            y = c.get("y", int(h - h * SUB_MARGIN - c["h"]))
            chain.append(f"[{cur}][{idx}:v]overlay={x}:{y}:"
                         f"enable='between(t,{c['start']:.3f},{c['end']:.3f})'[c{n}]")
            cur = f"c{n}"
        post = []
        if GRAIN:
            # c0s = เฉพาะช่อง luma ตาที่มองเห็นเป็นเกรนอยู่แล้ว และถูกกว่าใส่ทุกช่องสี
            post.append(f"noise=c0s={GRAIN}" + (":c0f=t" if GRAIN_TEMPORAL else ""))
        post.append("format=yuv420p")
        chain.append(f"[{cur}]" + ",".join(post) + "[vout]")

        if bgm:
            chain.append(f"[{i_narr + 1}:a]volume={BGM_VOL},"
                         f"afade=t=out:st={max(total - 2, 0):.2f}:d=2[bg]")
            chain.append(f"[{i_narr}:a][bg]amix=inputs=2:duration=first:"
                         f"dropout_transition=0,dynaudnorm=f=200:g=5[aout]")
            amap = ["-map", "[aout]"]
        else:
            amap = ["-map", f"{i_narr}:a"]

        out = ep / ("output_vertical.mp4" if vertical else "output.mp4")
        run([FFMPEG, "-y", *inputs, "-filter_complex", ";".join(chain),
             "-map", "[vout]", *amap, "-shortest", "-r", str(FPS),
             "-c:v", "libx264", "-preset", "medium", "-crf", str(CRF),
             "-pix_fmt", "yuv420p", "-movflags", "+faststart",
             "-c:a", "aac", "-b:a", "192k", str(out)])

        print(f"\nเสร็จ: {out}  ({out.stat().st_size / 1024 / 1024:.1f} MB, "
              f"~{total:.1f}s, {w}x{h})")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
