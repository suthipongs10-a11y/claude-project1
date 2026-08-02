#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""เรียกเซิร์ฟเวอร์เสียง RunPod จากที่ไหนก็ได้ (PC / Claude เซสชันอื่น / สคริปต์ pipeline)

ต้องมีแค่:  pip install requests

ใช้:
    # เช็คว่าเซิร์ฟเวอร์พร้อมไหม
    python client.py --server https://XXXX-8000.proxy.runpod.net --key รหัสลับ --health

    # ประโยคเดียว
    python client.py --server ... --key ... --text "สวัสดีครับ" --out hello.wav

    # ทั้งคลิป (ไฟล์งานรูปแบบเดียวกับ voice-jobs/)
    python client.py --server ... --key ... --job ../voice-jobs/example-job.json --outdir voice_out
"""

import argparse
import io
import json
import sys
import zipfile
from pathlib import Path

import requests


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", required=True, help="เช่น https://XXXX-8000.proxy.runpod.net")
    ap.add_argument("--key", default="", help="ค่า TTS_API_KEY ที่ตั้งไว้บน pod")
    ap.add_argument("--health", action="store_true")
    ap.add_argument("--text")
    ap.add_argument("--out", default="out.wav")
    ap.add_argument("--job", help="ไฟล์งาน .json ({job, segments:[{id,text}]})")
    ap.add_argument("--outdir", default="voice_out")
    args = ap.parse_args()

    base = args.server.rstrip("/")
    headers = {"x-api-key": args.key}

    if args.health:
        r = requests.get(f"{base}/health", headers=headers, timeout=60)
        print(r.status_code, json.dumps(r.json(), ensure_ascii=False, indent=2))
        return

    if args.text:
        r = requests.post(f"{base}/tts", json={"text": args.text}, headers=headers, timeout=600)
        r.raise_for_status()
        Path(args.out).write_bytes(r.content)
        print(f"บันทึก {args.out} ({r.headers.get('x-seconds', '?')} วิ)")
        return

    if args.job:
        payload = json.loads(Path(args.job).read_text(encoding="utf-8"))
        payload.pop("_comment", None)
        n = len(payload.get("segments", []))
        print(f"ส่งงาน '{payload.get('job')}' ({n} segments) ... รอสักครู่")
        r = requests.post(f"{base}/job", json=payload, headers=headers, timeout=3600)
        r.raise_for_status()
        outdir = Path(args.outdir)
        outdir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            zf.extractall(outdir)
        print(f"เสร็จ: เสียงรวม {r.headers.get('x-total-seconds', '?')} วิ -> {outdir}/")
        return

    ap.error("ต้องระบุ --health หรือ --text หรือ --job")
    sys.exit(1)


if __name__ == "__main__":
    main()
