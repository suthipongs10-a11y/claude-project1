# 04 — ดาต้าเซ็ตเสียงพูด (ไทย + อังกฤษ) และการสร้าง dataset เอง

ใช้เมื่อจะ**ไฟน์จูน/เทรน**โมเดลเอง — ถ้าแค่ใช้งาน TTS ข้ามไฟล์นี้ได้

## ดาต้าเซ็ตภาษาไทย

| ดาต้าเซ็ต | ขนาด | เหมาะกับ | หมายเหตุ |
|---|---|---|---|
| [dubbing-ai/vaja-thai](https://huggingface.co/datasets/dubbing-ai/vaja-thai) ⭐ | ~969 ชม. (รวมหลายแหล่ง) | **เทรน TTS — จุดเริ่มที่ดีสุด** | คัดคุณภาพแล้ว มี `quality_tier` 1–4, รีแซมเปิลเป็น 24kHz WAV, โหลดแยกแหล่งได้ (เช่น `porjai_central`) |
| [Common Voice — Thai](https://commonvoice.mozilla.org/th) (Mozilla) | หลายร้อยชั่วโมง, ผู้พูดหลากหลาย | เทรน multi-speaker / ASR | CC0 ใช้อิสระ, 48kHz MP3, คุณภาพไมค์ปะปน — ต้องกรอง |
| [GigaSpeech2 — th](https://huggingface.co/datasets/speechcolab/gigaspeech2) | refined ~10,000 ชม. | pre-train ขนาดใหญ่ / ASR | เก็บจาก YouTube + ถอดเสียงอัตโนมัติ — เกรด ASR ต้องคัดก่อนใช้กับ TTS ([GitHub](https://github.com/SpeechColab/GigaSpeech2)) |
| Porjai (CMKL) — [central](https://huggingface.co/datasets/CMKL/Porjai-Thai-voice-dataset-central) / [pattani](https://huggingface.co/datasets/CMKL/Porjai-Thai-voice-dataset-pattani) / korat / khummuang | หลายสิบชั่วโมงต่อชุด | ภาษาถิ่น (กลาง/ใต้/อีสาน/เหนือ) | หายากมากสำหรับ dialect ไทย |
| TSync-1 / TSync-2 (NECTEC) | ~ไม่กี่สิบชั่วโมง สตูดิโอ 44.1kHz | TTS เสียงเดียวคุณภาพสูง (คอร์ปัสคลาสสิกที่ KhanomTan ฯลฯ ใช้) | ขอผ่าน [AI FOR THAI](https://aiforthai.in.th/) |
| Thai Elderly Speech (Data Wow/VISAI) | ~สิบกว่าชั่วโมง | เสียงผู้สูงอายุ | เฉพาะทาง |
| [Nexdata Thai speech](https://huggingface.co/datasets/Nexdata/Thai_Speech_Data_by_Mobile_Phone_Guiding) | ตัวอย่างจากชุดขาย | เชิงพาณิชย์ (ซื้อ) | มีหลายชุด (มือถือ/สคริปต์) |

## ดาต้าเซ็ตภาษาอังกฤษ (มาตรฐานวงการ)

| ดาต้าเซ็ต | ขนาด | เหมาะกับ |
|---|---|---|
| [LJSpeech](https://keithito.com/LJ-Speech-Dataset/) | 24 ชม. หญิง 1 เสียง | เทรนโมเดลแรก / benchmark คลาสสิก (public domain) |
| [LibriTTS-R](https://www.openslr.org/141/) | 585 ชม. 2,456 เสียง (เสียงปรับปรุงแล้ว) | multi-speaker มาตรฐาน |
| [VCTK](https://datashare.ed.ac.uk/handle/10283/3443) | 110 เสียง หลายสำเนียง | accent หลากหลาย |
| [Emilia](https://huggingface.co/datasets/amphion/Emilia-Dataset) | ~101k ชม. (en/zh/de/fr/ja/ko) | pre-train ระดับใหญ่ (ฐานของ F5-TTS) — CC BY-NC |
| [GLOBE](https://huggingface.co/datasets/MushanW/GLOBE) | 535 ชม. สำเนียงทั่วโลก | เสียงอังกฤษหลายสำเนียง |
| [Expresso](https://huggingface.co/datasets/ylacombe/expresso) (Meta) | เสียงมีอารมณ์/สไตล์ | expressive TTS (NC) |

## สร้าง dataset เสียงตัวเอง (สูตรลัด)

เป้าหมายขั้นต่ำ: **1–3 ชม.** เสียงสะอาดสำหรับไฟน์จูน F5-TTS-THAI (zero-shot ใช้แค่ 10–30 วิ ไม่ต้องทำ dataset)

1. **อัดเสียง** — ห้องเงียบ, ไมค์เดิมตลอด, 24kHz+ mono, อ่านสคริปต์หลากหลาย (ข่าว/เล่าเรื่อง/คำถาม) หรือดึงเสียงจากคลิปเก่าของช่องตัวเอง
2. **ทำความสะอาด** — แยกเสียงพูดจากดนตรี: [UVR](https://github.com/Anjok07/ultimatevocalremovergui) หรือ [demucs](https://github.com/facebookresearch/demucs) → ลด noise: [resemble-enhance](https://github.com/resemble-ai/resemble-enhance) หรือ [DeepFilterNet](https://github.com/Rikorose/DeepFilterNet)
3. **หั่นเป็นท่อน 3–15 วิ** — [audio-slicer](https://github.com/openvpi/audio-slicer) หรือให้ WhisperX ตัดตาม segment
4. **ถอดเสียงเป็นข้อความ** — ไทย: [Thonburian Whisper](https://huggingface.co/biodatlab/whisper-th-medium-combined) หรือ [Typhoon ASR](https://github.com/scb-10x/typhoon-asr) / อังกฤษ+timestamps: [WhisperX](https://github.com/m-bain/whisperX), [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
5. **ตรวจ + จัดรูปแบบ** — ไล่ฟังสุ่ม, แก้ตัวสะกด, normalize ข้อความ (ดู [05](05-thai-text-processing.md)) แล้วจัดเป็น `metadata.csv` (`path|text`) ตามที่ตัวเทรนต้องการ — UI เทรนของ F5-TTS-THAI (`f5-tts_finetune-gradio`) มีเครื่องมือเตรียมข้อมูลในตัว
6. (ทางเลือก) **จัด alignment แม่น ๆ** — [Montreal Forced Aligner](https://montreal-forced-aligner.readthedocs.io/) สำหรับโมเดลที่ต้องการ duration

> ⚠️ กฎเหล็ก: เสียงคนอื่น (ดารา/ยูทูบเบอร์) ต้องได้รับอนุญาตก่อนโคลน — ปลอดภัยสุดคือเสียงตัวเองหรือจ้างนักพากย์เซ็นสัญญา

## แหล่งค้นเพิ่ม

- HF Datasets กรอง [`language:th` + audio](https://huggingface.co/datasets?language=language:th&task_categories=task_categories:text-to-speech)
- [OpenSLR](https://www.openslr.org/) — คลังคอร์ปัสเสียงวิชาการ
- [speech-datasets รวมลิงก์](https://github.com/RevoSpeechTech/speech-datasets-collection)
