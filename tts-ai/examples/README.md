# ตัวอย่างโค้ด — เรียงจากง่ายไปยาก

| ไฟล์ | ต้องมี | ได้อะไร |
|---|---|---|
| `edge_tts_demo.py` | เน็ต + `pip install edge-tts` | MP3 ไทย/อังกฤษใน 10 วินาที ฟรี ไม่ใช้ GPU |
| `mms_tts_demo.py` | `pip install transformers torch scipy` | โมเดลไทยเบา ๆ รันออฟไลน์บน CPU |
| `f5_tts_thai_demo.py` | `pip install f5-tts-th soundfile` + GPU/Colab | โคลนเสียงตัวเองพูดไทย (ตัวหลักที่แนะนำ) |
| `omnivoice_demo.py` | `pip install omnivoice soundfile` + GPU | ไทย+อังกฤษปนประโยคเดียว, ออกแบบเสียงจากคำบรรยาย |

ติดตั้ง dependency ดู `requirements.txt` (เลือกลงเฉพาะเดโมที่ใช้)

ลำดับที่แนะนำ: `edge_tts_demo.py` → `f5_tts_thai_demo.py` (อัดเสียงตัวเอง ~10 วิ ก่อน) → `omnivoice_demo.py`
