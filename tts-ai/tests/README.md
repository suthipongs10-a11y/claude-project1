# ชุดทดสอบเสียง TTS ภาษาไทย — ฟังเทียบทีละตัว

ทุกเอนจินใช้**ประโยคชุดเดียวกัน 6 ประโยค** ([sentences_th.json](sentences_th.json)) เพื่อเทียบแฟร์ ๆ:

| # | ทดสอบอะไร | ฟังตรงไหน |
|---|---|---|
| 01_basic | ประโยคทักทายพื้นฐาน | ความชัด ความเป็นธรรมชาติโดยรวม |
| 02_story | เล่าเรื่องยาว (สไตล์ voiceover คลิปเรา) | จังหวะหายใจ การเว้นวรรค ความลื่น |
| 03_numbers_raw | ตัวเลข/เวลา/เงินแบบดิบ "18:30", "2,500,000" | เอนจินไหนอ่านเลขเองได้ / ตัวไหนต้อง normalize ก่อน |
| 04_english_mix | คำอังกฤษปนไทย "YouTube AI Shorts" | อ่านอังกฤษออกไหม หรืออ่านเพี้ยน |
| 05_english_thai_spelled | แบบเดียวกับ 04 แต่เขียนทับศัพท์ | เทียบ 04 vs 05 — เห็นผลของการทับศัพท์ชัดเจน |
| 06_emotion | อุทาน/คำถาม/ไม้ยมก "บ้ามาก ๆ" | อารมณ์ วรรณยุกต์ การอ่านไม้ยมก |

## วิธีรัน — เลือก 1 จาก 3 ทาง

### ทาง 1: Google Colab (แนะนำ — ฟรี มี GPU ได้ฟังใน 10 นาที) ⭐
1. อัปโหลด [`colab_thai_tts_test.ipynb`](colab_thai_tts_test.ipynb) ไปที่ [colab.research.google.com](https://colab.research.google.com/) (File → Upload notebook)
2. Runtime → Change runtime type → **T4 GPU**
3. Runtime → Run all → เลื่อนลงล่างสุด มีปุ่ม ▶ กดฟังทุกเสียงเทียบกันทีละประโยค
- ได้ครบ 3 เอนจิน: edge-tts (3 เสียง) + MMS (2 รุ่น) + F5-TTS-THAI = **~30 ไฟล์เสียง**

### ทาง 2: PC ของเรา (เครื่องที่มี CapCut)
```bash
pip install edge-tts                       # ขั้นต่ำสุด — ฟังได้ใน 1 นาที ไม่ใช้ GPU
python run_thai_tts_test.py --engines edge

# มี GPU NVIDIA? เพิ่มตัวหลักได้:
pip install f5-tts-th soundfile transformers torch scipy
python run_thai_tts_test.py                # รันครบทุกตัว
```
ไฟล์เสียงออกที่ `samples/` + สรุปเวลาใน `samples/report.md`

### ทาง 3: VPS (Hostinger KVM2)
ได้เฉพาะตัวที่ไม่ง้อ GPU สบาย ๆ: `edge` (เร็ว) + `mms` (เร็วพอใช้) — ส่วน `f5` รันได้แต่ช้ามากบน CPU 2 คอร์ (นาทีระดับหลายนาทีต่อประโยค) เหมาะทำ batch ข้ามคืน ไม่เหมาะนั่งลองฟัง

> หมายเหตุ sandbox ของ Claude Code (เซสชันนี้): network policy บล็อก huggingface.co และ speech.platform.bing.com → รันชุดทดสอบในนี้ไม่ได้ ถ้าอยากให้ Claude เจนเสียงส่งให้ฟังในแชทได้เลย ให้แก้ network policy ของ environment (claude.ai → Code → environment settings) อนุญาตโดเมน: `huggingface.co`, `cdn-lfs.huggingface.co`, `speech.platform.bing.com` แล้วเปิดเซสชันใหม่

## ตารางให้คะแนน (ฟังแล้วกรอกเอง 1–5)

| เอนจิน/เสียง | ชัด อ่านถูก | เป็นธรรมชาติ | จังหวะ/วรรณยุกต์ | อ่านเลข (03) | อังกฤษปน (04) | เหมาะกับคลิป |
|---|---|---|---|---|---|---|
| edge premwadee (หญิง) | | | | | | |
| edge niwat (ชาย) | | | | | | |
| edge achara (หญิง) | | | | | | |
| mms meta-tha | | | | | | |
| mms femalev2 | | | | | | |
| f5-tts-thai v1 | | | | | | |
| (รอบหน้า) omnivoice-thai | | | | | | |
| (รอบหน้า) thonburian | | | | | | |

เกณฑ์ตัดสิน: ตัวไหนได้ "เหมาะกับคลิป" ≥ 4 → เอาไปลองเจนสคริปต์จริง 1 คลิปเต็มใน phase ถัดไป

## ตัวที่ยังไม่อยู่ในชุดนี้ (คิวรอบสอง)

- **OmniVoice / omnivoice-thai** — โมเดล ~4.4GB เดี๋ยวทำ notebook แยกหลังฟังรอบแรกแล้วอยากไปต่อ
- **ThonburianTTS** — ต้องลงจาก GitHub repo (ไม่มี pip) + โมเดลห้ามใช้เชิงพาณิชย์ ไว้เทียบคุณภาพอย่างเดียว
- **Botnoi / ElevenLabs v3 ไทย** — มีค่าใช้จ่าย ไว้เทียบท้ายสุดกับตัวเปิดที่ชนะ
