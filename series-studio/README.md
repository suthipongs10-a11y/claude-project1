# Series Studio

เครื่องมือสร้างละครสั้น/ซีรีส์ด้วย AI — Claude เป็นผู้กำกับผ่าน MCP, เจนวิดีโอผ่าน Google Flow (manual หรือ Chrome Extension)
อ่าน `SPEC.md` (แหล่งความจริง), `CLAUDE.md` (วิธีทำงาน), `PROGRESS.md` (สถานะล่าสุด)

## เริ่มใช้งาน

```bash
cd series-studio
pnpm i
pnpm build          # ต้อง build ก่อนให้ Claude Desktop เรียก
pnpm test           # build + vitest
```

QC worker (Python ≥ 3.11 + ffmpeg ในเครื่อง) — ติดตั้งเฉพาะที่ต้องใช้ เช็กที่ไม่มีไลบรารีจะถูก "ข้าม" ไม่ใช่ล้มเหลว:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install pytest                                   # รันเทสต์: python -m pytest -q workers
pip install 'faster-whisper' 'av<16'                 # เช็กบทพูด (native mode) — ทดสอบแล้วกับ model small ภาษาไทย
pip install insightface onnxruntime 'opencv-python-headless<5' numpy   # หน้าตัวละคร (live action) + นับคน (OpenCV 4 มี HOGDescriptor)
pip install open_clip_torch torch pillow             # หน้าตัวละคร (การ์ตูน/อนิเมะ)
```

ตั้ง path ของ python/ffmpeg ได้ใน `config/local.json` → `tools` (เช่น `.venv/bin/python` หรือบน Windows `.venv\\Scripts\\python.exe`) · ค่าเริ่มต้น `python3` จะถูกแปลงเป็น `py`/`python` ให้เองบน Windows · ฟอนต์ไทยสำหรับการ์ด/ซับแนบมาใน `fonts/` (Sarabun, OFL) ไม่ต้องติดตั้งเพิ่ม

เสียงพากย์/บรรยาย (M7): ตั้ง `voice.provider` เป็น `cartesia` ใน `config/local.json` และตั้ง env `CARTESIA_API_KEY` ตอนรัน server (ห้ามใส่ key ในไฟล์ repo) · `mock` ใช้ทดสอบจังหวะแบบออฟไลน์ · `list_voices` → `assign_voice` ต่อตัวละคร (หรือ NARRATOR) → `dub_episode` → `assemble` จะใช้ voice track อัตโนมัติ

`claude_desktop_config.json` (แก้ path ให้เป็นของเครื่องคุณ):

```json
{ "mcpServers": { "series-studio": { "command": "node", "args": ["/ABS/PATH/series-studio/apps/server/dist/mcp.js"] } } }
```

เปิด Claude Desktop ใหม่ แล้วลองพิมพ์ "list styles" — ควรเห็น tool `list_styles` ตอบกลับ 11 สไตล์

## Dashboard (มือถือ/เว็บ)

server เปิด HTTP+WS ที่ `127.0.0.1:8787` พร้อม MCP อัตโนมัติ (ปิดได้ด้วย `http.enabled=false`) — ขอลิงก์พร้อม token จาก Claude ด้วย tool `dashboard_info`
หน้าจอ: รายการซีรีส์ + wizard, Bible board (ล็อก/ปลดล็อก), kanban ตอน, shot grid (QC badge, เจนใหม่, ผ่าน/ไม่ผ่าน), review player (อนุมัติ G3/G4, คอมเมนต์ตามเวลา → fix notes), คิว/เครดิต, ตั้งค่า
ใช้บนมือถือ: ทำ tunnel ไปที่ 127.0.0.1:8787 (เช่น `tailscale serve 8787` หรือ `ssh -L 8787:127.0.0.1:8787 user@pc`) แล้วเปิดลิงก์เดียวกัน · dev: `pnpm dev:dashboard` (Vite proxy ไป server)

## โครง

```
packages/core/     zod schemas (source of truth), validator, prompt compiler, state machine
apps/server/       MCP (stdio) + file store + SQLite job queue + HTTP/WS API (127.0.0.1 + token)
apps/dashboard/    PWA (Vite + React + Tailwind) เสิร์ฟจาก server ที่ /
apps/extension/    Chrome MV3 ขับ Google Flow (engine flow_ext) — ดู apps/extension/README.md
config/flow-selectors.json  selector ของ Flow แก้ได้ไม่ต้อง build
presets/styles/    style presets (*.json) เพิ่มได้โดยไม่แก้โค้ด
config/studio.json ทุกค่าที่ห้าม hardcode (maxClipSec, QC threshold, port) · override ด้วย config/local.json
projects/          ข้อมูลซีรีส์ (gitignore) · logs/ JSON lines · data/ SQLite
```

## ลองเล่นทันที
`pnpm demo` สร้างซีรีส์ตัวอย่างภาษาไทย 3 ตอนผ่าน MCP server ตัวจริง จากนั้น `pnpm --filter @series-studio/server exec tsx scripts/seed-episode1.ts` ทำตอนที่ 1 จนถึงไฟล์จบ (คลิปสังเคราะห์แทน Flow, `DEMO_TTS=cartesia` ถ้ามี key) และ `pnpm --filter @series-studio/dashboard exec tsx scripts/screenshots.ts` ถ่ายหน้าจอ dashboard ทุกหน้า

## สถานะ
M0–M8 โค้ดครบและเทสต์ผ่าน (`pnpm test` 137 ข้อ รวม e2e ของ extension จริงใน Chromium, `pnpm test:py` 9 ข้อ) · สิ่งที่ต้องทดสอบบนเครื่องจริง: Claude Desktop เห็น tools, มือถือเปิด dashboard ผ่าน tunnel, Chrome Extension กับหน้า Flow จริง (ปรับ `config/flow-selectors.json`), QC ที่ติดตั้ง whisper/insightface, TTS Cartesia ด้วย key ของคุณ — ดูรายละเอียดใน `PROGRESS.md`

## Flow การใช้งานจากแชท

1. `plan_series` (MCP prompt) หรือสั่งเอง: `list_styles` → `create_series` → `write_bible` → `write_outline` ทุกตอน → ผู้ใช้อนุมัติ → `approve_gate G1`
2. `gen_reference` ต่อ asset → เอา prompt ไปเจนใน Flow → `import_refs` → ดูภาพ → `lock_asset` → `approve_gate G2`
3. ต่อตอน: `write_script` → `write_shots` → `compile_prompts` → `generate` → `export_prompt_sheet` → เจนใน Flow → `import_clips` → `run_qc` → `get_keyframes`/`review_shot`/`regen_shot` → `approve_gate G3` → (`dub_episode` สำหรับ preset dub/narration) → `assemble` → `approve_gate G4` → `update_continuity` ก่อนเริ่มตอนถัดไป
4. โหมด flow_ext: ติดตั้ง `apps/extension` จับคู่ token แล้ว `generate` จะส่งงานให้ extension เอง (`extension_status`, `sync_flow_characters`) · product mode: ใส่ `product` ตอน `create_series`, ตอนที่กำหนดต้องมี outline beat และช็อต `bridge` ที่มีสินค้าใน `props` การ์ดสินค้า+ป้ายโฆษณาใส่อัตโนมัติ · `cost_report` ดูเครดิตเทียบ baseline
