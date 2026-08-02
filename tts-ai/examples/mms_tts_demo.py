"""เดโมโมเดลไทยตัวเบา — Meta MMS-TTS (facebook/mms-tts-tha)

ติดตั้ง:  pip install transformers torch scipy
รัน:      python mms_tts_demo.py        (รันบน CPU ได้ โหลดโมเดลครั้งแรก ~150MB)
ผลลัพธ์:  out_mms_th.wav

ข้อดี:   เบามาก ออฟไลน์ได้ ไม่ต้องมีเสียงอ้างอิง
ข้อจำกัด: เสียงเดียว โทนราบกว่าสาย F5 / ไลเซนส์ CC BY-NC (ห้ามเชิงพาณิชย์)
"""

import scipy.io.wavfile
import torch
from transformers import AutoTokenizer, VitsModel

MODEL_ID = "facebook/mms-tts-tha"  # ลองเสียงปรับปรุง: "VIZINTZOR/MMS-TTS-THAI-FEMALEV2"

text = "สวัสดีครับ นี่คือเสียงจากโมเดลเอ็มเอ็มเอสของเมต้า รันบนซีพียูได้สบาย"

model = VitsModel.from_pretrained(MODEL_ID)
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)

inputs = tokenizer(text, return_tensors="pt")
with torch.no_grad():
    waveform = model(**inputs).waveform

scipy.io.wavfile.write(
    "out_mms_th.wav",
    rate=model.config.sampling_rate,
    data=waveform.squeeze().numpy(),
)
print("บันทึก out_mms_th.wav แล้ว")
