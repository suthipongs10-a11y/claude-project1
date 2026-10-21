# CLAUDE.md — Series Studio

อ่าน `SPEC.md` ก่อนเริ่มงานทุกครั้ง SPEC คือแหล่งความจริง ถ้าโค้ดกับ SPEC ขัดกัน ให้หยุดแล้วถาม

## วิธีทำงาน (Milestone-gated)
- ทำทีละ milestone ตาม SPEC §13 ห้ามเริ่ม milestone ถัดไปจนกว่าผู้ใช้จะยืนยันว่าผ่านเกณฑ์
- เริ่ม milestone: สรุปแผน + ไฟล์ที่จะสร้าง/แก้ → รอ OK
- จบ milestone: รันเทสต์ + เดโมตามเกณฑ์ผ่าน → รายงานสั้นๆ ว่าผ่านข้อไหน ข้อไหนยัง
- บันทึกความคืบหน้าใน `PROGRESS.md` (milestone, สิ่งที่ทำ, ปัญหาค้าง)

## สถานะปัจจุบัน
- Milestone: **M0**
- Engine ที่ใช้: `manual` (flow_ext เริ่ม M6)

## โครง repo
```
packages/core/        zod schemas, prompt compiler, validator, state machine
apps/server/          MCP (stdio) + Fastify + ws + SQLite job queue
apps/extension/       Chrome MV3 Flow driver
apps/dashboard/       Vite React PWA
apps/assembler/       Remotion templates + ffmpeg
workers/qc/           Python: whisper, scdet, similarity
presets/styles/       style presets (*.json)
projects/             ข้อมูลซีรีส์ (gitignore)
```

## กฎสำคัญ
1. **Schemas ใน `packages/core` คือ source of truth** — แก้ schema ก่อน แล้วค่อยแก้ส่วนอื่น ทุก input ของ MCP tool ต้อง validate ด้วย zod
2. **Prompt compiler ต้อง deterministic** — input เดิมได้ prompt เดิมทุกตัวอักษร มี snapshot test ห้ามเรียก LLM ใน compiler
3. **Validator เป็นโค้ด ไม่ใช่ AI** (แกน 180°, purpose, เวลา, continuity)
4. **ห้าม hardcode** ความยาวคลิปสูงสุดของ engine, selector ของ Flow, threshold QC → อยู่ใน config ทั้งหมด
5. **ไฟล์ ref ที่ lock แล้วห้ามเขียนทับ** — เพิ่มเวอร์ชันใหม่เท่านั้น
6. **ห้ามลบไฟล์ใน `projects/`** — ย้ายไป `_trash/` แทน
7. Server bind แค่ `127.0.0.1` + token สำหรับ extension/dashboard
8. ไม่เก็บรหัสผ่าน/คุกกี้ของ Google ในไฟล์ใดๆ
9. Extension: ทำทีละงาน, หน่วงเวลาสุ่ม, เจอหน้าที่ไม่รู้จัก → หยุดและแจ้ง ห้ามเดา
10. Preset/prompt ห้ามมีชื่อคนจริง, ดารา, ตัวละครหรือสตูดิโอที่มีลิขสิทธิ์

## มาตรฐานโค้ด
- TypeScript strict, ESM, pnpm
- เทสต์: vitest (TS), pytest (Python) — ทุก validator และ compiler ต้องมีเทสต์
- ข้อความ UI และ error ที่ผู้ใช้เห็น = ภาษาไทย, โค้ด/คอมเมนต์ = อังกฤษ
- log เป็น JSON lines ใน `logs/`
- ไม่เพิ่ม dependency ใหญ่โดยไม่ถามก่อน (คุมต้นทุนและความง่าย)

## คำสั่ง
```
pnpm i
pnpm dev:server        # MCP + HTTP
pnpm dev:dashboard
pnpm test
python -m workers.qc.run --episode <path>
```

## การต่อเข้า Claude Desktop
`claude_desktop_config.json`:
```json
{ "mcpServers": { "series-studio": { "command": "node", "args": ["apps/server/dist/mcp.js"] } } }
```

## เมื่อไม่แน่ใจ
ถามผู้ใช้สั้นๆ 1 คำถาม พร้อมตัวเลือกที่แนะนำ อย่าเดาในเรื่องที่ย้อนกลับยาก
