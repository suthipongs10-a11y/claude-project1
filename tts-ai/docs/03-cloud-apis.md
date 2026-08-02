# 03 — บริการคลาวด์ / API (ไทย + อังกฤษ)

ทางลัดคุณภาพโปรดักชันโดยไม่ต้องมี GPU — จ่ายตามใช้ ส่วนใหญ่มี free tier
(ราคาเปลี่ยนบ่อย — ยึดหน้า pricing ทางการเป็นหลัก)

## เจ้าที่รองรับภาษาไทย

| บริการ | โมเดล/เสียงไทย | จุดเด่น | หมายเหตุ |
|---|---|---|---|
| [ElevenLabs](https://elevenlabs.io/) | `eleven_v3` (70+ ภาษา **รวมไทย**) | เสียงอารมณ์สมจริงสุดในตลาด, มี audio tags คุมโทน `[excited] [whispers]`, Text-to-Dialogue API | **repo นี้ใช้อยู่แล้ว** ใน `projects/*/elevenlabs/` — อัปเกรดมาใช้ v3 กับสคริปต์ไทยได้เลย ([ภาษาที่รองรับ](https://help.elevenlabs.io/hc/en-us/articles/13313366263441-What-languages-do-you-support)) |
| [Microsoft Azure Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support) | th-TH: **Premwadee**, **Niwat**, **Achara** (Neural) + เสียง multilingual | เสถียร, SSML คุมละเอียด, มี free tier รายเดือน | เสียงเดียวกับที่ `edge-tts` เรียกใช้ฟรีแบบไม่ทางการ |
| [Google Cloud TTS](https://cloud.google.com/text-to-speech) | th-TH (Standard/Neural2/Chirp3-HD) + [Gemini-TTS](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts) | Gemini-TTS สั่งสไตล์ด้วยภาษาธรรมชาติได้ | ลองฟรีผ่าน [AI Studio](https://aistudio.google.com/) (Gemini TTS preview รองรับไทย) |
| [OpenAI Audio](https://platform.openai.com/docs/guides/text-to-speech) | `gpt-4o-mini-tts`, `tts-1(-hd)` | สั่งโทน/สไตล์ผ่าน instructions, ราคาถูก | หลายภาษารวมไทย (สำเนียงไทยพอใช้–ดี ควรลองก่อน) |
| [Botnoi Voice](https://voice.botnoi.ai/) 🇹🇭 | เสียงไทย 200+ สไตล์ | สตาร์ทอัพไทย เข้าใจบริบทเสียงไทยดีสุดฝั่งบริการ, มี marketplace เสียง, แอปมือถือ, [API](https://botnoigroup.com/ai/texttospeech) (มีบน AWS Marketplace) | ใช้ฟรีมีโควตา/ขายเป็นแพ็กเกจ |
| [VAJA (AI FOR THAI / NECTEC)](https://aiforthai.in.th/) 🇹🇭 | Vaja 8/9 ชาย-หญิง | ของหน่วยงานรัฐ (NECTEC) สมัครใช้ API ฟรีมีโควตา | คุณภาพกลาง ๆ เหมาะงานทั่วไป ([ข้อมูล Vaja](https://www.nectec.or.th/en/innovation/service-innovation/vaja8.html)) |
| [iApp Speech](https://iapp.co.th/) 🇹🇭 | TTS ไทย | ผู้ให้บริการ AI ไทยอีกเจ้า มี API ครบชุด (ASR/TTS/OCR) | ราคาแบบไทย ๆ |

## เจ้าอื่นที่น่ารู้ (ไทยยังไม่มี/จำกัด)

- [Fish Audio](https://fish.audio/) — คลาวด์ของ Fish Speech โคลนเสียงดี ราคาถูก
- [Cartesia Sonic](https://cartesia.ai/) — latency ต่ำมาก สาย voice agent
- [PlayHT](https://play.ht/), [Speechify](https://speechify.com/), [Murf](https://murf.ai/) — ตลาด voiceover ทั่วไป
- [Amazon Polly](https://aws.amazon.com/polly/) — **ไม่มีเสียงไทย** (ข้ามได้เลย)

## ฟรี 100% สำหรับ dev/ทดลอง

| ทาง | วิธี | ข้อแม้ |
|---|---|---|
| [edge-tts](https://github.com/rany2/edge-tts) | `pip install edge-tts` → ใช้เสียง Azure (Premwadee/Niwat/Achara + เสียง en อีกเพียบ) ฟรีไม่ต้องมี key | ไม่เป็นทางการ อาจโดนจำกัดเมื่อไรก็ได้ ไม่ควรใช้ในงานขาย |
| Web Speech API | `speechSynthesis` ในเบราว์เซอร์ (มีเสียงไทยตามระบบ) — [ตัวอย่าง demo ไทย](https://github.com/diewland/ttsstt-th-demo) | คุณภาพขึ้นกับ OS/เบราว์เซอร์ |
| Google AI Studio | ลอง Gemini TTS ฟรีในหน้าเว็บ | โควตาทดลอง |
| HF Spaces | เดโมโมเดลเปิดต่าง ๆ (F5-TTS-THAI ฯลฯ) ฟรี | คิวแชร์กับคนอื่น |

## แนวเทียบต้นทุน (คร่าว ๆ)

- คลิป Shorts ~60 วิ ≈ ตัวอักษรไทย ~900–1,500 ตัว → API ระดับ Azure/Google ตกหลัก*สตางค์–ไม่กี่บาท*ต่อคลิป, ElevenLabs แพงกว่าแต่คุณภาพ/อารมณ์นำ
- รันเอง (F5-TTS-THAI/OmniVoice บน GPU ที่มีอยู่แล้ว) → ต้นทุนต่อคลิป ≈ ค่าไฟ แต่แลกกับเวลา setup/คุณภาพที่ต้องจูนเอง
- ทางผสมที่คุ้ม: **ร่าง/ทดลองด้วยของฟรี-ของโลคอล → เจนไฟนอลด้วย API** เฉพาะคลิปที่ปล่อยจริง
