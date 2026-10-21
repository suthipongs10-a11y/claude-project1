# PROGRESS — Series Studio

> อัปเดตทุกครั้งที่เริ่ม/จบ milestone ตามวิธีทำงานใน `CLAUDE.md` · เกณฑ์ผ่านแต่ละ milestone อยู่ใน `SPEC.md` §13

## สถานะปัจจุบัน

- Milestone: **M7** กำลังทำ (M0–M6 โค้ดเสร็จ เทสต์ผ่าน · M6 ต้องให้ผู้ใช้ทดสอบกับ Flow จริงและปรับ selectors) · **ใช้ผลิตงานจริงได้แล้วในโหมด manual**
- Engine ที่ใช้: `manual` (flow_ext เริ่ม M6)
- อัปเดตล่าสุด: 2026-10-21

## ตาราง Milestone

| M | งาน | เกณฑ์ผ่าน (ย่อ) | สถานะ |
|---|---|---|---|
| M0 | Monorepo, zod schemas, file store, MCP server เปล่า | Claude Desktop เห็นและเรียก `list_styles` ได้ | ✅ โค้ด+เทสต์ผ่าน (stdio) · รอยืนยันบน Claude Desktop |
| M1 | Series/Bible/Outline tools + 11 style presets + validator | สร้างซีรีส์ทดลอง 3 ตอนจากแชท ได้ไฟล์ครบตาม §6 | ✅ โค้ด+เทสต์ผ่าน (เทสต์ e2e ผ่าน MCP client) · รอผู้ใช้ลองจากแชทจริง |
| M2 | Script + Shot breakdown + Prompt compiler + export prompt sheet + import_clips | เจนใน Flow เองแล้ว import กลับ map ถูกช็อต | ✅ โค้ด+เทสต์ผ่าน (e2e: script→shots→prompts→sheet→import) · รอผู้ใช้ลองกับ Flow จริง |
| M3 | QC workers + get_keyframes + regen loop | จับช็อตพังที่ใส่ไว้ทดสอบได้ ≥ 80% | ✅ โค้ด+เทสต์ผ่าน (คลิปพังสังเคราะห์ 4 แบบ จับได้ 100%) · whisper/insightface ต้องติดตั้งเองบน PC |
| M4 | Assembly: loudnorm, SRT, Remotion cards, export 9:16/16:9 | ไฟล์ final 1 ตอน เสียงเท่ากัน ซับตรง ±0.2s | ✅ โค้ด+เทสต์ผ่าน (−14 LUFS ±1.5, ซับตรงเวลา timeline, 1080×1920 H.264) · การ์ดใช้ ffmpeg drawtext แทน Remotion (ดูหมายเหตุ) |
| M5 | Dashboard PWA + approve gates | อนุมัติ G1–G4 จากมือถือได้ | ✅ โค้ด+เทสต์ผ่าน (Playwright viewport มือถือ กด G1→G4 ครบ) · รอผู้ใช้ลองบนมือถือจริงผ่าน tunnel |
| M6 | Chrome Extension flow_ext + Flow Characters | เจน 1 ตอนโดยไม่แตะ Flow เอง | 🟡 โค้ด+เทสต์โปรโตคอลผ่าน (extension จำลอง) · **ต้องทดสอบกับ Flow จริง + ปรับ `config/flow-selectors.json`** |
| M7 | Voice modes (dub/narration) + voice adapter | เสียงตัวละครเดิมทุกคลิป | 🔧 กำลังทำ |
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

