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

`claude_desktop_config.json` (แก้ path ให้เป็นของเครื่องคุณ):

```json
{ "mcpServers": { "series-studio": { "command": "node", "args": ["/ABS/PATH/series-studio/apps/server/dist/mcp.js"] } } }
```

เปิด Claude Desktop ใหม่ แล้วลองพิมพ์ "list styles" — ควรเห็น tool `list_styles` ตอบกลับ 11 สไตล์

## โครง

```
packages/core/     zod schemas (source of truth), validator, prompt compiler, state machine
apps/server/       MCP (stdio) + file store + SQLite job queue (+ HTTP/WS ใน M5)
presets/styles/    style presets (*.json) เพิ่มได้โดยไม่แก้โค้ด
config/studio.json ทุกค่าที่ห้าม hardcode (maxClipSec, QC threshold, port) · override ด้วย config/local.json
projects/          ข้อมูลซีรีส์ (gitignore) · logs/ JSON lines · data/ SQLite
```

## Flow การใช้งานจากแชท

1. `plan_series` (MCP prompt) หรือสั่งเอง: `list_styles` → `create_series` → `write_bible` → `write_outline` ทุกตอน → ผู้ใช้อนุมัติ → `approve_gate G1`
2. `gen_reference` ต่อ asset → เอา prompt ไปเจนใน Flow → `import_refs` → ดูภาพ → `lock_asset` → `approve_gate G2`
3. ต่อตอน (M2+): `write_script` → `write_shots` → `compile_prompts` → `export_prompt_sheet` → เจน → `import_clips` → `run_qc` → `approve_gate G3` → `assemble` → `approve_gate G4`
