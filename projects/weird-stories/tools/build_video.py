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
from pathlib import Path

import imageio_ffmpeg

sys.path.insert(0, str(Path(__file__).resolve().parent))
from captions import build_cues  # noqa: E402

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

FPS = 30
GAP = 0.35          # ช่องว่างระหว่างท่อนบรรยาย (วินาที) — ให้คนดูหายใจ
XFADE = 0.6         # ความยาวรอยต่อ cross-fade ระหว่างภาพ
BGM_VOL = 0.13      # ระดับเสียงดนตรีเทียบกับเสียงพูด
SUB_MARGIN = 0.075  # ระยะซับจากขอบล่าง (สัดส่วนของความสูงเฟรม)


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
    vf = (
        f"scale={w * 4}:{h * 4}:force_original_aspect_ratio=increase,"
        f"crop={w * 4}:{h * 4},"
        f"zoompan=z='{z}':d={frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={w}x{h}:fps={FPS},"
        f"format=yuv420p"
    )
    run([FFMPEG, "-y", "-loop", "1", "-i", str(img), "-t", f"{dur:.3f}",
         "-vf", vf, "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast",
         "-crf", "16", "-pix_fmt", "yuv420p", str(out)])


def burn_captions(video, cues, w, h, out):
    """overlay PNG ของแต่ละคิวทับวิดีโอ ตามช่วงเวลาของมัน"""
    inputs, chain, cur = ["-i", str(video)], [], "0:v"
    for i, c in enumerate(cues, start=1):
        inputs += ["-i", str(c["png"])]
        x = int((w - c["w"]) / 2)
        y = int(h - h * SUB_MARGIN - c["h"])
        nxt = f"v{i}"
        chain.append(
            f"[{cur}][{i}:v]overlay={x}:{y}:"
            f"enable='between(t,{c['start']:.3f},{c['end']:.3f})'[{nxt}]"
        )
        cur = nxt
    run([FFMPEG, "-y", *inputs, "-filter_complex", ";".join(chain),
         "-map", f"[{cur}]", "-r", str(FPS), "-c:v", "libx264",
         "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", str(out)])


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

        # --- แต่ละช็อตยาวเท่ากับผลรวมของ segment ที่มันคลุม ---
        clips = []
        for idx, shot in enumerate(shots):
            segs = shot.get("seg")
            segs = [segs] if isinstance(segs, str) else (segs or [script["segments"][idx]["id"]])
            dur = sum(timing[s] + GAP for s in segs)
            img = next(iter(sorted((ep / "images").glob(f"{shot['id']}.*"))), None)
            if img is None:
                sys.exit(f"ไม่พบภาพของช็อต {shot['id']} ใน {ep / 'images'}")
            out = tmp / f"clip{idx:03d}.mp4"
            build_shot_clip(img, dur + (XFADE if idx < len(shots) - 1 else 0), w, h, out, idx)
            clips.append((out, dur))
            print(f"  ช็อต {shot['id']}: {dur:.2f}s")

        # --- ต่อคลิปด้วย cross-fade ทีละคู่ ---
        cur, offset = clips[0][0], clips[0][1]
        for i in range(1, len(clips)):
            nxt, dur = clips[i]
            merged = tmp / f"merge{i:03d}.mp4"
            run([FFMPEG, "-y", "-i", str(cur), "-i", str(nxt), "-filter_complex",
                 f"[0:v][1:v]xfade=transition=fade:duration={XFADE}:"
                 f"offset={offset - XFADE:.3f},format=yuv420p[v]",
                 "-map", "[v]", "-r", str(FPS), "-c:v", "libx264",
                 "-preset", "veryfast", "-crf", "16", str(merged)])
            cur, offset = merged, offset + dur
        video = cur

        # --- ซับไทย (เรนเดอร์ด้วย Pillow แล้ว overlay — ดูเหตุผลใน captions.py) ---
        if want_subs:
            cuedir = tmp / "cues"
            cuedir.mkdir()
            cues = build_cues(script["segments"], seg_times, w, h, cuedir)
            subbed = tmp / "subbed.mp4"
            burn_captions(video, cues, w, h, subbed)
            video = subbed
            print(f"  ซับ {len(cues)} คิว")

        # --- มิกซ์เสียง: บรรยาย + BGM (วนลูป, เบา, fade ท้าย) ---
        bgm = next(iter((ep / "audio").glob("bgm.*")), None)
        inputs = ["-i", str(video), "-i", str(narration)]
        if bgm:
            inputs += ["-stream_loop", "-1", "-i", str(bgm)]
            # input 0 = วิดีโอ (ไม่มีเสียง), 1 = narration, 2 = bgm
            amap = ["-filter_complex",
                    f"[2:a]volume={BGM_VOL},afade=t=out:st={max(total - 2, 0):.2f}:d=2[bg];"
                    f"[1:a][bg]amix=inputs=2:duration=first:dropout_transition=0,"
                    f"dynaudnorm=f=200:g=5[aout]",
                    "-map", "[aout]"]
        else:
            amap = ["-map", "1:a"]

        out = ep / ("output_vertical.mp4" if vertical else "output.mp4")
        run([FFMPEG, "-y", *inputs, "-map", "0:v", *amap, "-shortest",
             "-c:v", "libx264", "-preset", "medium", "-crf", "19",
             "-pix_fmt", "yuv420p", "-movflags", "+faststart",
             "-c:a", "aac", "-b:a", "192k", str(out)])

        print(f"\nเสร็จ: {out}  ({out.stat().st_size / 1024 / 1024:.1f} MB, "
              f"~{total:.1f}s, {w}x{h})")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
