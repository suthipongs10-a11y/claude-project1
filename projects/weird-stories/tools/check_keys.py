#!/usr/bin/env python3
"""ตรวจว่า key แต่ละตัวทำอะไรได้บ้าง แล้วบันทึกไว้ให้เครื่องมืออื่นเลือกใช้ให้ถูก

    python3 tools/check_keys.py

ทำไมต้องมี: key แต่ละตัวอยู่คนละโปรเจกต์ ความสามารถไม่เท่ากัน และที่สำคัญคือ
**free tier เรียก TTS ได้ฟรี แต่สร้างภาพไม่ได้** ส่วน paid tier ทำได้ทุกอย่างแต่เสียเงิน

ถ้าไม่รู้ว่าตัวไหนเป็นตัวไหน ระบบจะสุ่มหมุนไปเรื่อย ซึ่งแปลว่างานเสียงอาจไปตกที่ key
ที่เสียเงินทั้งที่มี key ฟรีว่างอยู่ ผลตรวจจากไฟล์นี้ทำให้ gemini_api เลือกได้ถูก:

    งานเสียง  -> ส่งไป key ฟรีก่อน (ประหยัดเครดิตของ key ที่เสียเงินไว้ทำภาพ)
    งานภาพ    -> ส่งไป key ที่เสียเงินเท่านั้น เพราะ free tier ทำไม่ได้อยู่แล้ว

การตรวจนี้แทบไม่มีค่าใช้จ่าย — ยิง text สั้นๆ กับ TTS คำเดียว
ส่วนความสามารถเรื่องภาพ อนุมานจากผลของ Batch API แทนการสร้างภาพจริง
(free tier ตอบ FAILED_PRECONDITION, paid tier ส่งงานเข้าคิวได้) แล้วยกเลิกงานทิ้งทันที
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gemini_api import BASE, KEYS  # noqa: E402

ROOT = BASE.rsplit("/models", 1)[0]
STORE = Path.home() / ".cache" / "weird-stories" / "keycaps.json"


def call(url, body=None, timeout=90):
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"},
        method="POST" if body is not None else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r), None
    except urllib.error.HTTPError as e:
        return None, e.read()[:300].decode(errors="replace")
    except Exception as e:
        return None, str(e)[:200]


def probe(key):
    out = {"text": False, "tts": False, "batch": False, "note": ""}

    ok, err = call(f"{BASE}/gemini-2.5-flash-lite:generateContent?key={key}",
                   {"contents": [{"parts": [{"text": "hi"}]}]})
    out["text"] = ok is not None
    if err and "prepayment credits are depleted" in err:
        out["note"] = "เครดิตหมด"
        return out
    if err and "API key not valid" in err:
        out["note"] = "key ไม่ถูกต้อง"
        return out

    ok, err = call(f"{BASE}/gemini-2.5-flash-preview-tts:generateContent?key={key}",
                   {"contents": [{"parts": [{"text": "ทดสอบ"}]}],
                    "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {
                        "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Charon"}}}}})
    out["tts"] = ok is not None

    # Batch ใช้ได้เฉพาะโปรเจกต์ที่เปิด billing แล้ว → ใช้เป็นตัวชี้ว่าเป็น paid tier หรือไม่
    ok, err = call(f"{BASE}/gemini-3.1-flash-image:batchGenerateContent?key={key}",
                   {"batch": {"display_name": "probe", "input_config": {"requests": {"requests": [
                       {"request": {"contents": [{"parts": [{"text": "grey wall"}]}],
                                    "generationConfig": {"responseModalities": ["IMAGE"]}},
                        "metadata": {"key": "p"}}]}}}})
    if ok is not None:
        out["batch"] = True
        call(f"{ROOT}/{ok['name']}:cancel?key={key}", {})   # ยกเลิกทิ้ง ไม่ให้เสียเงินจริง
    elif err and ("Precondition" in err or "FAILED_PRECONDITION" in err):
        out["note"] = "free tier"
    elif err and "prepayment credits" in err:
        out["note"] = "เครดิตหมด"
    return out


def main():
    rows, caps = [], {}
    for i, key in enumerate(KEYS, 1):
        r = probe(key)
        # ภาพกับ batch ต้องใช้ paid tier เหมือนกัน จึงใช้ผลเดียวกันได้
        r["image"] = r["batch"]
        r["paid"] = r["batch"]
        caps[key[-6:]] = r
        rows.append((i, key[-6:], r))

    def mark(b):
        return "✅" if b else "❌"

    print(f"{'#':<3}{'key':<10}{'text':<7}{'เสียง':<8}{'ภาพ':<7}{'batch':<8}หมายเหตุ")
    for i, tail, r in rows:
        print(f"{i:<3}...{tail:<7}{mark(r['text']):<6}{mark(r['tts']):<7}"
              f"{mark(r['image']):<6}{mark(r['batch']):<7}{r['note']}")

    STORE.parent.mkdir(parents=True, exist_ok=True)
    STORE.write_text(json.dumps(caps, ensure_ascii=False, indent=2))

    # ล้างรายชื่อ "key ตาย" ของตัวที่ตรวจแล้วพบว่ากลับมาใช้ได้
    # (เช่นเพิ่งเติมเครดิต) ไม่งั้น gemini_api จะข้ามมันต่อไปอีกถึง 6 ชั่วโมง
    health = STORE.parent / "keys.json"
    try:
        dead = json.loads(health.read_text())
    except Exception:
        dead = {}
    revived = [t for t in list(dead) if caps.get(t, {}).get("text") or caps.get(t, {}).get("paid")]
    if revived:
        for t in revived:
            dead.pop(t, None)
        health.write_text(json.dumps(dead))
        print(f"  ปลดสถานะ 'ใช้ไม่ได้' ให้ {', '.join('...' + t for t in revived)} แล้ว")

    free = [t for t, r in caps.items() if r["tts"] and not r["paid"]]
    paid = [t for t, r in caps.items() if r["paid"]]
    print(f"\nบันทึกไว้ที่ {STORE}")
    print(f"  key ฟรีที่ทำเสียงได้ : {', '.join('...' + t for t in free) or 'ไม่มี'}"
          f"  <- งานเสียงจะวิ่งไปทางนี้ก่อน")
    print(f"  key ที่ทำภาพได้      : {', '.join('...' + t for t in paid) or 'ไม่มี'}"
          f"  <- งานภาพเท่านั้นที่ใช้")
    if not paid:
        print("\n⚠️ ยังไม่มี key ไหนสร้างภาพได้ ต้องเติมเครดิตที่ https://ai.studio/projects")


if __name__ == "__main__":
    main()
