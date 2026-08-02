"""เดโมตัวหลัก — F5-TTS-THAI (โคลนเสียง zero-shot ภาษาไทย)

ติดตั้ง:  pip install f5-tts-th soundfile
          (Python 3.10+, แนะนำ GPU CUDA — ไม่มี GPU ใช้ Colab:
           https://colab.research.google.com/drive/10yb4-mGbSoyyfMyDX1xVF6uLqfeoCNxV)
WebUI:    f5-tts_webui
รัน:      แก้ REF_AUDIO/REF_TEXT ด้านล่างก่อน แล้ว python f5_tts_thai_demo.py

หลักการ: โมเดลจะ "เลียนเสียง" จากไฟล์อ้างอิง (ref_audio) — ใช้เสียงตัวเอง
อัดพูดชัด ๆ ~10 วินาที และ ref_text ต้องตรงกับที่พูดในไฟล์นั้นจริง ๆ

เคล็ดลับ: - โมเดล "v1" อ่านไทยเป็นธรรมชาติ / "v2" ใช้ IPA อ่านแม่น ลดการข้ามคำ
          - คำอังกฤษใน v1 ให้เขียนทับศัพท์ เช่น "AI" -> "เอไอ"
"""

import soundfile as sf
from f5_tts_th.tts import TTS

# --- แก้ 2 ค่านี้เป็นของตัวเอง -------------------------------------------
REF_AUDIO = "my_voice_10sec.wav"  # ไฟล์เสียงอ้างอิง (เสียงสะอาด ไม่มีดนตรี)
REF_TEXT = "ข้อความที่พูดในไฟล์เสียงอ้างอิง ต้องตรงกับเสียงจริงทุกคำ"
# -------------------------------------------------------------------------

GEN_TEXT = (
    "สวัสดีครับ นี่คือเสียงที่โคลนมาจากเสียงต้นแบบ "
    "สามารถพูดประโยคใหม่อะไรก็ได้ ด้วยน้ำเสียงเดียวกัน"
)

tts = TTS(model="v1")  # หรือ model="v2" (IPA)
wav = tts.infer(
    ref_audio=REF_AUDIO,
    ref_text=REF_TEXT,
    gen_text=GEN_TEXT,
    step=32,    # มาก = ช้าแต่เนียนขึ้น (ลอง 32-64)
    cfg=2.0,    # ความเกาะข้อความ
    speed=1.0,  # ความเร็วพูด
)
sf.write("out_f5_th.wav", wav, 24000)
print("บันทึก out_f5_th.wav แล้ว")
