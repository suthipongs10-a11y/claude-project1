"""ตัวกลางคุยกับ Gemini API — โหลด key, หมุน key, retry

key อ่านจาก env GOOGLE_TTS_API_KEY (ใส่ได้หลาย key คั่นด้วย comma)
ทุก key ใช้โควตาแยกกัน → หมุนอัตโนมัติเมื่อเจอ 429 (quota เต็ม)
"""
import json
import os
import time
import urllib.error
import urllib.request

BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def load_keys():
    raw = os.environ.get("GOOGLE_TTS_API_KEY", "")
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    if not keys:
        raise SystemExit("ไม่พบ GOOGLE_TTS_API_KEY ใน environment")
    return keys


KEYS = load_keys()
_cursor = 0


def generate(model, body, timeout=300, max_retries=4):
    """ยิง :generateContent แล้วคืน dict ของ response

    เจอ 429/503 → สลับไป key ถัดไปแล้วลองใหม่ (exponential backoff)
    """
    global _cursor
    last = None
    for attempt in range(max_retries):
        key = KEYS[_cursor % len(KEYS)]
        url = f"{BASE}/{model}:generateContent?key={key}"
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            detail = e.read()[:500].decode(errors="replace")
            last = f"HTTP {e.code}: {detail}"
            if e.code in (429, 500, 503):
                _cursor += 1  # key นี้ตัน — ไปตัวถัดไป
                time.sleep(2 ** attempt)
                continue
            raise SystemExit(f"[{model}] {last}")
        except (urllib.error.URLError, TimeoutError) as e:
            last = str(e)
            time.sleep(2 ** attempt)
    raise SystemExit(f"[{model}] ยิงไม่สำเร็จหลัง {max_retries} ครั้ง — {last}")


def inline_parts(resp):
    """ดึง parts ที่เป็น inlineData (เสียง/รูป) ออกมาเป็น list ของ (bytes, mimeType)"""
    out = []
    for cand in resp.get("candidates", []):
        for p in cand.get("content", {}).get("parts", []):
            if "inlineData" in p:
                import base64

                out.append(
                    (base64.b64decode(p["inlineData"]["data"]), p["inlineData"]["mimeType"])
                )
    return out
