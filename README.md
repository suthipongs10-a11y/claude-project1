# claude-project1 — Viral Story Remix Pipeline

โปรเจกต์ทำคลิป YouTube Shorts แนว "Story Remix" (เล่าเรื่องใหม่จากเหตุการณ์ไวรัล) ด้วย pipeline อัตโนมัติ 7 Phases ทำงานร่วมกับ Claude Code

## โครงสร้าง

```
viral-story-remix.skill      # skill หลัก: 7 Phases (niche → research → outline → script → shotlist → voice → edit)
capcut-draft-editor.skill    # skill ตัดต่อ: แก้ draft_content.json ของ CapCut ตรงๆ
tts-ai/                      # งานแยก: ทำ TTS AI ใช้เอง (ไทย+อังกฤษ) — รวมเครื่องมือ โมเดล dataset + ตัวอย่างโค้ด (อ่าน tts-ai/README.md)
projects/
  2026-07-en-football/       # คลิป 1: "Why Is Speed CRYING Over Ronaldo?" (เสร็จ รอ export)
  2026-07-outdoorboys/       # คลิป 2: "The YouTuber Who Walked Away From 20M Subs" (เสร็จ รอ export)
    phase*.md                # ผลรีเสิร์ช/สคริปต์แต่ละ Phase (อ่านเพื่อทำต่อข้ามเซสชัน)
    elevenlabs/              # pipeline เสียง TTS (ต้องมี .env — ไม่อยู่ใน repo)
    assets/                  # กราฟิกการ์ด PNG + สคริปต์ gen
    capcut-shotlist.json     # ไฟล์ build timeline
    capcut-captions.json     # caption คำเด็ด
```

## แบ่งงาน: มือถือ (Claude Code cloud) vs PC

**ทำบนมือถือได้ (เมนู Code ใน app):** Phase 1-4 ทั้งหมด — รีเสิร์ชหัวข้อ/คนดัง, ขุด angle, เขียน outline+สคริปต์, แก้ segments.json, วางแผนคลิปถัดไป, แก้เอกสารทุกไฟล์

**ต้องทำบน PC (เครื่องที่มี CapCut):** โหลดฟุตเทจ (yt-dlp), gen เสียง (ElevenLabs — .env อยู่เครื่องนี้), build CapCut draft, review + export

## เสียงพากย์ประจำช่อง (TTS) — ใช้ได้จากทุกโปรเจกต์

เสียงประจำช่อง = **OmniVoice-Thai + เสียงโคลน** (โปรไฟล์กลาง: `tts-ai/voice_profile.json` / เสียงอ้างอิง: `tts-ai/tests/ref/`) — ผ่านการทดสอบฟังเทียบแล้ว 2 รอบ ดูผลที่ `tts-ai/tests/README.md`

**วิธีสั่งเสียงจากโปรเจกต์ไหนก็ได้ (สำหรับ Claude ทุกเซสชัน):**
1. เขียนสคริปต์คลิปเสร็จ → สร้างไฟล์งาน `tts-ai/voice-jobs/<ชื่อคลิป>.json` รูปแบบ: `{"job": "...", "segments": [{"id": "s01_hook", "text": "..."}]}` (ดูตัวอย่าง `example-job.json`) → commit + push
2. เจ้าของช่องเปิด `tts-ai/colab_voice_worker.ipynb` บน Colab (T4 GPU) → Run all → ได้ zip เสียงทุก segment + `timing.json` (ความยาวต่อไฟล์ พร้อมใช้วางไทม์ไลน์ CapCut)
3. ทางเลือกบนเครื่องที่มี GPU: `python tts-ai/generate_voice.py --segments <ไฟล์> --outdir <โฟลเดอร์>`

กติกา: ข้อความต้องผ่าน `normalize_th.py` เสมอ (worker/generate_voice ทำให้อัตโนมัติ) และห้ามแก้ `voice_profile.json` โดยไม่อัป `voice_version`

## เริ่มงานต่อในเซสชันใหม่

บอก Claude ว่า: "อ่าน README + projects/<ชื่อโปรเจกต์>/phase ล่าสุด แล้วทำต่อ" — ทุก Phase มี checkpoint บันทึกไว้ในไฟล์ .md ครบ
