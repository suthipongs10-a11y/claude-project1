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
from pathlib import Path

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

# จำสถานะ key ข้ามการรัน — ไม่งั้นทุกครั้งที่รันคำสั่งใหม่จะเสียเวลายิงใส่ key ที่เครดิตหมดก่อนเสมอ
# เก็บแค่ 6 ตัวท้ายของ key พอให้แยกออกว่าเป็นตัวไหน ไม่เก็บ key เต็ม
_HEALTH = Path(os.environ.get("WS_CACHE_DIR", Path.home() / ".cache" / "weird-stories")) / "keys.json"
_RECHECK_AFTER = 6 * 3600   # ผ่านไป 6 ชั่วโมงลองใหม่ เผื่อเติมเครดิตแล้ว


def _load_dead():
    try:
        raw = json.loads(_HEALTH.read_text())
    except Exception:
        return set()
    now = time.time()
    return {k for k, ts in raw.items() if now - ts < _RECHECK_AFTER}


def _save_dead():
    try:
        _HEALTH.parent.mkdir(parents=True, exist_ok=True)
        _HEALTH.write_text(json.dumps({k[-6:]: time.time() for k in _dead}))
    except Exception:
        pass  # จำไม่ได้ก็ไม่เป็นไร แค่เสียเวลาลองใหม่รอบหน้า


_dead_tails = _load_dead()
_dead = {k for k in KEYS if k[-6:] in _dead_tails}   # key ที่ใช้ไม่ได้ (เครดิตหมด / key ผิด)

# ความสามารถของแต่ละ key จาก tools/check_keys.py — ใช้เลือก key ให้ตรงงาน
# หัวใจคือ free tier "ทำเสียงได้ฟรี แต่ทำภาพไม่ได้"
# ถ้าไม่แยก งานเสียงอาจไปตกที่ key ที่เสียเงิน ทั้งที่มี key ฟรีว่างอยู่
_CAPS = _HEALTH.parent / "keycaps.json"
try:
    _caps = json.loads(_CAPS.read_text())
except Exception:
    _caps = {}


def _cap(key, name):
    return _caps.get(key[-6:], {}).get(name)


def _order_for(need):
    """เรียงลำดับ key ที่จะลอง ตามชนิดงาน — ตัวที่เหมาะสุดมาก่อน"""
    alive = [k for k in KEYS if k not in _dead]
    if not _caps or need is None:
        return alive
    if need == "tts":
        # ฟรีก่อน แล้วค่อยเป็นตัวเสียเงิน (เก็บเครดิตไว้ทำภาพ)
        return (sorted(alive, key=lambda k: (bool(_cap(k, "paid")), not _cap(k, "tts"))))
    if need == "image":
        # free tier ทำภาพไม่ได้อยู่แล้ว ตัดทิ้งไปเลย ไม่ต้องเสียเวลายิง
        paid = [k for k in alive if _cap(k, "paid")]
        unknown = [k for k in alive if _cap(k, "paid") is None]
        return paid + unknown
    return alive


def need_of(model):
    """เดาชนิดงานจากชื่อโมเดล ผู้เรียกจะได้ไม่ต้องบอกเอง"""
    m = model.lower()
    if "tts" in m:
        return "tts"
    if "image" in m:
        return "image"
    return None

# ข้อความที่บอกว่า "key นี้จบแล้ว" ไม่ใช่แค่ยิงถี่เกินไป
# กรณีนี้รอไปก็ไม่หาย ต้องข้ามไป key อื่นทันที ไม่ให้เสียเวลา backoff เปล่าๆ
_FATAL = ("prepayment credits are depleted", "API key not valid",
          "billing account", "has been suspended")


def _is_fatal(detail):
    return any(m.lower() in detail.lower() for m in _FATAL)


def pick_key(need=None, skip=()):
    """คืน key ที่เหมาะกับงานชนิดนี้ที่สุดและยังใช้ได้อยู่

    need: "tts" | "image" | None — ดู _order_for ว่าจัดลำดับยังไง
    skip: key ที่ลองไปแล้วในรอบนี้
    """
    order = [k for k in _order_for(need) if k not in skip]
    if order:
        # หมุนภายในกลุ่มที่เหมาะกัน เพื่อกระจายโหลดและกันชน rate limit ตัวเดียว
        return order[_cursor % len(order)]
    if need == "image" and any(k not in _dead for k in KEYS):
        raise GeminiError(
            "ไม่มี key ไหนสร้างภาพได้ (free tier ทำภาพไม่ได้ ส่วนตัวที่เสียเงินเครดิตหมด)\n"
            "เติมเครดิตที่ https://ai.studio/projects แล้วรัน tools/check_keys.py ใหม่")
    raise GeminiError(
        "ทุก key ใช้ไม่ได้แล้ว (เครดิตหมด หรือ key ไม่ถูกต้อง)\n"
        "เติมเครดิตหรือเปลี่ยน key ที่ https://ai.studio/projects "
        "แล้วอัปเดต env GOOGLE_TTS_API_KEY")


def _rotate():
    global _cursor
    _cursor += 1


def mark_dead(key, why=""):
    _dead.add(key)
    _save_dead()
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
    last, need, tried = None, need_of(model), set()
    for attempt in range(max_retries):
        key = pick_key(need, skip=tried)
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
                tried.add(key)
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
