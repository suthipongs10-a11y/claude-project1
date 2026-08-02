#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""เจนเสียงพากย์ประจำช่อง (OmniVoice-Thai + เสียงโคลน) — ใช้ได้จากทุกโปรเจกต์

ติดตั้ง (ครั้งเดียว):  pip install omnivoice soundfile pythainlp
ต้องมี: GPU NVIDIA แนะนำ (CPU ได้แต่ช้า) + ไฟล์เสียงอ้างอิงตาม voice_profile.json

ใช้:
    # ประโยคเดียว
    python generate_voice.py --text "สวัสดีครับ วันนี้มีเรื่องเล่า" --out hello.wav

    # ทั้งสคริปต์คลิป (ทีละ segment ตามไฟล์งาน)
    python generate_voice.py --segments ../projects/xxx/segments.json --outdir ../projects/xxx/voice

รูปแบบ segments.json:  [{"id": "s01_hook", "text": "..."}, {"id": "s02", "text": "..."}]
ผลลัพธ์:  <id>.wav ทุก segment + timing.json (id, file, seconds, chars, text)
          — เอา seconds ไปวางไทม์ไลน์ CapCut ต่อได้เลย
"""

import argparse
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from normalize_th import normalize_th  # noqa: E402


def load_profile():
    prof = json.loads((HERE / "voice_profile.json").read_text(encoding="utf-8"))
    ref_audio = HERE / prof["ref_audio"]
    ref_text_file = HERE / prof["ref_text_file"]
    if not ref_audio.exists() or not ref_text_file.exists():
        sys.exit(
            "ยังไม่มีเสียงอ้างอิงประจำช่อง!\n"
            f"  ต้องมี: {ref_audio}\n  และ:   {ref_text_file}\n"
            "ส่งคลิปเสียง 8-15 วิ + ข้อความที่พูด ให้ Claude commit เข้า repo ก่อน (ดู tests/README.md)"
        )
    prof["_ref_audio_path"] = str(ref_audio)
    prof["_ref_text"] = ref_text_file.read_text(encoding="utf-8").strip()
    return prof


def load_model(prof):
    import torch
    from omnivoice import OmniVoice

    dev = "cuda:0" if torch.cuda.is_available() else "cpu"
    dt = torch.float16 if torch.cuda.is_available() else torch.float32
    if dev == "cpu":
        print("คำเตือน: ไม่มี GPU — เจนได้แต่ช้ามาก เหมาะรันทิ้งไว้เป็น batch")
    try:
        model = OmniVoice.from_pretrained(prof["model_id"], device_map=dev, dtype=dt)
        print("โมเดล:", prof["model_id"])
    except Exception as e:
        print("โหลด", prof["model_id"], "ไม่ได้ ->", e, "\nใช้ตัวฐานแทน")
        model = OmniVoice.from_pretrained(prof["fallback_model_id"], device_map=dev, dtype=dt)
        print("โมเดล:", prof["fallback_model_id"])
    return model


def synth(model, prof, text: str):
    gen_text = normalize_th(text) if prof.get("normalize_numbers", True) else text
    audio = model.generate(text=gen_text, ref_audio=prof["_ref_audio_path"], ref_text=prof["_ref_text"])
    return audio[0], gen_text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", help="เจนประโยคเดียว")
    ap.add_argument("--out", default="out.wav", help="ไฟล์ผลลัพธ์ของ --text")
    ap.add_argument("--segments", help="ไฟล์ segments.json ของโปรเจกต์คลิป")
    ap.add_argument("--outdir", default="voice_out", help="โฟลเดอร์ผลลัพธ์ของ --segments")
    args = ap.parse_args()
    if not args.text and not args.segments:
        ap.error("ต้องระบุ --text หรือ --segments อย่างใดอย่างหนึ่ง")

    prof = load_profile()  # เช็คเสียงอ้างอิงก่อน — พังตรงนี้ได้ข้อความแนะนำ ไม่ต้องรอโหลดของหนัก
    import soundfile as sf

    model = load_model(prof)
    sr = prof.get("sample_rate", 24000)

    if args.text:
        wav, gen_text = synth(model, prof, args.text)
        sf.write(args.out, wav, sr)
        print(f"บันทึก {args.out} ({len(wav)/sr:.1f} วิ)\nข้อความที่ส่งเข้าโมเดล: {gen_text}")
        return

    segments = json.loads(Path(args.segments).read_text(encoding="utf-8"))
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    timing = []
    for seg in segments:
        sid, text = seg["id"], seg["text"]
        t0 = time.time()
        wav, gen_text = synth(model, prof, text)
        f = outdir / f"{sid}.wav"
        sf.write(f, wav, sr)
        secs = round(len(wav) / sr, 3)
        timing.append({"id": sid, "file": f.name, "seconds": secs,
                       "chars": len(text), "text": text, "gen_text": gen_text})
        print(f"เสร็จ: {sid} -> {secs:.1f} วิ (ใช้เวลาเจน {time.time()-t0:.1f} วิ)")
    (outdir / "timing.json").write_text(
        json.dumps(timing, ensure_ascii=False, indent=2), encoding="utf-8")
    total = sum(t["seconds"] for t in timing)
    print(f"\nครบ {len(timing)} segments รวมเสียงยาว {total:.1f} วิ -> {outdir}/timing.json")


if __name__ == "__main__":
    main()
