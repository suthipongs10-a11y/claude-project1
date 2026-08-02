"""เดโม OmniVoice (k2-fsa) — TTS 600+ ภาษา รวมไทย/อังกฤษ, Apache-2.0

ติดตั้ง:  pip install omnivoice soundfile
          (แนะนำ GPU NVIDIA — รองรับ Apple Silicon MPS และ Intel XPU ด้วย)
เดโม UI:  omnivoice-demo --ip 0.0.0.0 --port 8001
CLI:      omnivoice-infer --model k2-fsa/OmniVoice --text "ทดสอบ" \
              --ref_audio ref.wav --ref_text "..." --output hello.wav
รัน:      แก้ REF_AUDIO/REF_TEXT แล้ว python omnivoice_demo.py

จุดเด่น: - ประโยคไทยปนอังกฤษได้ในตัวเดียว
         - voice design: สร้างเสียงใหม่จากคำบรรยาย ไม่ต้องมีไฟล์อ้างอิง
         - รุ่นไฟน์จูนไทยโดยเฉพาะ + REST API สำเร็จรูป:
           https://github.com/nanofatdog/omnivoice-thai-api
"""

import soundfile as sf
import torch
from omnivoice import OmniVoice

model = OmniVoice.from_pretrained(
    "k2-fsa/OmniVoice", device_map="cuda:0", dtype=torch.float16
)

# --- 1) โคลนเสียงจากไฟล์อ้างอิง (ไทย + อังกฤษปนกัน) ----------------------
REF_AUDIO = "my_voice_10sec.wav"
REF_TEXT = "ข้อความที่พูดในไฟล์เสียงอ้างอิง"

audio = model.generate(
    text="สวัสดีครับ วันนี้เรามาลอง Text to Speech ที่พูดได้ทั้งไทยและ English ในประโยคเดียว",
    ref_audio=REF_AUDIO,
    ref_text=REF_TEXT,
)
sf.write("out_omni_clone.wav", audio[0], 24000)
print("บันทึก out_omni_clone.wav แล้ว")

# --- 2) ออกแบบเสียงจากคำบรรยาย (ไม่ต้องมีไฟล์อ้างอิง) --------------------
audio = model.generate(
    text="Hello world, this voice was designed from a text description.",
    instruct="female, low pitch, calm narrator",
)
sf.write("out_omni_design.wav", audio[0], 24000)
print("บันทึก out_omni_design.wav แล้ว")
