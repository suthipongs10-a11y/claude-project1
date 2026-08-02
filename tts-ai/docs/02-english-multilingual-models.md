# 02 — โมเดล TTS ภาษาอังกฤษ / หลายภาษา (ตัวท็อปปี 2026)

สำหรับงานเสียงอังกฤษ (เช่นคลิปช่อง EN) และโมเดลหลายภาษาที่*ไม่มี*ไทยแต่คุณภาพสูงมาก
สถานะปี 2026: โอเพนซอร์สไล่ทัน/แซงเจ้าตลาดแล้วในหลาย blind test

## ตัวที่ควรรู้จัก

| โมเดล | ขนาด/สเปก | จุดเด่น | ภาษา | ไลเซนส์ |
|---|---|---|---|---|
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | 82M — จิ๋วมาก | คุณภาพเกินตัว รันได้แม้ Raspberry Pi / CPU, เหมาะทำ API ส่วนตัวประหยัด | en + อีกหลายภาษา (ไม่มีไทย) | Apache-2.0 |
| [Chatterbox](https://github.com/resemble-ai/chatterbox) (Resemble AI) | 0.5B | ชนะ ElevenLabs ใน blind test ~65%, มี emotion exaggeration control, โคลนเสียง | en (รุ่น Multilingual 23 ภาษา — ไม่มีไทย) | MIT |
| [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) (Alibaba, ม.ค. 2026) | หลายรุ่น | ครบเครื่องสุด: โคลนเสียง 3 วิ, voice design จากคำบรรยาย, streaming | 10 ภาษา (zh/en/ja/ko/de/fr/ru/pt/es/it — **ไม่มีไทย**) | เปิด (เช็ค repo) |
| [OmniVoice](https://github.com/k2-fsa/OmniVoice) | ฐาน Qwen3-0.6B | 600+ ภาษา **รวมไทย** — ตัวเดียวจบทั้งไทย+อังกฤษ (ดูรายละเอียดใน [01](01-thai-tts-models.md)) | 600+ | Apache-2.0 |
| [F5-TTS](https://github.com/SWivid/F5-TTS) | ~336M | ฐานของสายไทยทั้งหลาย, โคลนเสียง zero-shot, งาน en/zh ดีมาก | en, zh (+ฟอร์กภาษาอื่น) | โค้ด MIT / weights CC BY-NC |
| [CosyVoice 2/3](https://github.com/FunAudioLLM/CosyVoice) (Alibaba) | 0.5B+ | streaming latency ต่ำมาก เหมาะ voice agent แบบเรียลไทม์ | zh/en/ja/ko + dialects | Apache-2.0 |
| [Fish Speech / OpenAudio](https://github.com/fishaudio/fish-speech) | S1: 4B / mini 0.5B | คุณภาพหลายภาษาระดับแนวหน้า, มีบริการคลาวด์ควบ | 13+ ภาษา (ไม่มีไทย) | weights CC BY-NC-SA |
| [IndexTTS-2](https://github.com/index-tts/index-tts) (Bilibili) | - | zero-shot + คุมอารมณ์/ระยะเวลาแม่น เหมาะพากย์วิดีโอ | zh/en | เช็ค repo (มีเงื่อนไข) |
| [XTTS-v2](https://huggingface.co/coqui/XTTS-v2) (Coqui — ฟอร์กดูแลโดย [idiap](https://github.com/idiap/coqui-ai-TTS)) | ~750M | ตำนานโคลนเสียง 17 ภาษา ยังใช้กันแพร่หลาย | 17 ภาษา (ไม่มีไทย) | Coqui Public License (NC) |
| [Piper](https://github.com/OHF-Voice/piper1-gpl) | เล็กมาก | เร็วสุดบน CPU/Raspberry Pi เหมาะ smart home / อ่านหนังสือ — **ไม่มีเสียงไทยทางการ** (เทรนเองได้ผ่าน [TextyMcSpeechy](https://github.com/domesticatedviking/TextyMcSpeechy)) | 35+ ภาษา | MIT/GPL (ตามรุ่น) |
| [StyleTTS 2](https://github.com/yl4579/StyleTTS2) | - | เสียงอังกฤษธรรมชาติมาก (ระดับ human-parity ใน LJSpeech) | en | MIT |
| [Orpheus](https://github.com/canopyai/Orpheus-TTS) | 3B (ฐาน Llama) | เสียงมีอารมณ์ หัวเราะ/ถอนหายใจได้ (`<laugh>` แท็ก) | en | Apache-2.0 |
| [Dia](https://github.com/nari-labs/dia) (Nari Labs) | 1.6B | บทสนทนา 2 คนในการ generate ครั้งเดียว (podcast style) | en | Apache-2.0 |
| [VibeVoice](https://github.com/microsoft/VibeVoice) (Microsoft) | 1.5B/7B | เสียงยาวมาก (พอดแคสต์ 90 นาที หลายผู้พูด) | en/zh | MIT |
| [Bark](https://github.com/suno-ai/bark) (Suno) | - | เสียง+เอฟเฟกต์+เพลงฮัมได้ สนุกแต่คุมยาก | หลายภาษา (ไทยไม่ดี) | MIT |
| [Sesame CSM-1B](https://github.com/SesameAILabs/csm) | 1B | conversational speech สาย voice-assistant | en | Apache-2.0 |
| [Higgs Audio v2](https://github.com/boson-ai/higgs-audio) (Boson AI) | 3B+ | expressive หลายภาษา คะแนน EmergentTTS สูง | หลายภาษา | เปิด weights |
| [MeloTTS](https://github.com/myshell-ai/MeloTTS) | เล็ก | เร็ว CPU-friendly ยอดดาวน์โหลดสูงบน HF | en/zh/ja/ko/es/fr | MIT |
| [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) | - | few-shot cloning จากเสียง 1 นาที + WebUI ครบวงจร ชุมชนใหญ่มาก | zh/en/ja/ko/yue | MIT |

## วิธีเลือก (ฝั่งอังกฤษ)

- **ทำ API ส่วนตัวเบา ๆ / เครื่องอ่อน:** Kokoro-82M (มีโปรเจกต์พร้อมใช้ เช่น [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI))
- **โคลนเสียงคุณภาพสูงสุดแบบเปิด:** Chatterbox หรือ Qwen3-TTS
- **เสียงมีอารมณ์เว่อร์ ๆ สำหรับ storytelling:** Orpheus, Higgs Audio v2, (API: ElevenLabs v3)
- **ใช้ตัวเดียวได้ทั้งไทย+อังกฤษ:** OmniVoice
- **สนทนาเรียลไทม์:** CosyVoice 2, Sesame CSM

## แหล่งติดตามอันดับ/เทียบเสียง

- [TTS Arena (HF)](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) — โหวต blind test สด
- [TTS Arena V2 / Artificial Analysis Speech Arena](https://artificialanalysis.ai/text-to-speech/arena) — จัดอันดับ TTS
- บทสรุปปี 2026: [BentoML — Open-Source TTS 2026](https://bentoml.com/blog/exploring-the-world-of-open-source-text-to-speech-models), [TextToLab เทียบ 8 โมเดล](https://texttolab.com/blog/open-source-text-to-speech), [SiliconFlow Best TTS 2026](https://www.siliconflow.com/articles/en/best-open-source-text-to-speech-models)
- [Hugging Face — โมเดล TTS เรียงตามเทรนด์](https://huggingface.co/models?pipeline_tag=text-to-speech&sort=trending)
