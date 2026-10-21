# PROGRESS — Series Studio

> อัปเดตทุกครั้งที่เริ่ม/จบ milestone ตามวิธีทำงานใน `CLAUDE.md` · เกณฑ์ผ่านแต่ละ milestone อยู่ใน `SPEC.md` §13

## สถานะปัจจุบัน

- Milestone: **M0** — ยังไม่เริ่มโค้ด (รอผู้ใช้ OK แผน M0 ก่อน)
- Engine ที่ใช้: `manual` (flow_ext เริ่ม M6)
- อัปเดตล่าสุด: 2026-10-21

## ตาราง Milestone

| M | งาน | เกณฑ์ผ่าน (ย่อ) | สถานะ |
|---|---|---|---|
| M0 | Monorepo, zod schemas, file store, MCP server เปล่า | Claude Desktop เห็นและเรียก `list_styles` ได้ | ⏳ รอ OK แผน |
| M1 | Series/Bible/Outline tools + 11 style presets + validator | สร้างซีรีส์ทดลอง 3 ตอนจากแชท ได้ไฟล์ครบตาม §6 | ยังไม่เริ่ม |
| M2 | Script + Shot breakdown + Prompt compiler + export prompt sheet + import_clips | เจนใน Flow เองแล้ว import กลับ map ถูกช็อต | ยังไม่เริ่ม |
| M3 | QC workers + get_keyframes + regen loop | จับช็อตพังที่ใส่ไว้ทดสอบได้ ≥ 80% | ยังไม่เริ่ม |
| M4 | Assembly: loudnorm, SRT, Remotion cards, export 9:16/16:9 | ไฟล์ final 1 ตอน เสียงเท่ากัน ซับตรง ±0.2s | ยังไม่เริ่ม |
| M5 | Dashboard PWA + approve gates | อนุมัติ G1–G4 จากมือถือได้ | ยังไม่เริ่ม |
| M6 | Chrome Extension flow_ext + Flow Characters | เจน 1 ตอนโดยไม่แตะ Flow เอง | ยังไม่เริ่ม |
| M7 | Voice modes (dub/narration) + voice adapter | เสียงตัวละครเดิมทุกคลิป | ยังไม่เริ่ม |
| M8 | Product mode + continuity ข้ามตอน + cost report | ซีรีส์ 10 ตอนจบ ไม่พลาดชุด/แผลข้ามตอน | ยังไม่เริ่ม |

> ใช้ผลิตงานจริงได้ตั้งแต่ M4 (โหมด manual)

## บันทึกการทำงาน

### 2026-10-21 — ตั้งโฟลเดอร์โปรเจกต์
- สร้าง `series-studio/` แยกจากงาน Viral Story Remix ที่อยู่ใน repo เดิม
- นำเข้า `SPEC.md` และ `CLAUDE.md` (เวอร์ชันที่ผู้ใช้ส่งมา ไม่แก้ไข) และสร้างไฟล์นี้
- ยังไม่ได้เริ่มโค้ด M0

## ปัญหาค้าง / ข้อสังเกต

- repo นี้มี `projects/` ที่ root ของงาน Viral Story Remix อยู่แล้ว → ข้อมูลซีรีส์ของ Series Studio จะอยู่ที่ `series-studio/projects/` แทน (ต้องเพิ่ม `.gitignore` ตอน M0)
- `.gitignore` ที่ root ignore `*.mp4` ทั้ง repo อยู่แล้ว ครอบคลุมคลิปที่เจนออกมา
- เกณฑ์ผ่าน M0 ("Claude Desktop เห็น `list_styles`") ต้องทดสอบบนเครื่องผู้ใช้ — ใน cloud session ทำได้แค่ unit test + smoke test ผ่าน stdio
- M3 (faster-whisper large-v3, insightface, ffmpeg) และ M6 (Chrome Extension + Flow) ต้องรันบน PC ของผู้ใช้
