# 06 — เทรน / ไฟน์จูน / วัดผล + ฮาร์ดแวร์

## บันไดสามขั้น (เรียงจากง่าย → ยาก)

### ขั้น 1: Zero-shot cloning — ไม่ต้องเทรนเลย ⭐ เริ่มตรงนี้
ใช้เสียงอ้างอิง 3–30 วินาที + transcript ของเสียงนั้น → โมเดลเลียนเสียงทันที
- F5-TTS-THAI: `tts.infer(ref_audio=..., ref_text=..., gen_text=...)`
- OmniVoice: `model.generate(text=..., ref_audio=..., ref_text=...)`
- เคล็ดลับ: เสียงอ้างอิงสะอาด ไม่มีดนตรี, จบประโยคพอดี, ความยาว ~10 วิ กำลังดี

### ขั้น 2: Fine-tune จากโมเดลไทยที่มีอยู่ (คุ้มสุดถ้าจะใช้เสียงเดิมซ้ำ ๆ)
ใช้เสียง 1–3 ชม. (ดูวิธีเตรียมใน [04-datasets.md](04-datasets.md)) ไฟน์จูนต่อจาก checkpoint ไทย
- **F5-TTS-THAI:** มี UI เทรนในตัว — `git clone https://github.com/VYNCX/F5-TTS-THAI && cd F5-TTS-THAI && pip install -e .` แล้วรัน `f5-tts_finetune-gradio` หรือใช้ [Colab finetune](https://colab.research.google.com/drive/1jwzw4Jn1qF8-F0o3TND68hLHdIqqgYEe?usp=sharing)
- เริ่มจาก checkpoint `VIZINTZOR/F5-TTS-TH-V2` จะได้พื้นการอ่านไทยที่แม่นอยู่แล้ว

### ขั้น 3: เทรนใหม่/ภาษาใหม่จากฐานใหญ่ (งานวิจัย — แพงและยาก)
ต้องการข้อมูลหลักร้อย–พันชั่วโมง + multi-GPU — แนวทางดูจากเปเปอร์ ThonburianTTS / OmniVoice

## เฟรมเวิร์กเทรนที่ควรรู้จัก

| เฟรมเวิร์ก | เด่นเรื่อง |
|---|---|
| [F5-TTS](https://github.com/SWivid/F5-TTS) (+ฟอร์กไทย VYNCX) | สายหลักของงานไทยตอนนี้ — finetune ง่าย มี Gradio |
| [Coqui TTS (ฟอร์ก idiap)](https://github.com/idiap/coqui-ai-TTS) | ครอบคลุมสุด (VITS, XTTS, YourTTS — สายที่ KhanomTan ใช้) |
| [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) | few-shot 1 นาที + WebUI ครบวงจร (ไทยต้อง hack เพิ่ม) |
| [ESPnet](https://github.com/espnet/espnet) / [NeMo](https://github.com/NVIDIA/NeMo) | สายวิชาการ/สเกลใหญ่ recipe เพียบ |
| [Amphion](https://github.com/open-mmlab/Amphion) | ชุดเครื่องมือ TTS/voice conversion รวมงานใหม่ ๆ (MaskGCT ฯลฯ) |
| [Matcha-TTS](https://github.com/shivammehta25/Matcha-TTS) | โมเดลเล็กเทรนไว เหมาะทดลองแนวคิด |
| [TextyMcSpeechy](https://github.com/domesticatedviking/TextyMcSpeechy) | เทรนเสียง Piper ของตัวเอง (เป้าหมาย: รันบน RPi/CPU) |
| Vocoders: [BigVGAN](https://github.com/NVIDIA/BigVGAN), [Vocos](https://github.com/gemelo-ai/vocos), HiFi-GAN | ตัวแปลง mel→waveform เมื่อเทรนสายคลาสสิก (สาย F5 ใช้ Vocos อยู่แล้ว) |

## ฮาร์ดแวร์

| งาน | สเปกขั้นต่ำ | สบาย ๆ |
|---|---|---|
| ใช้งาน (inference) edge-tts / MMS | CPU อย่างเดียว | - |
| ใช้งาน F5-TTS-THAI / OmniVoice | GPU 4GB (เช่น GTX 1650 — ช้าหน่อย) หรือ Colab ฟรี | RTX 3060 12GB ขึ้นไป |
| Fine-tune F5 (batch เล็ก) | 12GB (RTX 3060 12GB) | RTX 3090/4090 24GB |
| เทรนใหญ่/หลายภาษา | multi-GPU A100/H100 | เช่าคลาวด์ |

ไม่มี GPU? เช่ารายชั่วโมง: [Vast.ai](https://vast.ai/), [RunPod](https://www.runpod.io/), [Lambda](https://lambda.ai/), Google Colab Pro — RTX 4090 ตกราว $0.3–0.6/ชม. ไฟน์จูน F5 จบได้ในไม่กี่สิบชั่วโมง GPU

## วัดคุณภาพ (Evaluation)

| ตัววัด | เครื่องมือ | วัดอะไร |
|---|---|---|
| ความเป็นธรรมชาติ (MOS อัตโนมัติ) | [UTMOS](https://github.com/sarulab-speech/UTMOS22) / [UTMOSv2](https://github.com/sarulab-speech/UTMOSv2), [NISQA](https://github.com/gabrielmittag/NISQA) | คะแนน 1–5 ประมาณหูคน |
| อ่านถูกไหม (intelligibility) | ถอดเสียงกลับด้วย Whisper ([Thonburian Whisper](https://huggingface.co/biodatlab/whisper-th-medium-combined) สำหรับไทย) แล้วคิด WER/CER เทียบต้นฉบับ | การอ่านผิด/ข้ามคำ |
| ความเหมือนผู้พูด | speaker embedding cosine (ECAPA-TDNN ใน [SpeechBrain](https://github.com/speechbrain/speechbrain), WavLM) | งานโคลนเสียง |
| เฉพาะไทย | [Thai-TTS-Evaluation](https://github.com/JoesSattes/Thai-TTS-Evaluation) | สคริปต์ประเมินโทน/การออกเสียงไทย |
| หูตัวเอง 👂 | ประโยคทดสอบมาตรฐาน ~20 ประโยค (ดู [05](05-thai-text-processing.md)) | สิ่งที่ตัวเลขไม่เห็น: จังหวะ วรรณยุกต์ อารมณ์ |

## ลำดับงานแนะนำสำหรับโปรเจกต์นี้

1. ใช้ zero-shot F5-TTS-THAI + เสียงอ้างอิงที่ชอบ → ได้เสียงต้นแบบเร็ว
2. เก็บประโยคที่อ่านผิดเข้าไฟล์ → แก้ด้วย text normalization ([05](05-thai-text-processing.md)) ก่อนคิดเรื่องเทรน
3. ถ้าเสียงยังไม่นิ่ง/ไม่เหมือนพอ → อัดเสียง 1–3 ชม. แล้วไฟน์จูน (ขั้น 2)
4. รัน eval อัตโนมัติ (UTMOS + WER) ทุกรอบที่เปลี่ยนโมเดล เก็บผลไว้ในโฟลเดอร์นี้
