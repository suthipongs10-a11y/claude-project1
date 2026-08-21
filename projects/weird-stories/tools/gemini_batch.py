"""เรียก Gemini ผ่าน Batch API — ราคาครึ่งเดียวของการเรียกปกติ

แลกมาด้วยการรอ: งานถูกคิวไว้แล้วทยอยประมวลผล (ทดสอบจริงกับ 2 ภาพใช้เวลา ~3 นาที,
30 ภาพ ~10-15 นาที) Google การันตีแค่ว่าเสร็จภายใน 24 ชั่วโมง

คุ้มกับงานเรา เพราะภาพและเสียงทั้งคลิปถูกสร้างจนครบก่อนเริ่มเรนเดอร์อยู่แล้ว
ไม่มีขั้นตอนไหนต้องรอผลทีละใบแบบโต้ตอบ

โมเดลที่รองรับ batch (เช็คด้วย :listModels ดู supportedGenerationMethods):
    ภาพ  gemini-3.1-flash-image, gemini-3-pro-image, gemini-2.5-flash-image
    เสียง gemini-3.1-flash-tts-preview, gemini-2.5-pro-preview-tts
    (gemini-2.5-flash-preview-tts ไม่รองรับ batch)
"""
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gemini_api import BASE, GeminiError, mark_dead, pick_key  # noqa: E402

# BASE ของ gemini_api ชี้ไปที่ .../v1beta/models อยู่แล้ว
# ส่วน endpoint ของ batch ต้องใช้ทั้ง .../v1beta/models/<model>:batchGenerateContent
# และ .../v1beta/batches/<id> จึงต้องมี root ที่ไม่มี /models ต่อท้ายด้วย
ROOT = BASE.rsplit("/models", 1)[0]

POLL_FIRST = 20     # รอครั้งแรกนานหน่อย งานเพิ่งเข้าคิว
POLL_EVERY = 15
POLL_MAX = 3600     # ยอมรอสูงสุด 1 ชั่วโมง เกินกว่านั้นถือว่ามีอะไรผิดปกติ


def _call(url_for, body=None, method="GET", timeout=120, retries=4):
    """ยิงคำสั่ง batch โดยหมุน key เหมือน gemini_api.generate

    url_for รับ key แล้วคืน URL — เพราะ key ฝังอยู่ใน query string
    ถ้า key ตาย (เครดิตหมด) จะข้ามไปตัวถัดไปทันที
    """
    last = None
    for attempt in range(retries):
        key = pick_key()
        try:
            return _raw(url_for(key), body, method, timeout)
        except GeminiError as e:
            last = str(e)
            if any(m in last.lower() for m in ("prepayment credits", "api key not valid")):
                mark_dead(key, last)
                continue
            if "Precondition check failed" in last or "FAILED_PRECONDITION" in last:
                raise GeminiError(
                    "บัญชีนี้ใช้ Batch API ไม่ได้ (Precondition check failed)\n"
                    "Batch API ต้องใช้โปรเจกต์ที่เปิด billing แบบเสียเงินแล้วเท่านั้น "
                    "ใช้กับ free tier ไม่ได้\n"
                    "ทางแก้: เปิด billing ที่ https://ai.studio/projects "
                    "หรือรันด้วย --now เพื่อเรียกทีละใบ (เต็มราคา)")
            if "HTTP 429" in last or "HTTP 503" in last:
                time.sleep(min(20 * (attempt + 1), 90))
                continue
            raise
    raise GeminiError(f"batch: ยิงไม่สำเร็จหลัง {retries} ครั้ง — {last}")


def _raw(url, body=None, method="GET", timeout=120):
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise GeminiError(f"HTTP {e.code}: {e.read()[:400].decode(errors='replace')}")


def run(model, requests, display_name="weird-stories", on_progress=None):
    """ส่งงานเป็นชุดแล้วรอจนเสร็จ

    requests: list ของ (key, generateContent_body)
    คืน dict {key: response_dict} — key ที่ล้มเหลวจะไม่อยู่ในผลลัพธ์
    """
    if not requests:
        return {}
    inlined = [{"request": body, "metadata": {"key": k}} for k, body in requests]
    op = _call(
        lambda k: f"{BASE}/{model}:batchGenerateContent?key={k}",
        {"batch": {"display_name": display_name,
                   "input_config": {"requests": {"requests": inlined}}}},
        "POST",
    )
    name = op["name"]
    if on_progress:
        on_progress(f"ส่งเข้าคิวแล้ว {len(requests)} งาน ({name.split('/')[-1]})")

    waited = 0
    time.sleep(POLL_FIRST)
    waited += POLL_FIRST
    while True:
        st = _call(lambda k: f"{ROOT}/{name}?key={k}")
        if st.get("done"):
            break
        state = st.get("metadata", {}).get("state", "?")
        if on_progress:
            on_progress(f"รออยู่... {state} ({waited}s)")
        if waited >= POLL_MAX:
            raise GeminiError(f"batch ไม่เสร็จภายใน {POLL_MAX}s — {name}")
        time.sleep(POLL_EVERY)
        waited += POLL_EVERY

    if "error" in st:
        raise GeminiError(f"batch ล้มเหลวทั้งชุด: {str(st['error'])[:300]}")

    holder = st.get("response", {}).get("inlinedResponses", {})
    items = holder.get("inlinedResponses", holder) if isinstance(holder, dict) else holder
    out = {}
    for item in items or []:
        key = item.get("metadata", {}).get("key")
        if "response" in item:
            out[key] = item["response"]
        elif on_progress:
            on_progress(f"งาน {key} ล้มเหลว: {str(item.get('error'))[:160]}")
    return out


def cancel(batch_name):
    """ยกเลิกงานที่ยังค้างคิว (ใช้ตอนกด Ctrl-C แล้วไม่อยากให้ระบบเดินต่อ)"""
    _call(lambda k: f"{ROOT}/{batch_name}:cancel?key={k}", {}, "POST")
