# TTS AI — ทำ Text-to-Speech ใช้เอง (ไทย + อังกฤษ)

โฟลเดอร์นี้แยกไว้สำหรับงานสร้าง TTS AI ส่วนตัวโดยเฉพาะ รวบรวมเครื่องมือ โมเดล ดาต้าเซ็ต และความรู้ที่ต้องใช้ทั้งหมด (อัปเดตข้อมูล ณ ส.ค. 2026)

> เป้าหมาย: มีระบบแปลงข้อความ → เสียงพูด ภาษาไทยและอังกฤษ ที่รันเองได้ / ควบคุมเองได้ และในอนาคตใช้แทน/เสริม ElevenLabs ใน pipeline ทำคลิปของ repo นี้

## TL;DR — แนะนำ 3 เส้นทาง

| เส้นทาง | เหมาะกับ | เครื่องมือหลัก | ต้องมี |
|---|---|---|---|
| **A. เริ่มเร็ว ฟรี** | ลองของ, งานส่วนตัว, เครื่องไม่มี GPU | `edge-tts` (เสียงไทย Premwadee/Niwat ของ Microsoft) | Python อย่างเดียว |
| **B. รันเองบนเครื่อง (โอเพนซอร์ส)** ⭐ แนะนำ | ทำ TTS ใช้เองจริงจัง, โคลนเสียง, ไม่ง้อคลาวด์ | **F5-TTS-THAI** (ไทยเน้น ๆ) + **OmniVoice** (ไทย/อังกฤษ/600+ ภาษา, Apache-2.0) | GPU NVIDIA VRAM ≥ 4–8GB (หรือ Colab) |
| **C. คุณภาพโปรดักชัน (API)** | งานคลิปลง YouTube ที่ต้องเนียนสุด | ElevenLabs `eleven_v3` (รองรับไทยแล้ว), Azure, Gemini TTS | จ่ายตามใช้ / มี free tier |

