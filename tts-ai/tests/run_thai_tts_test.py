#!/usr/bin/env python3
"""ทดสอบ TTS ภาษาไทยทุกเอนจินที่มีในเครื่อง — เจนไฟล์เสียง + รายงานเวลา

ใช้งาน:
    python run_thai_tts_test.py                    # รันทุกเอนจินที่ติดตั้งไว้
    python run_thai_tts_test.py --engines edge,mms # เลือกเฉพาะบางตัว
    python run_thai_tts_test.py --engines f5 --ref-audio my10s.wav --ref-text "ข้อความในไฟล์"

เอนจิน:
    edge  = edge-tts (ฟรี, ต้องต่อเน็ต, ไม่ใช้ GPU)      pip install edge-tts
    mms   = Meta MMS + รุ่นปรับเสียงหญิง (CPU ได้)        pip install transformers torch scipy
    f5    = F5-TTS-THAI v1 (โคลนเสียง, แนะนำ GPU)        pip install f5-tts-th soundfile

ผลลัพธ์: samples/<engine>_<voice>_<sentence>.mp3|wav + samples/report.md
เอนจินที่ไม่ได้ติดตั้ง/ใช้ไม่ได้ จะถูกข้ามพร้อมแจ้งเหตุผล — ไม่ล้มทั้งสคริปต์
"""

import argparse
import json
import time
import traceback
from pathlib import Path

HERE = Path(__file__).parent
SENTENCES = json.loads((HERE / "sentences_th.json").read_text(encoding="utf-8"))

results = []  # dict: engine, voice, sentence, file, seconds, error


def log_ok(engine, voice, sid, path, secs):
    results.append({"engine": engine, "voice": voice, "sentence": sid,
                    "file": str(path), "seconds": round(secs, 2), "error": None})
    print(f"  [OK] {engine}/{voice}/{sid}  {secs:.1f}s -> {path.name}")


def log_fail(engine, err):
    results.append({"engine": engine, "voice": "-", "sentence": "-",
                    "file": None, "seconds": None, "error": str(err)[:300]})
    print(f"  [SKIP] {engine}: {err}")


def run_edge(outdir: Path):
    import asyncio

    import edge_tts

    voices = ["th-TH-PremwadeeNeural", "th-TH-NiwatNeural", "th-TH-AcharaNeural"]

    async def gen():
        for v in voices:
            short = v.replace("th-TH-", "").replace("Neural", "").lower()
            for sid, text in SENTENCES.items():
                p = outdir / f"edge_{short}_{sid}.mp3"
                t0 = time.time()
                await edge_tts.Communicate(text, v).save(str(p))
                log_ok("edge-tts", short, sid, p, time.time() - t0)

    asyncio.run(gen())


def run_mms(outdir: Path):
    import scipy.io.wavfile
    import torch
    from transformers import AutoTokenizer, VitsModel

    models = {
        "meta-tha": "facebook/mms-tts-tha",
        "femalev2": "VIZINTZOR/MMS-TTS-THAI-FEMALEV2",
    }
    for short, mid in models.items():
        try:
            model = VitsModel.from_pretrained(mid)
            tok = AutoTokenizer.from_pretrained(mid)
        except Exception as e:  # โมเดลใดโมเดลหนึ่งโหลดไม่ได้ ไม่ต้องล้มทั้งคู่
            log_fail(f"mms/{short}", e)
            continue
        for sid, text in SENTENCES.items():
            p = outdir / f"mms_{short}_{sid}.wav"
            t0 = time.time()
            inputs = tok(text, return_tensors="pt")
            with torch.no_grad():
                wav = model(**inputs).waveform
            scipy.io.wavfile.write(p, rate=model.config.sampling_rate,
                                   data=wav.squeeze().numpy())
            log_ok("mms", short, sid, p, time.time() - t0)


def run_f5(outdir: Path, ref_audio: str, ref_text: str):
    import soundfile as sf
    from f5_tts_th.tts import TTS

    if not ref_audio:
        # ใช้เสียง edge-tts ประโยคแรกเป็นเสียงอ้างอิงอัตโนมัติ (ต้องรัน edge ก่อน)
        cand = outdir / "edge_premwadee_01_basic.mp3"
        if cand.exists():
            ref_audio, ref_text = str(cand), SENTENCES["01_basic"]
            print(f"  ใช้เสียงอ้างอิงอัตโนมัติ: {cand.name}")
        else:
            raise RuntimeError("ต้องระบุ --ref-audio และ --ref-text (หรือรัน engine edge ก่อน)")

    tts = TTS(model="v1")
    for sid, text in SENTENCES.items():
        p = outdir / f"f5thai_v1_{sid}.wav"
        t0 = time.time()
        wav = tts.infer(ref_audio=ref_audio, ref_text=ref_text, gen_text=text,
                        step=32, cfg=2.0, speed=1.0)
        sf.write(p, wav, 24000)
        log_ok("f5-tts-thai", "v1-clone", sid, p, time.time() - t0)


def write_report(outdir: Path):
    lines = ["# ผลทดสอบ TTS ภาษาไทย", "",
             f"ประโยคทดสอบ: {len(SENTENCES)} ประโยค (ดู sentences_th.json)", "",
             "| เอนจิน | เสียง | ประโยค | เวลา (วิ) | ไฟล์/ข้อผิดพลาด |",
             "|---|---|---|---|---|"]
    for r in results:
        cell = Path(r["file"]).name if r["file"] else (r["error"] or "-")
        secs = r["seconds"] if r["seconds"] is not None else "-"
        lines.append(f"| {r['engine']} | {r['voice']} | {r['sentence']} | {secs} | {cell} |")
    ok = [r for r in results if not r["error"]]
    lines += ["", f"สำเร็จ {len(ok)}/{len(results)} รายการ",
              "", "ฟังแล้วให้คะแนนใน scorecard ที่ README.md ของโฟลเดอร์นี้"]
    (outdir / "report.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"\nรายงาน: {outdir/'report.md'}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engines", default="edge,mms,f5",
                    help="คั่นด้วยจุลภาค: edge,mms,f5")
    ap.add_argument("--out", default=str(HERE / "samples"))
    ap.add_argument("--ref-audio", default="", help="ไฟล์เสียงอ้างอิงสำหรับ f5 (10-30 วิ)")
    ap.add_argument("--ref-text", default="", help="ข้อความที่พูดในไฟล์อ้างอิง")
    args = ap.parse_args()

    outdir = Path(args.out)
    outdir.mkdir(parents=True, exist_ok=True)
    wanted = [e.strip() for e in args.engines.split(",") if e.strip()]

    runners = {
        "edge": lambda: run_edge(outdir),
        "mms": lambda: run_mms(outdir),
        "f5": lambda: run_f5(outdir, args.ref_audio, args.ref_text),
    }
    for name in wanted:
        if name not in runners:
            log_fail(name, "ไม่รู้จักเอนจินนี้")
            continue
        print(f"\n=== {name} ===")
        try:
            runners[name]()
        except ImportError as e:
            log_fail(name, f"ยังไม่ได้ติดตั้ง: {e}")
        except Exception as e:
            traceback.print_exc()
            log_fail(name, e)

    write_report(outdir)


if __name__ == "__main__":
    main()
