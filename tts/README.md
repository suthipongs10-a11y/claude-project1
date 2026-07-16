# tts/ — เสียงพากย์ไทย (Gemini TTS + forced alignment)

ช่อง **ถอดรหัสจักรวาล** ใช้ **Gemini TTS** (Google AI Studio) เป็นเสียงพากย์
เพราะเสียงไทยธรรมชาติ + คุมโทนได้ + ฟรี/ถูก แต่ Gemini **ไม่คืน timestamp**
จึงเติมขั้น **forced alignment** ให้ pipeline (Bones & Firelight) ใช้ต่อได้เหมือนเดิม

```
บท (narration.txt)
   │  gen_gemini_tts.py   (GEMINI_API_KEY)
   ▼
เสียง voiceover.wav ──┐
บท narration.txt ─────┤  align_th.py   (WhisperX/stable-ts + pythainlp)
                      ▼
              clips/word-timings.json   ← pipeline ใช้ต่อ (segment_shots.py ...)
```

## ติดตั้งครั้งเดียว
```bash
pip install google-genai stable-ts pythainlp soundfile
```
- `GEMINI_API_KEY` เอาจาก https://aistudio.google.com/apikey (อย่า commit — อยู่ใน .gitignore แล้ว)
- โมเดล whisper โหลดครั้งแรก ~1.5GB (large-v3) มี GPU จะเร็ว; ไม่มีใช้ `--model medium` ได้

## A/B test เสียง (ทำก่อนเลือกเสียงประจำช่อง)
```bash
# 1) gen ประโยคทดสอบทุกเสียงใน shortlist
python tts/gen_gemini_tts.py --text tts/sample-th.txt --out tts/samples --ab

# 2) ฟังไฟล์ใน tts/samples/ แล้วเลือกเสียงที่ชอบ (เช่น Charon)

# 3) เช็คความแม่นของ alignment กับเสียงที่เลือก (สำคัญ! เพี้ยน = ภาพหลุดจังหวะ)
python tts/align_th.py --audio tts/samples/sample-Charon.wav \
    --text tts/sample-th.txt --out tts/samples/timings-Charon.json --model large-v3
```
ส่งไฟล์เสียง + timings กลับมา จะได้ดูพร้อมกันว่าเสียงไหน "หูใช่ + จังหวะตรง"

## โปรดักชันจริง (ต่อคลิป)
```bash
python tts/gen_gemini_tts.py --text clips/narration.txt --out clips \
    --voice Charon --name voiceover
python tts/align_th.py --audio clips/voiceover.wav --text clips/narration.txt \
    --out clips/word-timings.json
```
จากนั้นเข้า Step 6 ของ pipeline (`segment_shots.py`) ได้เลย

## ปรับโทนเสียง
แก้ `STYLE_PROMPT` ใน `gen_gemini_tts.py` (เช่น "ลึกลับ ทุ้มต่ำ" / "สนุก เร็ว")
เสียง shortlist แก้ที่ตัวแปร `SHORTLIST` — รายชื่อเต็ม 30 เสียง:
https://ai.google.dev/gemini-api/docs/speech-generation
