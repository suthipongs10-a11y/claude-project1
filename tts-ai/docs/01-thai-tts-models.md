# 01 — โมเดล TTS ภาษาไทย (โอเพนซอร์ส / รันเอง)

รวมทุกตัวที่รองรับภาษาไทย เรียงตามความน่าใช้ ณ ส.ค. 2026

## 🥇 F5-TTS-THAI — ตัวหลักที่แนะนำ

- **GitHub:** [VYNCX/F5-TTS-THAI](https://github.com/VYNCX/F5-TTS-THAI) (~156⭐, อัปเดตต่อเนื่อง)
- **โมเดล:** [VIZINTZOR/F5-TTS-THAI](https://huggingface.co/VIZINTZOR/F5-TTS-THAI) (V1) และ [VIZINTZOR/F5-TTS-TH-V2](https://huggingface.co/VIZINTZOR/F5-TTS-TH-V2) (V2 ใช้ phoneme/IPA ลดการอ่านผิด-ข้ามคำ)
- **เทคนิค:** Flow Matching (สถาปัตยกรรม [F5-TTS](https://github.com/SWivid/F5-TTS)) — zero-shot voice cloning จากเสียงอ้างอิงสั้น ๆ
- **ติดตั้ง:** `pip install f5-tts-th` (Python 3.10+, แนะนำ CUDA 11.8)
- **ใช้งาน:** WebUI: `f5-tts_webui` · โค้ด Python: ดู `../examples/f5_tts_thai_demo.py`
- **ไฟน์จูน:** มี Gradio UI (`f5-tts_finetune-gradio`) + [Colab เทรน](https://colab.research.google.com/drive/1jwzw4Jn1qF8-F0o3TND68hLHdIqqgYEe?usp=sharing)
- **ลองเลย:** [HF Space](https://huggingface.co/spaces/pythonlearnreal/F5-TTS-THAI) · [Colab รัน](https://colab.research.google.com/drive/10yb4-mGbSoyyfMyDX1xVF6uLqfeoCNxV?usp=sharing)
- **เคล็ดลับ:** คำอังกฤษใน V1 ให้เขียนทับศัพท์ไทย เช่น "Good Morning" → "กู้ดมอร์นิ่ง" / V2 อ่านแม่นกว่าผ่าน IPA
- **ไลเซนส์:** โค้ด MIT — weights ต่อยอดจาก F5-TTS base (เทรนบน Emilia = CC BY-NC) → ใช้เชิงพาณิชย์ให้เช็ค model card ก่อน

## 🥈 OmniVoice — หลายภาษา (รวมไทย) ไลเซนส์เปิดสุด

- **GitHub:** [k2-fsa/OmniVoice](https://github.com/k2-fsa/OmniVoice) — จากทีม k2-fsa (ผู้สร้าง Kaldi), ออก มี.ค. 2026
- **จุดเด่น:** 600+ ภาษา (รวมไทย/อังกฤษ — ผสมในประโยคเดียวได้ดีกว่าโมเดลไทยเพียว), โคลนเสียงจากคลิป 3–10 วิ, **voice design** จากคำบรรยาย ("female, low pitch"), เร็วมาก (RTF 0.025 ≈ 40 เท่าของ realtime), ฐานเป็น Qwen3-0.6B — เบาพอสำหรับ GPU บ้าน ๆ
- **ติดตั้ง:** `pip install omnivoice` · เดโม UI: `omnivoice-demo --ip 0.0.0.0 --port 8001`
- **เทรนจากข้อมูลเปิดล้วน ๆ (581k ชม.)** → **Apache-2.0 ใช้เชิงพาณิชย์ได้** ✅
- **เวอร์ชันไทยโดยเฉพาะ:**
  - โมเดลไฟน์จูนไทย: `hotdogs/omnivoice-thai` (เทรนเพิ่ม ~20,000 ประโยคไทย / ~12.6 ชม.)
  - [nanofatdog/omnivoice-thai-api](https://github.com/nanofatdog/omnivoice-thai-api) — ห่อเป็น **REST API + WebUI** (พอร์ต 7860), ติดตั้งสคริปต์เดียว, VRAM ขั้นต่ำ 4GB (แนะนำ 8GB), MIT — เหมาะเอาไปเสียบ pipeline อัตโนมัติ

## 🥉 ThonburianTTS — สายวิจัย คุณภาพดี แต่ห้ามใช้เชิงพาณิชย์

- **GitHub:** [biodatlab/thonburian-tts](https://github.com/biodatlab/thonburian-tts) · โมเดล: [biodatlab/ThonburianTTS](https://huggingface.co/biodatlab/ThonburianTTS) (มีตัวปกติ + ตัว IPA)
- ต่อยอด F5-TTS/E2-TTS เน้นความแม่นการออกเสียงไทย, alignment เสถียร, zero-shot cloning, รองรับ**ไทยปนอังกฤษ (code-mixed)**, มี `FlowTTSPipeline` ใช้ง่าย + Gradio demo + Colab
- **ไลเซนส์:** โค้ด MIT แต่ **โมเดล CC BY-NC-SA 4.0 (ห้ามเชิงพาณิชย์)** — เหมาะศึกษา/เทียบคุณภาพ

## ตัวเบา / รุ่นเก่า / เฉพาะทาง

| โมเดล | รายละเอียด | ไลเซนส์ |
|---|---|---|
| [facebook/mms-tts-tha](https://huggingface.co/facebook/mms-tts-tha) (Meta MMS) | VITS เสียงเดียว เบามาก รัน CPU ได้ ใช้ผ่าน `transformers` (ดู `../examples/mms_tts_demo.py`) — มีฟอร์กปรับเสียง เช่น [VIZINTZOR/MMS-TTS-THAI-FEMALEV2](https://huggingface.co/VIZINTZOR/MMS-TTS-THAI-FEMALEV2) | CC BY-NC 4.0 |
| [KhanomTan TTS](https://github.com/wannaphong/KhanomTan-TTS-v1.0) (ขนมตาล) | โมเดลไทยโอเพนซอร์สยุคบุกเบิก (YourTTS/VITS, สาย Coqui) รองรับไทย+อังกฤษ | ดู model card |
| [PyThaiTTS](https://github.com/PyThaiNLP/PyThaiTTS) | ไลบรารี Python ของทีม PyThaiNLP ห่อ KhanomTan ฯลฯ ให้เรียกง่าย | Apache-2.0 |
| [Prim9000/Thai_TTS](https://github.com/Prim9000/Thai_TTS) | โปรเจกต์ Tacotron2 ไทย (คลาสสิก เหมาะเรียนรู้หลักการ) | ดู repo |
| [Typhoon2-Audio](https://github.com/scb-10x/typhoon2-audio) (SCB 10X) | Audio-LLM ไทย 8B: speech-in → text+**speech-out** พร้อมกัน — เกินขอบเขต TTS แต่พูดไทยได้ดี ([HF](https://huggingface.co/scb10x/llama3.1-typhoon2-audio-8b-instruct)) | เปิด weights |
| [JaiTTS](https://arxiv.org/pdf/2604.27607) | เปเปอร์โมเดลโคลนเสียงไทย (2026) — ตามอ่านแนวทาง | - |
| eSpeak NG | เสียงสังเคราะห์แบบ formant รองรับไทยพื้นฐาน — ไว้เป็น fallback/G2P เท่านั้น | GPL |

## หมายเหตุเปรียบเทียบ

- **คุณภาพเสียงไทยธรรมชาติสุด (เปิด):** สาย F5 (F5-TTS-THAI, ThonburianTTS) > OmniVoice-thai > MMS/KhanomTan
- **ไทยปนอังกฤษในประโยคเดียว:** OmniVoice, ThonburianTTS ทำได้ตรง ๆ / F5-TTS-THAI ใช้ทับศัพท์หรือ V2
- **ความเร็ว/ความเบา:** MMS (CPU ได้) > OmniVoice (40x realtime บน GPU) > F5
- **ใช้เชิงพาณิชย์ชัวร์สุด:** OmniVoice (Apache-2.0)
- **Piper / Kokoro / Qwen3-TTS ไม่มีภาษาไทย** — ใช้ฝั่งอังกฤษได้ (ดู [02-english-multilingual-models.md](02-english-multilingual-models.md))