### 2026-10-21 — M2 เสร็จ
- core: ตัวนับพยางค์ไทยแบบประมาณ (state machine ไม่ใช้ dictionary, เทสต์กับคำตัวอย่าง 30+ คำ), `validateScript` (ตัวละคร/ฉากต้องมีใน bible, ประมาณเวลาพูดจากพยางค์ เตือนเมื่อเกิน), `validateShots` (purpose, hook แรก/cliffhanger ท้าย, แกน 180° ต้องมี INSERT คั่นหรือ `axis_cross_reason`, ตัวละคร/ฉาก/time ตรง bible, wardrobe ตรง continuity ตอนแรกที่เห็น, บทพูดไม่ซ้อน/ไม่ล้นช็อต/ไม่เร็วเกิน, ช็อตไม่เกิน maxClipSec, เวลารวม ±5%), `planBatches` (รวมช็อตฉากเดียวกันไม่เกิน maxClipSec), `compileBatchPrompt` แบบ deterministic ตาม template §8.5 รองรับ native/dub/narration/sfx_only, wardrobe variant, continuity carry-over, style_override, [FIX] notes + snapshot test
- server: `ManualEngine` adapter + registry, `EpisodeService` (write_script, write_shots, compile_prompts (ต้องผ่าน G2), export_prompt_sheet .md/.csv, generate → jobs + cost.json, import_clips จับคู่ไฟล์ด้วย job id / batch id / shot id / ลำดับ → `gen/<batch>/vN.mp4` + pointer `gen/<shot>/vN.json`), state ตอนเดินตาม state machine
- MCP tools ใหม่: `write_script`, `write_shots`, `compile_prompts`, `export_prompt_sheet`, `generate`, `job_status`, `import_clips` · prompt `breakdown_episode`
- เทสต์ 92 ข้อผ่าน
- หมายเหตุ: คลิป 1 ไฟล์ = 1 batch (หลายช็อต) — QC ใน M3 ใช้ scdet ตรวจจุดตัดเทียบ shot list และตัดช็อตย่อยตาม offset ที่วางไว้

### 2026-10-21 — M3 เสร็จ
- `workers/qc/` (Python, stdlib + ffmpeg เท่านั้นสำหรับเช็กหลัก): `duration` (ffprobe ±tolerance), `cuts` (scdet เทียบจำนวนช็อตใน batch ±1, debounce 0.25s), `black` (blackdetect), `freeze` (freezedetect) map ลงช็อตตาม offset, keyframe 3 เฟรม/ช็อต; เช็กเสริมแบบ optional: `dialogue` (faster-whisper + CER ไทย เฉพาะ native), `identity` (insightface สำหรับ live / open_clip สำหรับการ์ตูน), `people` (OpenCV HOG), `text` (tesseract) — ไม่มีไลบรารี = skipped ไม่ใช่ fail
- สัญญา request/response เป็น JSON (server เขียน `qc/_request.json` → worker พิมพ์รายงาน stdout) ทำให้ worker ไม่ต้องรู้โครงโปรเจกต์ · CLI `python -m workers.qc.run --request|--episode`
- server: `QcService` (สร้าง request จาก gen pointers + bible refs + threshold ของ config/preset, รัน worker, เขียน `qc/<shot>.json` ตาม schema, เก็บ review เดิมถ้าเวอร์ชันเดิม), `fixNotesFromReasons` แปลงเหตุผลที่ fail เป็น [FIX] แบบ deterministic, regen bounded ด้วย `qc.max_regen_attempts`, keyframes ผ่าน ffmpeg
- MCP tools: `run_qc` (+auto_regen), `get_keyframes` (ส่งภาพ JPEG ให้ Claude ดู), `review_shot` (pass/fail override สำหรับ G3), `regen_shot` · prompt `fix_failed_shots`
- เทสต์: pytest 9 ข้อ (คลิปสังเคราะห์: สั้น/ดำ/ค้าง/ตัดเกิน จับได้ 4/4) + vitest e2e M3 (QC → keyframes → review → regen → import take 2 → QC ผ่าน → G3) รวม 97 ข้อผ่าน
- หมายเหตุ: `tools.python` ใน config ตั้งเป็น `python3` ถ้าใช้ venv ให้ชี้ `config/local.json` ไป `.venv/bin/python`

