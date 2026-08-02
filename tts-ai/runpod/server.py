#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""เซิร์ฟเวอร์เสียงประจำช่องบน RunPod (OmniVoice-Thai + เสียงโคลน + normalize ตัวเลข)

รันโดย setup_runpod.sh — หรือเอง:
    TTS_API_KEY=รหัสลับ python -m uvicorn server:app --host 0.0.0.0 --port 8000

Endpoints (POST ใช้ header  x-api-key: <TTS_API_KEY> / GET ใช้ ?key=<TTS_API_KEY>):
    GET  /health            สถานะ + โมเดล + เวอร์ชันเสียง
    GET  /say?key=..&text=..  เจนเสียงแล้วเล่นในเบราว์เซอร์ได้เลย (สะดวกสุดบนมือถือ)
    GET  /listen?key=..       ฟังเสียงล่าสุดที่เจนไปซ้ำ
    POST /tts   {"text": "..."}                     -> ไฟล์ wav (header x-seconds = ความยาว)
    POST /job   {"job": "ชื่อ", "segments": [...]}  -> ไฟล์ zip (wav ทุก segment + timing.json)
"""

import io
import json
import os
import subprocess
import sys
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse, Response

os.environ.setdefault("HF_HOME", "/workspace/hf_cache")  # เก็บโมเดลบน volume ใหญ่ กัน container disk เต็ม

HERE = Path(__file__).parent          # tts-ai/runpod
TTS_DIR = HERE.parent                 # tts-ai
sys.path.insert(0, str(TTS_DIR))
from normalize_th import normalize_th  # noqa: E402

PROFILE = json.loads((TTS_DIR / "voice_profile.json").read_text(encoding="utf-8"))
API_KEY = os.environ.get("TTS_API_KEY", "")
SR = PROFILE.get("sample_rate", 24000)
state = {}


def prepare_ref():
    """เสียงอ้างอิง: ใช้เสียงจริงใน repo ถ้ามี — ไม่มีก็ใช้เปรมวดีชั่วคราว"""
    ra = TTS_DIR / PROFILE["ref_audio"]
    rt = TTS_DIR / PROFILE["ref_text_file"]
    if ra.exists() and rt.exists():
        raw, ref_text = str(ra), rt.read_text(encoding="utf-8").strip()
        src = f"เสียงจริง ({PROFILE['voice_version']})"
    else:
        # เรียกผ่าน CLI แทน python API — โค้ดนี้รันใน lifespan ที่มี event loop อยู่แล้ว ใช้ asyncio.run ไม่ได้
        ref_text = "สวัสดีครับ ยินดีต้อนรับเข้าสู่ช่องของเรา วันนี้มีเรื่องราวน่าสนใจมาเล่าให้ฟังกันครับ"
        subprocess.run(
            ["edge-tts", "--voice", "th-TH-PremwadeeNeural", "--text", ref_text,
             "--write-media", "/tmp/ref_tmp.mp3"],
            check=True,
        )
        raw, src = "/tmp/ref_tmp.mp3", "เปรมวดีชั่วคราว (ยังไม่มีเสียงจริงใน repo)"
    out = "/tmp/ref_24k.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-ar", str(SR), "-ac", "1", out], check=True)
    return out, ref_text, src


@asynccontextmanager
async def lifespan(app):
    import torch
    from omnivoice import OmniVoice

    ref_audio, ref_text, ref_src = prepare_ref()
    dev = "cuda:0" if torch.cuda.is_available() else "cpu"
    dt = torch.float16 if torch.cuda.is_available() else torch.float32
    print(f"โหลดโมเดล ({dev}) ... ครั้งแรกใช้เวลา 2-5 นาที", flush=True)
    try:
        mid = PROFILE["model_id"]
        model = OmniVoice.from_pretrained(mid, device_map=dev, dtype=dt)
    except Exception as e:
        print("โหลด", PROFILE["model_id"], "ไม่ได้ ->", e, "-> ใช้ตัวฐาน")
        mid = PROFILE["fallback_model_id"]
        model = OmniVoice.from_pretrained(mid, device_map=dev, dtype=dt)
    state.update(model=model, model_id=mid, ref_audio=ref_audio, ref_text=ref_text, ref_src=ref_src)
    print(f"✅ พร้อมรับงาน | โมเดล: {mid} | เสียงอ้างอิง: {ref_src}", flush=True)
    yield


app = FastAPI(title="เซิร์ฟเวอร์เสียงประจำช่อง", lifespan=lifespan)


def check_key(x_api_key: str):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="x-api-key ไม่ถูกต้อง")


def synth(text: str):
    import numpy as np
    import soundfile as sf

    gen = normalize_th(text) if PROFILE.get("normalize_numbers", True) else text
    audio = state["model"].generate(text=gen, ref_audio=state["ref_audio"], ref_text=state["ref_text"])
    wav = audio[0]
    if hasattr(wav, "detach"):  # เป็น torch tensor (อาจอยู่บน GPU) -> แปลงเป็น numpy ก่อนเขียนไฟล์
        wav = wav.detach().float().cpu().numpy()
    wav = np.asarray(wav).squeeze()
    buf = io.BytesIO()
    sf.write(buf, wav, SR, format="WAV")
    data = buf.getvalue()
    state["last_wav"] = data
    return data, round(len(wav) / SR, 3), gen


def try_synth(text: str):
    """เรียก synth พร้อมแปลง error เป็นข้อความอ่านรู้เรื่อง (แทน Internal Server Error เปล่า ๆ)"""
    try:
        return synth(text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เจนเสียงล้มเหลว: {type(e).__name__}: {e}")


@app.get("/health")
def health(x_api_key: str = Header(default="")):
    check_key(x_api_key)
    return {
        "ok": True,
        "model": state.get("model_id"),
        "voice_version": PROFILE["voice_version"],
        "ref": state.get("ref_src"),
        "normalize_numbers": PROFILE.get("normalize_numbers", True),
    }


@app.get("/say")
def say(key: str = "", text: str = ""):
    """เปิดจากเบราว์เซอร์ได้เลย: /say?key=รหัส&text=ข้อความไทย -> เล่นเสียงทันที"""
    check_key(key)
    if not text.strip():
        raise HTTPException(status_code=400, detail="ใส่ ?text=ข้อความที่จะให้พูด")
    wav, secs, gen = try_synth(text.strip())
    return Response(content=wav, media_type="audio/wav", headers={"x-seconds": str(secs)})


@app.get("/listen")
def listen(key: str = ""):
    check_key(key)
    if not state.get("last_wav"):
        raise HTTPException(status_code=404, detail="ยังไม่มีเสียงล่าสุด — เรียก /say หรือ /tts ก่อน")
    return Response(content=state["last_wav"], media_type="audio/wav")


@app.post("/tts")
def tts(payload: dict, x_api_key: str = Header(default="")):
    check_key(x_api_key)
    text = (payload or {}).get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail='ต้องส่ง {"text": "..."}')
    wav, secs, gen = try_synth(text)
    return Response(content=wav, media_type="audio/wav",
                    headers={"x-seconds": str(secs), "x-gen-text": gen.encode().hex()})


@app.post("/job")
def job(payload: dict, x_api_key: str = Header(default="")):
    check_key(x_api_key)
    segments = (payload or {}).get("segments") or []
    name = (payload or {}).get("job", "job")
    if not segments:
        raise HTTPException(status_code=400, detail='ต้องส่ง {"job": "...", "segments": [{"id","text"}]}')
    timing = []
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w", zipfile.ZIP_DEFLATED) as zf:
        for seg in segments:
            sid, text = seg["id"], seg["text"]
            try:
                wav, secs, gen = synth(text)
            except Exception as e:  # segment ไหนพังให้จดไว้ใน timing แล้วทำตัวถัดไปต่อ
                timing.append({"id": sid, "error": f"{type(e).__name__}: {e}", "text": text})
                continue
            zf.writestr(f"{name}/{sid}.wav", wav)
            timing.append({"id": sid, "file": f"{sid}.wav", "seconds": secs,
                           "chars": len(text), "text": text, "gen_text": gen})
        zf.writestr(f"{name}/timing.json", json.dumps(timing, ensure_ascii=False, indent=2))
    total = round(sum(t["seconds"] for t in timing), 1)
    return Response(content=zbuf.getvalue(), media_type="application/zip",
                    headers={"x-total-seconds": str(total),
                             "content-disposition": f'attachment; filename="{name}.zip"'})
