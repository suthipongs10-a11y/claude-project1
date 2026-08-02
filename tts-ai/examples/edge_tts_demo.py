"""เดโม TTS ฟรี เร็วสุด — edge-tts (เสียง Microsoft Azure แบบไม่เป็นทางการ)

ติดตั้ง:  pip install edge-tts
รัน:      python edge_tts_demo.py
ผลลัพธ์:  out_th.mp3 (ไทย), out_en.mp3 (อังกฤษ)

ดูเสียงทั้งหมด:        edge-tts --list-voices
เฉพาะเสียงไทย:         edge-tts --list-voices | grep th-TH
  -> th-TH-PremwadeeNeural (หญิง), th-TH-NiwatNeural (ชาย), th-TH-AcharaNeural (หญิง)

เหมาะกับ: ทดลอง/งานส่วนตัว — งานโปรดักชันเชิงพาณิชย์ให้ใช้ Azure Speech ตัวจริง
"""

import asyncio

import edge_tts

TH_TEXT = "สวัสดีครับ นี่คือเสียงทดสอบภาษาไทย สร้างจากคอมพิวเตอร์ ฟรี ไม่ต้องใช้จีพียู"
EN_TEXT = "Hello! This is a free English text-to-speech demo, no GPU required."


async def main() -> None:
    # ไทย — ลองสลับเป็น th-TH-NiwatNeural (เสียงผู้ชาย) ได้
    await edge_tts.Communicate(TH_TEXT, "th-TH-PremwadeeNeural").save("out_th.mp3")
    print("บันทึก out_th.mp3 แล้ว")

    # อังกฤษ — เสียงยอดนิยม: en-US-AriaNeural, en-US-GuyNeural, en-GB-SoniaNeural
    await edge_tts.Communicate(EN_TEXT, "en-US-AriaNeural").save("out_en.mp3")
    print("บันทึก out_en.mp3 แล้ว")

    # ปรับความเร็ว/ระดับเสียงได้ เช่น rate="+10%", pitch="+2Hz"
    await edge_tts.Communicate(
        "อ่านเร็วขึ้นสิบเปอร์เซ็นต์แบบนี้ครับ", "th-TH-NiwatNeural", rate="+10%"
    ).save("out_th_fast.mp3")
    print("บันทึก out_th_fast.mp3 แล้ว")


if __name__ == "__main__":
    asyncio.run(main())