### 2026-10-21 — M4 เสร็จ
- `AssemblyService` (ffmpeg อย่างเดียว): ต่อคลิปตาม batch บน timeline (trim ตามที่วาง, pad/scale เป็น 1080×1920 หรือ 1920×1080, คลิปไม่มีเสียงเติม silence), การ์ดชื่อเรื่อง/ตอน, การ์ด "ตอนต่อไป" (ดึงชื่อตอนถัดไปจาก outline), การ์ดสินค้าในตอนที่มี bridge, ป้าย "เนื้อหานี้สร้างด้วย AI" ทั้งคลิป, ป้าย "โฆษณา" ใน product mode, SRT จากเวลาบทพูดบน timeline + เบิร์นด้วย libass ตาม `subtitle_style` ของ preset (map เป็น ASS force_style), เสียง: clip audio หรือ voice_track (dub/narration) + เพลงประกอบแบบ ducking (sidechaincompress), loudnorm 2 pass เป้า −14 LUFS, ปกจากกลางช็อต cliffhanger, `edit/timeline_<quality>.json` (schema `Timeline` ใน core)
- MCP tool `assemble` (draft = preview ครึ่งขนาดใน edit/ ไม่ต้องผ่าน G3, final = ต้องผ่าน G3 → `final/epNN_9x16.mp4` + `.srt` + `_cover.jpg`) · G4 ตรวจว่ามีไฟล์ final แล้ว
- config `assembly.*` เพิ่ม fps/crf/preset/font/ความยาวการ์ด/ระดับเพลง — ฟอนต์ไทยตั้งได้ (`subtitle_font`, `card_font`; default "Noto Sans Thai")
- เทสต์ e2e M4: ประกอบจริงด้วย ffmpeg → วัดได้ −14 LUFS ±1.5, ซับตรงเวลาที่คาด ±0.2s, ความยาว 25s, H.264 1080×1920, และ 16:9 + เพลง + voice track · รวม 101 ข้อผ่าน
- **หมายเหตุ/ขอตัดสินใจ**: SPEC ระบุ Remotion สำหรับการ์ด แต่ Remotion เป็น dependency ใหญ่ (React + Chromium render) จึงทำการ์ดด้วย ffmpeg drawtext ไว้ก่อน (ใช้งานได้จริง) ถ้าต้องการการ์ดสวยแบบ Remotion ค่อยเพิ่มเป็น adapter ใน `apps/assembler` ภายหลัง

### 2026-10-21 — M5 เสร็จ
- server: Fastify HTTP + WS บน `127.0.0.1:8787` (รันคู่กับ MCP ใน process เดียว, ปิดได้/ถ้า port ชน MCP ยังทำงาน), token จับคู่ใน `data/token.txt` (Bearer/X-Studio-Token/?token=), REST: styles, series (list/create/summary/bible), lock/unlock, gates check/approve (via=dashboard), episode detail (shots+qc+gen pointers+frames+jobs+previews+finals+comments+timeline), review/regen/qc/assemble/comments/export, jobs, settings (เขียน `config/local.json` + live-apply threshold), `/files/<series>/...` เสิร์ฟสื่อในโปรเจกต์ (กัน path traversal), WS `/ws` ส่ง change events จาก event bus ใน context · tool `dashboard_info`
- dashboard: Vite + React 19 + Tailwind 4 PWA (manifest + service worker เขียนเอง ไม่เพิ่ม dep), hash router, mobile-first bottom nav, หน้าจอครบ 7: Series list, wizard (ไอเดีย→สไตล์→อัตราส่วน→ตอน), Bible board (ภาพ ref + ล็อก/ปลดล็อก), Episode kanban, Shot grid (keyframe + QC badge เขียว/แดง + เจนใหม่ + ผ่าน/ไม่ผ่าน), Review player (วิดีโอ preview/final, อนุมัติ G3/G4, ประกอบไฟล์จบ, export, คอมเมนต์ตามเวลา → เจนซ่อม), Queue & Cost, Settings (engine, QC threshold, เสียง/ประกอบ, export dir, tools, token)
- เทสต์: HTTP API 6 ข้อ (auth, wizard, gate จาก dashboard, episode/review/regen/comments/G3/G4/export, settings, WS) + Playwright smoke บน viewport มือถือ (390×844) กดอนุมัติ G1→G2 (ล็อก asset จากหน้า Bible) และ G3→ประกอบไฟล์จบ→G4 จริงผ่าน UI · รวม 109 ข้อผ่าน
- ข้อจำกัด: server bind 127.0.0.1 ตามกฎ → มือถือต้องผ่าน tunnel (Tailscale/ssh) · การตั้งค่า engine/tools ต้องรีสตาร์ท

