# claude-project1

repo รวมโปรเจกต์ย่อย — แต่ละโฟลเดอร์แยกขาดจากกัน:

- **`web-lead-craft/`** — ธุรกิจรับทำเว็บไซต์ (แพ็กเกจ 990/1,990/4,990.-) — เว็บลูกค้า, เดโม่, เครื่องมือ build → อ่าน `web-lead-craft/README.md`
- **Viral Story Remix Pipeline** (ด้านล่าง) — ทำคลิป YouTube Shorts

---

## Viral Story Remix Pipeline

โปรเจกต์ทำคลิป YouTube Shorts แนว "Story Remix" (เล่าเรื่องใหม่จากเหตุการณ์ไวรัล) ด้วย pipeline อัตโนมัติ 7 Phases ทำงานร่วมกับ Claude Code

## โครงสร้าง

```
viral-story-remix.skill      # skill หลัก: 7 Phases (niche → research → outline → script → shotlist → voice → edit)
capcut-draft-editor.skill    # skill ตัดต่อ: แก้ draft_content.json ของ CapCut ตรงๆ
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

## เริ่มงานต่อในเซสชันใหม่

บอก Claude ว่า: "อ่าน README + projects/<ชื่อโปรเจกต์>/phase ล่าสุด แล้วทำต่อ" — ทุก Phase มี checkpoint บันทึกไว้ในไฟล์ .md ครบ