**ถ้าให้เลือกจุดเริ่มเดียว:** ติดตั้ง [F5-TTS-THAI](https://github.com/VYNCX/F5-TTS-THAI) (`pip install f5-tts-th`) — มี WebUI, โคลนเสียงจากตัวอย่าง ~10 วินาทีได้ (zero-shot), มี Colab ให้ทั้งรันและไฟน์จูน แล้วเสริมด้วย OmniVoice สำหรับประโยคปนอังกฤษ

## โครงสร้างโฟลเดอร์

```
tts-ai/
  README.md                          # ไฟล์นี้ — ภาพรวม + คำแนะนำ
  docs/
    01-thai-tts-models.md            # โมเดล TTS ภาษาไทยทั้งหมด (โอเพนซอร์ส/รันเอง)
    02-english-multilingual-models.md# โมเดลอังกฤษ + หลายภาษา ตัวท็อปปี 2026
    03-cloud-apis.md                 # บริการคลาวด์/API ทั้งไทยและเทศ
    04-datasets.md                   # ดาต้าเซ็ตเสียงไทย/อังกฤษ + วิธีสร้าง dataset เอง
    05-thai-text-processing.md       # เครื่องมือจัดการข้อความไทยก่อนเข้า TTS (ตัดคำ, อ่านเลข, G2P)
    06-training-finetuning-evaluation.md # เทรน/ไฟน์จูนเสียงตัวเอง + วัดคุณภาพ + ฮาร์ดแวร์
  examples/
    edge_tts_demo.py                 # เดโมเร็วสุด ฟรี ไม่ใช้ GPU (ไทย+อังกฤษ)
    mms_tts_demo.py                  # เดโมโมเดลเบา รัน CPU ได้
    f5_tts_thai_demo.py              # เดโมตัวหลัก: F5-TTS-THAI + โคลนเสียง
    omnivoice_demo.py                # เดโม OmniVoice: โคลนเสียง + ออกแบบเสียง
    requirements.txt
  normalize_th.py                    # แปลงตัวเลข/เวลา/เงินเป็นคำอ่านไทยก่อนเข้า TTS (จุดอ่อนที่เจอจากการทดสอบจริง)
  tests/                             # 🎧 ชุดทดสอบฟังเสียงไทยเทียบทุกเอนจิน (เริ่มที่ tests/README.md)
    sentences_th.json                # ประโยคมาตรฐาน 6 แบบ (เลข/อังกฤษปน/อารมณ์ ฯลฯ)
    run_thai_tts_test.py             # รันบน PC/VPS — เจนเสียงทุกเอนจิน + report
    colab_thai_tts_test.ipynb        # รอบ 1: edge-tts / MMS / F5-V1 บน Colab
    colab_thai_tts_round2.ipynb      # รอบ 2: OmniVoice-Thai / F5-V2 / Thonburian
    colab_omni_thai_only.ipynb       # เฉพาะ OmniVoice-Thai ตัวเดียว (~8 นาที)
    colab_omni_thai_myvoice.ipynb    # 🏆 ตัวที่ใช้จริง: โคลนเสียงตัวเอง + normalize ตัวเลข ⭐
```

> **สถานะล่าสุด (2 ส.ค. 2026):** ทดสอบฟังจริงแล้ว 2 รอบ — **เลือก OmniVoice-Thai เป็นตัวหลัก** (อ่านถูก เว้นวรรคดี, Apache-2.0 ใช้เชิงพาณิชย์ได้) จุดอ่อนอ่านตัวเลขแก้ด้วย `normalize_th.py` แล้ว ขั้นต่อไป: โคลนเสียงเจ้าของช่อง — ดูผลทดสอบ/วิธีส่งคลิปเสียงที่ [tests/README.md](tests/README.md)

## สรุปตัวเลือกเด่น (ภาษาไทย)

| เครื่องมือ | จุดเด่น | ข้อจำกัด | ไลเซนส์ |
|---|---|---|---|
| [F5-TTS-THAI](https://github.com/VYNCX/F5-TTS-THAI) | คุณภาพไทยดีสุดในสายโอเพนซอร์ส, โคลนเสียง, WebUI, Colab, ไฟน์จูนง่าย | คำอังกฤษต้องเขียนทับศัพท์ (V1) หรือใช้ V2 (IPA) | โค้ด MIT (เช็คไลเซนส์ weights บน HF ก่อนใช้เชิงพาณิชย์) |
| [OmniVoice (k2-fsa)](https://github.com/k2-fsa/OmniVoice) | 600+ ภาษารวมไทย, โคลนเสียงจากคลิป 3–10 วิ, เร็ว 40x realtime, voice design จากคำบรรยาย | ตัวใหม่ (มี.ค. 2026) ชุมชนยังเล็ก | Apache-2.0 ✅ ใช้เชิงพาณิชย์ได้ |
| [OmniVoice Thai API](https://github.com/nanofatdog/omnivoice-thai-api) | ตัวห่อ OmniVoice ไฟน์จูนไทย + REST API + WebUI พร้อมเสียบเข้า pipeline | VRAM ≥ 4GB | MIT |
| [ThonburianTTS](https://github.com/biodatlab/thonburian-tts) | งานวิจัยไทย (biodatlab), รองรับไทยปนอังกฤษ (code-mixed) | **โมเดลเป็น CC BY-NC-SA — ห้ามใช้เชิงพาณิชย์** | โค้ด MIT / โมเดล NC |
| [edge-tts](https://github.com/rany2/edge-tts) | ฟรี, ไม่ใช้ GPU, เสียงไทยระดับ Azure (Premwadee/Niwat) | ต้องต่อเน็ต, ใช้บริการ MS แบบไม่เป็นทางการ — ไม่เหมาะงานโปรดักชันเชิงพาณิชย์ | GPL-3.0 (ตัวไลบรารี) |
| [Typhoon2-Audio](https://github.com/scb-10x/typhoon2-audio) (SCB 10X) | โมเดลไทย speech-in/speech-out (8B) พูดตอบเป็นเสียงได้ | ใหญ่ (ต้องการ GPU แรง), ไม่ใช่ TTS เพียว ๆ | เปิด weights |
| [PyThaiTTS](https://github.com/PyThaiNLP/PyThaiTTS) / KhanomTan | ไลบรารีสาย PyThaiNLP ใช้ง่าย | คุณภาพรุ่นเก่ากว่าสาย F5 | Apache-2.0 |

รายละเอียดเต็ม + โมเดลอื่น ๆ อยู่ใน [docs/01-thai-tts-models.md](docs/01-thai-tts-models.md)

## ขั้นตอนเริ่มต้นที่แนะนำ

1. **ลองก่อนไม่ต้องติดตั้ง** — เล่น F5-TTS-THAI บน [Hugging Face Space](https://huggingface.co/spaces/pythonlearnreal/F5-TTS-THAI) หรือ [Colab](https://colab.research.google.com/drive/10yb4-mGbSoyyfMyDX1xVF6uLqfeoCNxV?usp=sharing)
2. **รันเดโมฟรีบนเครื่อง** — `pip install edge-tts` แล้วรัน `examples/edge_tts_demo.py` (ได้ MP3 ไทย/อังกฤษทันที)
3. **ติดตั้งตัวหลัก** — `pip install f5-tts-th` (ต้อง Python 3.10+, GPU CUDA 11.8+) แล้วรัน `examples/f5_tts_thai_demo.py` หรือเปิด WebUI ด้วยคำสั่ง `f5-tts_webui`
4. **โคลนเสียงตัวเอง** — อัดเสียงพูดชัด ๆ 10–30 วินาที ใช้เป็น `ref_audio` (zero-shot) — ดีขึ้นอีกให้ไฟน์จูนด้วยเสียง 1–3 ชม. ตาม [docs/06](docs/06-training-finetuning-evaluation.md)
5. **ต่อเข้า pipeline คลิป** — รัน OmniVoice Thai API (REST ที่พอร์ต 7860) แทนที่สคริปต์ `elevenlabs/` ใน projects ได้ในอนาคต

## ข้อควรรู้เรื่องไลเซนส์ (สำคัญถ้าคลิปมีรายได้)

- **ใช้ได้สบายใจเชิงพาณิชย์:** OmniVoice (Apache-2.0), Piper (MIT), Kokoro (Apache-2.0), API ที่จ่ายเงิน (ElevenLabs/Azure/Google ตามเงื่อนไขบริการ)
- **ห้ามเชิงพาณิชย์:** โมเดล ThonburianTTS (CC BY-NC-SA), MMS-TTS ของ Meta (CC BY-NC), F5-TTS checkpoint ต้นทาง (เทรนบน Emilia, CC BY-NC) — ฟอร์กไทยที่ต่อยอดมาให้เช็ค model card ก่อน
- **โคลนเสียง:** ใช้เฉพาะเสียงตัวเองหรือได้รับอนุญาตจากเจ้าของเสียงเท่านั้น
- **edge-tts:** เหมาะทดลอง/ใช้ส่วนตัว — งานโปรดักชันจริงให้ใช้ Azure Speech ตัวเป็นทางการ (เสียงเดียวกัน)

## เอกสารทั้งหมด

- [01 — โมเดล TTS ภาษาไทย](docs/01-thai-tts-models.md)
- [02 — โมเดลอังกฤษ/หลายภาษา ตัวท็อป 2026](docs/02-english-multilingual-models.md)
- [03 — บริการคลาวด์/API](docs/03-cloud-apis.md)
- [04 — ดาต้าเซ็ต + สร้าง dataset เอง](docs/04-datasets.md)
- [05 — จัดการข้อความไทย (text front-end)](docs/05-thai-text-processing.md)
- [06 — เทรน/ไฟน์จูน/วัดผล + ฮาร์ดแวร์](docs/06-training-finetuning-evaluation.md)
