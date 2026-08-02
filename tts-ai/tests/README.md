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
1. เปิด notebook ใน Colab (repo เป็น public เปิดผ่านลิงก์ `colab.research.google.com/github/...` ได้ตรง ๆ):
   - **รอบ 1:** [`colab_thai_tts_test.ipynb`](colab_thai_tts_test.ipynb) — edge-tts (เสียง Microsoft) + MMS (2 รุ่น) + F5-TTS-THAI V1
   - **รอบ 2:** [`colab_thai_tts_round2.ipynb`](colab_thai_tts_round2.ipynb) — OmniVoice-Thai + voice design + F5-TTS-TH V2 (IPA) + ThonburianTTS
   - **เฉพาะ OmniVoice-Thai:** [`colab_omni_thai_only.ipynb`](colab_omni_thai_only.ipynb) — ตัวเดียวจบใน ~8 นาที
   - **โคลนเสียงตัวเอง 🏆:** [`colab_omni_thai_myvoice.ipynb`](colab_omni_thai_myvoice.ipynb) — OmniVoice-Thai + เสียงจริงจาก `ref/` + แปลงตัวเลขอัตโนมัติ
2. Runtime → Change runtime type → **T4 GPU**
3. Runtime → Run all → เลื่อนลงล่างสุด มีปุ่ม ▶ กดฟังทุกเสียงเทียบกันทีละประโยค

> **ผลรอบ 1 (2 ส.ค. 2026):** ผู้ฟังตัดสินว่า **edge-tts อ่านถูกต้องแม่นยำที่สุด** / เสียง Achara โดน Microsoft ถอดแล้ว (เหลือ Premwadee, Niwat) / F5 V1 เสียเปรียบเพราะโคลนจากเสียงอ้างอิงสังเคราะห์สั้น ๆ — รอบ 2 จึงเพิ่ม V2 และ OmniVoice เข้าเทียบ

> **ผลทดสอบ OmniVoice-Thai (2 ส.ค. 2026): 🏆 ตัวที่เลือกใช้ต่อ** — อ่านถูกต้อง เว้นวรรคจังหวะดีมาก / จุดอ่อนเดียว: อ่านตัวเลข-เวลาแบบดิบไม่ได้ → **แก้แล้ว**ด้วย [`../normalize_th.py`](../normalize_th.py) (แปลงเลขเป็นคำอ่านก่อนส่งเข้าโมเดล) / ขั้นถัดไป: โคลนเสียงเจ้าของช่องด้วย notebook myvoice

## ส่งคลิปเสียงเพื่อโคลนเสียงตัวเอง

สเปคคลิปที่ดี: **ยาว 8–15 วินาที**, ห้องเงียบ (ไม่มีดนตรี/พัดลม/เสียงรถ), พูดโทน-จังหวะเดียวกับที่อยากให้ AI ใช้เล่าเรื่อง, จบประโยคพอดี — อัดจากมือถือเป็น .m4a ได้เลย

- **ทาง 1 (แนะนำ):** ส่งไฟล์เสียงให้ Claude ในแชท **พร้อมพิมพ์ข้อความที่พูดแบบคำต่อคำ** → Claude commit เป็น `tests/ref/my_voice.<ext>` + `tests/ref/my_voice.txt` → notebook myvoice จะสลับไปใช้เสียงจริงเองอัตโนมัติ ไม่ต้องแก้อะไร
- **ทาง 2:** อัปโหลดเองใน Colab — ลากไฟล์ชื่อ `my_voice.wav/mp3/m4a` เข้าแถบ Files 📁 แล้วกรอกตัวแปร `MY_VOICE_TEXT` ในเซลล์ 3

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

## ตัวที่ยังไม่อยู่ในชุดทดสอบ (คิวถัดไป)

ทดสอบได้เองบนเว็บ ไม่ต้องเขียนโค้ด (เอาประโยคจาก `sentences_th.json` ไปวาง):
- **OmniVoice บนเว็บ** — [HF Space ทางการของ k2-fsa](https://huggingface.co/spaces/k2-fsa/OmniVoice)
- **Gemini TTS** — [Google AI Studio](https://aistudio.google.com/) (ฟรี, รองรับไทย)
- **Botnoi Voice** — [voice.botnoi.ai](https://voice.botnoi.ai/) (เจ้าไทย มีเครดิตฟรี)
- **ElevenLabs v3** — ในบัญชีที่ใช้กับ pipeline อยู่แล้ว เลือกโมเดล v3 + วางข้อความไทย
- **Typhoon2-Audio** (SCB 10X) — ต้อง GPU ใหญ่กว่า T4 ฟรี ไว้ทดสอบเมื่อมีเครื่อง/เช่าคลาวด์
