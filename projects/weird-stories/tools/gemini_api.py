"""ตัวกลางคุยกับ Gemini API — โหลด key, หมุน key, retry

key อ่านจาก env GOOGLE_TTS_API_KEY (ใส่ได้หลาย key คั่นด้วย comma)
ทุก key ใช้โควตาแยกกัน → หมุนอัตโนมัติเมื่อเจอ 429 (quota เต็ม)
"""
import http.client
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiError(RuntimeError):
    """ยิง API ไม่สำเร็จ — ผู้เรียกตัดสินใจเองว่าจะข้ามชิ้นนี้ หรือหยุดทั้งงาน"""


def load_keys():
    raw = os.environ.get("GOOGLE_TTS_API_KEY", "")
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    if not keys:
        raise SystemExit("ไม่พบ GOOGLE_TTS_API_KEY ใน environment")
    return keys


KEYS = load_keys()
_cursor = 0
_dead = set()   # key ที่ใช้ไม่ได้ถาวรในเซสชันนี้ (เครดิตหมด / key ผิด) — ข้ามไปเลย

# ข้อความที่บอกว่า "key นี้จบแล้ว" ไม่ใช่แค่ยิงถี่เกินไป
# กรณีนี้รอไปก็ไม่หาย ต้องข้ามไป key อื่นทันที ไม่ให้เสียเวลา backoff เปล่าๆ
_FATAL = ("prepayment credits are depleted", "API key not valid",
          "billing account", "has been suspended")


def _is_fatal(detail):
    return any(m.lower() in detail.lower() for m in _FATAL)


def pick_key():
    """คืน key ตัวถัดไปที่ยังไม่ตาย"""
    for _ in range(len(KEYS)):
        key = KEYS[_cursor % len(KEYS)]
        if key not in _dead:
            return key
        _rotate()
    raise GeminiError(
        "ทุก key ใช้ไม่ได้แล้ว (เครดิตหมด หรือ key ไม่ถูกต้อง)\n"
        "เติมเครดิตหรือเปลี่ยน key ที่ https://ai.studio/projects "
        "แล้วอัปเดต env GOOGLE_TTS_API_KEY")


def _rotate():
    global _cursor
    _cursor += 1


def mark_dead(key, why=""):
    _dead.add(key)
    alive = len(KEYS) - len(_dead)
    print(f"  [key ...{key[-6:]}] ใช้ไม่ได้แล้ว: {why[:90]} (เหลือใช้ได้ {alive}/{len(KEYS)})",
          file=sys.stderr)
    _rotate()


def generate(model, body, timeout=300, max_retries=7):
    """ยิง :generateContent แล้วคืน dict ของ response

    เจอ 429/503 → สลับไป key ถัดไปแล้วลองใหม่

    หมายเหตุเรื่อง 429 มีสองแบบที่ต้องแยกกัน:
      1. spend-based rate limit — ผูกกับบัญชี ไม่ใช่ผูกกับ key สลับ key ไม่ช่วย
         ต้องรอให้อัตราการใช้ลดลง (รอ 20s, 40s, 60s, ...)
      2. เครดิตหมด / key ผิด — รอไปก็ไม่หาย ต้องข้าม key นั้นไปเลยทันที
    """
    last = None
    for attempt in range(max_retries):
        key = pick_key()
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
            if _is_fatal(detail):
                mark_dead(key, detail)
                continue  # ไป key ถัดไปทันที ไม่ต้องรอ
            if e.code in (429, 500, 503):
                _rotate()  # key นี้ตันชั่วคราว — ไปตัวถัดไป
                time.sleep(min(20 * (attempt + 1), 90) if e.code == 429 else 2 ** attempt)
                continue
            raise GeminiError(f"[{model}] {last}")
        except (urllib.error.URLError, http.client.HTTPException, OSError) as e:
            # ครอบคลุม RemoteDisconnected / ConnectionReset / timeout ที่เจอบ่อย
            # เวลาขอรูปหลายสิบใบติดกัน — เจอแล้วรอแล้วลองใหม่ ไม่ใช่ล้มทั้งงาน
            last = f"{type(e).__name__}: {e}"
            time.sleep(2 ** attempt)
    raise GeminiError(f"[{model}] ยิงไม่สำเร็จหลัง {max_retries} ครั้ง — {last}")


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
