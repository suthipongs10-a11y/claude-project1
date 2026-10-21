# PROGRESS — Series Studio

> อัปเดตทุกครั้งที่เริ่ม/จบ milestone ตามวิธีทำงานใน `CLAUDE.md` · เกณฑ์ผ่านแต่ละ milestone อยู่ใน `SPEC.md` §13

## สถานะปัจจุบัน

- Milestone: **M2** กำลังทำ (M0–M1 โค้ดเสร็จ เทสต์ผ่าน รอผู้ใช้ยืนยันบน Claude Desktop)
- Engine ที่ใช้: `manual` (flow_ext เริ่ม M6)
- อัปเดตล่าสุด: 2026-10-21

## ตาราง Milestone

| M | งาน | เกณฑ์ผ่าน (ย่อ) | สถานะ |
|---|---|---|---|
| M0 | Monorepo, zod schemas, file store, MCP server เปล่า | Claude Desktop เห็นและเรียก `list_styles` ได้ | ✅ โค้ด+เทสต์ผ่าน (stdio) · รอยืนยันบน Claude Desktop |
| M1 | Series/Bible/Outline tools + 11 style presets + validator | สร้างซีรีส์ทดลอง 3 ตอนจากแชท ได้ไฟล์ครบตาม §6 | ✅ โค้ด+เทสต์ผ่าน (เทสต์ e2e ผ่าน MCP client) · รอผู้ใช้ลองจากแชทจริง |
| M2 | Script + Shot breakdown + Prompt compiler + export prompt sheet + import_clips | เจนใน Flow เองแล้ว import กลับ map ถูกช็อต | 🔧 กำลังทำ |
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

### 2026-10-21 — M0 เสร็จ (ผู้ใช้สั่งลุยต่อทุก milestone ได้เลย)
- โครง pnpm monorepo: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` (strict, ESM NodeNext), `vitest.config.ts`, `.gitignore` (projects/, logs/, _trash/, config/local.json)
- `packages/core`: zod schemas ทั้งหมด (StylePreset, Series, Product, Character, Location, Prop, Voices, Outline, Script, Shot, ShotList, Batch, EpisodeState, Continuity, GenJob, QcResult, Cost), preset loader + ตรวจคำต้องห้าม (ชื่อสตูดิโอ/ตัวละครลิขสิทธิ์), state machine ตอน/ซีรีส์, `VideoEngine` interface, utility แปลง zod error เป็นข้อความไทย
- `apps/server`: `config/studio.json` (ทุก threshold, maxClipSec, port อยู่ที่นี่ + override ด้วย `config/local.json`), logger JSON lines ไป `logs/server.jsonl`, `FileStore` (โครง §6, เขียนแบบ atomic, ย้ายไป `_trash/` แทนลบ, ref ที่ lock เขียนทับไม่ได้ → เพิ่มเวอร์ชัน), MCP server stdio พร้อม tool `list_styles`
- `presets/styles/live_kdrama_dub.json` preset ตัวแรก
- เทสต์ 26 ข้อผ่าน (vitest) รวม smoke test ที่ spawn `node apps/server/dist/mcp.js` ผ่าน stdio แล้วเรียก `list_styles` ได้จริง
- **รอผู้ใช้ตรวจ**: เพิ่มใน `claude_desktop_config.json` ตาม CLAUDE.md แล้วดูว่า Claude Desktop เห็น `list_styles` (ต้อง `pnpm i && pnpm build` ก่อน)

### 2026-10-21 — M1 เสร็จ
- preset ครบ 11 แบบใน `presets/styles/` (ตรวจคำต้องห้ามอัตโนมัติทุกไฟล์ในเทสต์)
- core: `validateBible` (id ซ้ำ/ชนกัน, voices อ้างตัวละครที่ไม่มี, prop สินค้า, คำต้องห้าม + extra ต่อซีรีส์), `validateOutline` (hook แรก, cliffhanger ท้าย, bridge เฉพาะตอนสินค้า, เวลารวม ±tolerance), reference prompt compiler แบบ deterministic (snapshot test), `slugify`
- server: `JobStore` (SQLite `data/studio.sqlite`), `SeriesService`, `BibleService` (merge กับของเดิม, asset ที่ lock แก้ look ไม่ได้, import refs เป็นเวอร์ชัน `refs/vN/`, unlock = เพิ่มเวอร์ชัน), `GateService` (precondition ของ G1–G4 เป็นโค้ด)
- MCP tools: `list_series`, `create_series`, `get_series`, `write_bible`, `gen_reference`, `import_refs`, `lock_asset`, `unlock_asset`, `write_outline`, `check_gate`, `approve_gate` · resources `series://<id>/series|bible`, `series://<id>/ep/<n>/outline|script|shots` · prompt `plan_series`
- เทสต์ 57 ข้อผ่าน รวม e2e สร้างซีรีส์ 3 ตอน → bible → outline → G1 → refs → lock → G2 แล้วเช็กโครงไฟล์ตาม §6
- หมายเหตุ: `import_refs` ยังไม่ตรวจคนในภาพฉาก (person detector มาใน M3) — tool เตือนให้ดูด้วยตาก่อน lock

## ปัญหาค้าง / ข้อสังเกต

- repo นี้มี `projects/` ที่ root ของงาน Viral Story Remix อยู่แล้ว → ข้อมูลซีรีส์ของ Series Studio จะอยู่ที่ `series-studio/projects/` แทน (ต้องเพิ่ม `.gitignore` ตอน M0)
- `.gitignore` ที่ root ignore `*.mp4` ทั้ง repo อยู่แล้ว ครอบคลุมคลิปที่เจนออกมา
- เกณฑ์ผ่าน M0 ("Claude Desktop เห็น `list_styles`") ต้องทดสอบบนเครื่องผู้ใช้ — ใน cloud session ทำได้แค่ unit test + smoke test ผ่าน stdio
- M3 (faster-whisper large-v3, insightface, ffmpeg) และ M6 (Chrome Extension + Flow) ต้องรันบน PC ของผู้ใช้