### 2026-10-21 — M6 เสร็จ (รอทดสอบกับ Flow จริง)
- core: schema โปรโตคอล extension (`ExtJobPayload`, `ExtClientMessage`, `FlowSelectors`), job kind `character`, status `blocked`
- server: `ExtensionBridge` (extension 1 ตัว ทำทีละงาน, dispatch งาน `flow_ext` ตามลำดับ, timeout ต่องานจาก config, `blocked` = หยุดทั้งคิวจน resume, extension หลุดกลางงาน → requeue), `FlowExtEngine` adapter, endpoints `/api/ext/status|selectors|resume|jobs/:id/cancel|jobs/:id/result` (อัปโหลดไฟล์ดิบ → เก็บเป็น gen/<batch>/vN.mp4 หรือ ref ของ asset), WS role=extension, MCP tools `extension_status` (+resume) และ `sync_flow_characters` (สร้าง Character ใน Flow แล้วเก็บ `flow_character_id`)
- `config/flow-selectors.json`: selector ของ Flow แยกจากโค้ด (รองรับ `:has-text('…')`) server เสิร์ฟให้ extension โหลดทุกงาน
- `apps/extension/` (MV3, ไม่มี build step): `sw.js` (WS ไป 127.0.0.1 + alarms keepalive, งานทีละงาน, หา/เปิดแท็บ Flow, inject, อัปโหลดผล), `driver.js` (ลอจิกขับ UI แบบทดสอบได้: ตรวจหน้า→ตั้ง aspect/quality→แนบ ref→วาง prompt→เจน→รอผล→ดาวน์โหลด; หน่วงสุ่มก่อนทุกแอ็กชัน; ไม่พบ selector → BlockedError ไม่เดา), `content.js` (DOM adapter), popup จับคู่ token/port, README
- dashboard: หน้า Queue แสดงสถานะ extension + ปุ่ม resume
- เทสต์: driver 5 ข้อ (happy path, blocked, failed, character, helpers) + bridge 5 ข้อ (คิวเมื่อไม่มี extension, dispatch ทีละงาน + อัปโหลด 3 batch → qc, blocked→resume→failed, sync characters, timeout/requeue) · รวม 119 ข้อผ่าน
- **ข้อจำกัดสำคัญ**: ไม่สามารถทดสอบกับ UI จริงของ Google Flow จากที่นี่ — selectors ใน `config/flow-selectors.json` เป็นค่าตั้งต้นที่ต้องปรับตามหน้าจริง (extension จะหยุดแบบปลอดภัยและบอกว่า selector ไหนไม่พบ) · ToS ของ Flow เป็นความรับผิดชอบของผู้ใช้ (SPEC §14)

## ปัญหาค้าง / ข้อสังเกต

- repo นี้มี `projects/` ที่ root ของงาน Viral Story Remix อยู่แล้ว → ข้อมูลซีรีส์ของ Series Studio จะอยู่ที่ `series-studio/projects/` แทน (ต้องเพิ่ม `.gitignore` ตอน M0)
- `.gitignore` ที่ root ignore `*.mp4` ทั้ง repo อยู่แล้ว ครอบคลุมคลิปที่เจนออกมา
- เกณฑ์ผ่าน M0 ("Claude Desktop เห็น `list_styles`") ต้องทดสอบบนเครื่องผู้ใช้ — ใน cloud session ทำได้แค่ unit test + smoke test ผ่าน stdio
- M3 (faster-whisper large-v3, insightface, ffmpeg) และ M6 (Chrome Extension + Flow) ต้องรันบน PC ของผู้ใช้
