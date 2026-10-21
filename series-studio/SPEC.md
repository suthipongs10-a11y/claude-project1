# SPEC — Series Studio (เครื่องมือสร้างละครสั้น/ซีรีส์ด้วย AI)

> เวอร์ชัน 1.0 · ภาษาหลักของ UI: ไทย · ผู้กำกับ: Claude (ผ่าน MCP) · เครื่องเจนหลัก: Google Flow (ผ่าน Chrome Extension)

---

## 1. เป้าหมาย

สร้างละครสั้น / ซีรีส์แนวตั้ง (หรือแนวนอน) ได้ทั้งซีซัน โดย
- **ต่อเนื่องแบบหนัง**: ตัวละคร ฉาก และของสำคัญหน้าตาเหมือนเดิมทุกช็อตทุกตอน
- **เลือกสไตล์ได้**: คนแสดงจริง (ไทย/เกาหลี/ฝรั่ง/จีน), การ์ตูน 2D, 3D, อนิเมะ, เว็บตูน, ตัวเส้นหมึก ฯลฯ
- **ใช้ง่าย**: ผู้ใช้กดอนุมัติแค่ 4 จุด (Gate) ที่เหลือระบบกับ Claude ทำให้
- **คุมต้นทุน**: เจนผ่าน Flow ไม่ใช้ API แพง, ร่าง 480p ก่อน, เจนใหม่เฉพาะช็อตที่พัง

### ไม่อยู่ในขอบเขต v1
- ระบบหลายผู้ใช้ / เก็บเงิน (ทำตอนแปลงเป็น SaaS)
- ตัดต่อแบบ timeline ละเอียดในตัว (ส่งออกไป CapCut/Premiere ได้แทน)

---

## 2. ผู้ใช้และกรณีใช้งาน

| ผู้ใช้ | งาน |
|---|---|
| ครีเอเตอร์ทำช่องละครสั้น | ซีรีส์ 10–80 ตอน ตอนละ 1–3 นาที |
| รับทำละครขายสินค้า | 1–3 ตอน มีจังหวะ "สะพานสู่สินค้า" + การ์ดสินค้า |
| ช่องการ์ตูน / เด็ก | สไตล์การ์ตูน ใช้เสียงบรรยายหรือพากย์ |
| หนังสั้น | 16:9, 3–15 นาที |

---

## 3. Flow การใช้งาน (4 Gate)

```
[ไอเดีย] → Claude วาง Series Bible + เรื่องย่อทุกตอน ──► G1 อนุมัติเรื่อง
        → เจนภาพอ้างอิงตัวละคร/ฉาก/ของ ─────────────► G2 อนุมัติ Asset (ล็อก)
        → ต่อตอน: บท → ช็อต → prompt → เจน 480p → QC อัตโนมัติ → เจนซ่อม
                                              ──────► G3 อนุมัติดราฟต์ตอน
        → เจนตัวจริง (ถ้าต้อง) → ประกอบ เสียง ซับ การ์ด ─► G4 อนุมัติ + Export
```

ทุก Gate ทำได้ทั้งจากแชท Claude และจาก Dashboard (มือถือ)

---

## 4. ระบบสไตล์ (Style Presets)

สไตล์เป็นไฟล์ JSON ใน `presets/styles/` เพิ่มเองได้โดยไม่ต้องแก้โค้ด

### 4.1 Preset ตั้งต้น

| id | ชื่อ | โหมดเสียงตั้งต้น | หมายเหตุ |
|---|---|---|---|
| `live_thai_drama` | ละครไทย คนแสดงจริง | native (พูดไทยในโมเดล) | แสงอุ่น, ละครหลังข่าว/ละครเย็น |
| `live_kdrama_dub` | ละครเกาหลี พากย์ไทย | dub | โทนพาสเทล, ช็อตโคลสอัพเยอะ, ปากไม่ต้องตรง |
| `live_western` | หนังฝรั่ง | dub หรือ native-EN + ซับไทย | anamorphic, contrast สูง |
| `live_cdrama_period` | จีนย้อนยุค | dub | ชุดโบราณ, ฉากวัง |
| `live_thai_period` | ไทยย้อนยุค | native | ระวังความถูกต้องของชุด/สถานที่ |
| `anime` | อนิเมะ 2D | dub / narration | เส้นคม, เงาแบบ cel |
| `cartoon_2d_flat` | การ์ตูน 2D แบน | narration | สีสด, เหมาะช่องเด็ก |
| `cartoon_3d` | การ์ตูน 3D แบบหนังโรง | dub | ห้ามอ้างชื่อสตูดิโอจริงใน prompt |
| `webtoon_motion` | เว็บตูน/มังฮวาเคลื่อนไหว | narration + dub | panel-like framing |
| `ink_stick` | ตัวเส้นหมึก ขาวดำ | sfx / narration | ต่อยอดงานตัวเส้นที่มีอยู่ |
| `claymation` | ดินปั้น | dub | frame rate รู้สึก stop-motion |

### 4.2 โครง preset

```json
{
  "id": "live_kdrama_dub",
  "label": "ละครเกาหลี พากย์ไทย",
  "medium": "live_action",            // live_action | 2d | 3d | mixed
  "render_tokens": ["cinematic Korean drama", "soft pastel grade", "shallow depth of field"],
  "camera": {
    "lens_default": "50mm", "lens_closeup": "85mm",
    "aspect_modes": ["9:16", "16:9"],
    "movement_vocab": ["slow push-in", "static", "gentle dolly", "over-the-shoulder"]
  },
  "lighting": "motivated practical lights, soft key, warm rim",
  "grade": "lifted blacks, pastel skin tones",
  "acting": "restrained, lingering eye contact, reaction shots held 1–2s",
  "pacing": { "avg_shot_sec": 3.0, "cuts_per_30s": 8 },
  "dialogue_mode": "dub",             // native | dub | narration | sfx_only
  "dialogue_lang_in_model": "ko",     // ภาษาที่ให้โมเดลพูด (dub = พูดแล้วเอาไปทับ)
  "subtitle_style": "yellow_bold_bottom",
  "negative": ["text overlays", "watermark", "extra people in background", "logo"],
  "character_sheet": "front, 3/4, side, full body, 3 expressions",
  "location_sheet": "wide empty establishing, no people",
  "cliffhanger_style": "freeze on reaction + sting sfx"
}
```

### 4.3 กฎสไตล์
- 1 ซีรีส์ = 1 สไตล์หลัก (ห้ามสลับกลางเรื่อง ยกเว้นฉากฝัน/ย้อนอดีตที่กำหนด `style_override` ไว้ใน shot)
- ภาพอ้างอิงทุกชิ้นต้องเจนด้วย preset เดียวกับซีรีส์
- `negative` ใส่ในทุก prompt อัตโนมัติ

---

## 5. สถาปัตยกรรม

```
┌──────────────┐   MCP (stdio)   ┌─────────────────────────────┐
│ Claude Desktop│◄──────────────►│ studio-server (Node/TS)      │
│ / Claude Code │                │  • MCP tools                 │
└──────────────┘                 │  • Local HTTP + WS 127.0.0.1 │
                                 │  • Job queue                 │
┌──────────────┐   HTTP/WS       │  • Prompt compiler           │
│ Dashboard PWA │◄──────────────►│  • File store (projects/)    │
│ (มือถือ/เว็บ) │                └──────┬───────────┬──────────┘
└──────────────┘                        │ WS        │ spawn
                                ┌───────▼──────┐ ┌──▼──────────────┐
                                │ Chrome Ext   │ │ workers (Python)│
                                │ (Flow driver)│ │ ffmpeg, whisper │
                                └──────────────┘ │ similarity, QC  │
                                                 └─────────────────┘
                                ┌─────────────────┐
                                │ assembler       │ Remotion + ffmpeg
                                └─────────────────┘
```

### 5.1 Tech stack
- **Monorepo**: pnpm workspaces, TypeScript strict
- **packages/core**: zod schemas (source of truth), prompt compiler, state machine
- **apps/server**: `@modelcontextprotocol/sdk` (stdio), Fastify (HTTP) + ws, SQLite (better-sqlite3) เก็บ job/state, ไฟล์จริงอยู่ใน `projects/`
- **apps/extension**: Chrome MV3, content script + service worker
- **apps/dashboard**: Vite + React + Tailwind, PWA, เสิร์ฟจาก server
- **workers/qc**: Python 3.11, `faster-whisper` (large-v3, รองรับไทย), `ffmpeg`, `open_clip` (ความเหมือนภาพ), `insightface` (เฉพาะ live_action, ออปชัน)
- **apps/assembler**: Remotion (ใช้ pipeline ที่มีอยู่) + ffmpeg

### 5.2 Engine Adapter (เผื่อเปลี่ยนเครื่องเจน)

```ts
interface VideoEngine {
  id: string;                          // "flow_ext" | "veo_api" | "manual"
  maxClipSec: number;                  // อ่านจาก config ห้าม hardcode
  supportsRefImages: boolean;
  supportsNativeDialogue: boolean;
  submit(job: GenJob): Promise<JobHandle>;
  poll(h: JobHandle): Promise<JobStatus>;
  fetch(h: JobHandle, dest: string): Promise<string>;
}
```
- `manual` = ส่งออก prompt sheet ให้ผู้ใช้ไปเจนเอง แล้ว import ไฟล์กลับ (ใช้ได้ตั้งแต่ M2)
- `flow_ext` = ผ่าน Chrome Extension (M6)
- เพิ่ม engine อื่นได้โดยไม่แตะ pipeline

---

## 6. โครงไฟล์โปรเจกต์

```
projects/<series-slug>/
  series.json              # meta, style_id, aspect, จำนวนตอน, product mode
  bible/
    story.md               # logline, ธีม, arc ซีซัน
    characters/<char_id>.json + refs/*.png
    locations/<loc_id>.json + refs/*.png
    props/<prop_id>.json + refs/*.png
    voices.json            # เสียงต่อตัวละคร
  episodes/ep01/
    outline.json           # 5 จังหวะ + cliffhanger
    script.json            # บทพูดไทยแบบภาษาพูด
    shots.json             # shot list
    batches/b01.json       # กลุ่มช็อตที่เจนพร้อมกัน
    gen/<shot_id>/v1.mp4, v2.mp4 ...
    qc/<shot_id>.json
    edit/                  # timeline.json, audio, srt
    final/ep01_9x16.mp4, ep01.srt
  continuity.json          # สถานะตัวละครท้ายแต่ละตอน
  cost.json                # เครดิตที่ใช้ต่อตอน
```

---

## 7. Data Schemas (สรุป — ตัวจริงอยู่ใน packages/core)

### Character
```json
{
  "id": "mina", "name": "มีนา", "role": "นางเอก",
  "age": 27, "look": "ผมยาวดำตรง, ไฝใต้ตาซ้าย, ส่วนสูงกลาง",
  "wardrobe_default": "เสื้อเชิ้ตขาว กระโปรงพลีทกรมท่า",
  "personality": "เก็บอารมณ์, ประชดเก่ง",
  "speech": { "self": "ฉัน", "to_elder": "หนู", "to_lover": "เรา", "particles": "ค่ะ/คะ" },
  "voice_id": "v_mina",
  "refs": ["refs/front.png", "refs/34.png", "refs/side.png", "refs/full.png"],
  "flow_character_id": null,
  "locked": true
}
```

### Location
```json
{ "id": "cafe", "name": "คาเฟ่หน้ามหาลัย", "time_variants": ["day","night"],
  "light_sources": ["หน้าต่างบานใหญ่ทิศตะวันตก", "โคมไฟแขวนเหนือเคาน์เตอร์"],
  "axis_notes": "เคาน์เตอร์อยู่ซ้ายจอเสมอ", "refs": ["refs/wide_day.png"], "locked": true }
```

### Shot
```json
{
  "id": "ep01_s012", "scene": 3, "batch": "b02",
  "duration_sec": 3.2,
  "type": "CU",                     // ECU|CU|MCU|MS|WS|EWS|OTS|POV|INSERT
  "angle": "eye-level", "lens": "85mm", "movement": "slow push-in",
  "axis_side": "A",                 // แกน 180°: A|B
  "characters": [{ "id": "mina", "screen_pos": "right", "emotion": "ตกใจกลั้นไว้", "wardrobe": "default" }],
  "location": "cafe", "time": "day",
  "light_motivation": "หน้าต่างตะวันตก, key จากซ้ายจอ",
  "action": "มีนาวางแก้ว เงยหน้าช้าๆ",
  "dialogue": [{ "char": "mina", "text": "คุณ...มาทำอะไรที่นี่", "t_start": 0.6, "t_end": 2.4 }],
  "sfx": ["แก้วกระทบโต๊ะ"],
  "purpose": "เผยว่าเธอจำเขาได้ (ปมรอเฉลย)",   // ทุกช็อตต้องมีเหตุผล
  "beat": "conflict",               // hook|conflict|mystery|twist|bridge
  "style_override": null
}
```

### Continuity entry
```json
{ "after_episode": 3, "mina": { "wardrobe": "ชุดดำงานศพ", "injury": "แผลที่ฝ่ามือขวา", "holding": "จดหมาย", "state": "รู้ความลับแล้ว" } }
```

---

## 8. Pipeline รายละเอียด

### 8.1 Stage A — Series Planning (→ G1)
- Input: logline, style_id, aspect, จำนวนตอน, ความยาวต่อตอน, product (ออปชัน)
- Claude ผลิต: `story.md`, รายชื่อตัวละคร/ฉาก/ของ, `outline.json` ทุกตอน
- กฎ: ทุกตอนมี Hook ภายใน 3 วินาทีแรก และจบด้วย cliffhanger, product mode เปิดจังหวะ `bridge` เฉพาะตอนที่กำหนด

### 8.2 Stage B — Asset Lock (→ G2)
- เจน character sheet ตาม `preset.character_sheet`, location ต้องไม่มีคน, prop ถ่ายแบบ packshot
- ระบบเช็กอัตโนมัติ: location ref มีคน → reject (ตรวจด้วย person detector)
- เมื่อ lock แล้ว ห้ามแก้ไฟล์ ref (ต้อง unlock + เพิ่มเวอร์ชัน)
- flow_ext: กดสร้าง Characters ใน Flow อัตโนมัติ แล้วบันทึก `flow_character_id`

### 8.3 Stage C — Episode Script
- เกลาบทเป็นภาษาพูดตาม `speech` ของตัวละคร
- ตรวจความยาว: นับพยางค์ไทย ≈ 5–6 พยางค์/วินาที ถ้าเกินเวลาตอน → เตือน

### 8.4 Stage D — Shot Breakdown
- Claude แตกช็อตตาม Look Bible ของ preset
- **Validator** (โค้ด ไม่ใช่ AI) ตรวจ:
  - ทุกช็อตมี `purpose`
  - ข้ามแกน 180° ต้องมีช็อตคั่น (neutral/insert) หรือ `axis_cross_reason`
  - ตัวละครใน shot ต้องมีใน bible และ wardrobe ตรง continuity
  - dialogue ไม่ซ้อนเวลา และอยู่ใน duration
  - รวมเวลา ±5% ของความยาวตอน

### 8.5 Stage E — Batching + Prompt Compile
- จัดช็อตเป็น batch ตาม `engine.maxClipSec` (ช็อตต่อเนื่องฉากเดียวกันอยู่ batch เดียวกัน)
- **Prompt Compiler แบบ deterministic**: ประกอบ prompt จาก template + preset + bible + shot (ไม่ให้ LLM เขียน prompt ใหม่ทุกครั้ง → คำบรรยายตัวละครเหมือนกันทุกช็อต)
- โครง prompt (shooting script):
  ```
  [STYLE] {render_tokens}, {grade}
  [CAMERA] {type} {angle}, {lens}, {movement}, {aspect}
  [LOCATION] {location.name} {time}, light: {light_motivation}
  [CHARACTERS] {char.look}, wearing {wardrobe}, at {screen_pos}, {emotion}
  [ACTION] 0.0–{t}: {action}
  [DIALOGUE] {char} ({t_start}–{t_end}): "{text}"
  [SFX] ...
  [AVOID] {negative}
  ```
- แนบ ref images ของตัวละคร/ฉากที่อยู่ใน batch

### 8.6 Stage F — Generate Draft
- คุณภาพร่างก่อน (480p หรือโหมดถูกสุดของ engine)
- คิวงานมี rate limit + หน่วงเวลาแบบสุ่มสำหรับ flow_ext
- บันทึกเครดิตลง `cost.json`

### 8.7 Stage G — QC อัตโนมัติ (→ G3)
| เช็ก | วิธี | เกณฑ์ผ่าน (ปรับได้) |
|---|---|---|
| จำนวนช็อต/จุดตัด | ffmpeg `scdet` | ตรง shot list ±1 |
| ความยาว | ffprobe | ±10% |
| บทพูดครบ | faster-whisper ถอดไทย → เทียบ script ด้วย CER | CER ≤ 25% (native) |
| หน้าตัวละคร | live: insightface cosine vs ref / การ์ตูน: CLIP similarity | ≥ threshold ต่อ preset |
| คนเกิน | person count vs shot | ไม่เกินที่กำหนด |
| ภาพดำ/ค้าง | ffmpeg `blackdetect`, `freezedetect` | ไม่มี |
| ตัวหนังสือ/ลายน้ำโผล่ | OCR เบา (ออปชัน) | ไม่มี |
| รีวิวสายตา | ดึง keyframe 3 ภาพ/ช็อต ส่งให้ Claude ดูผ่าน MCP | Claude ให้ pass/fail + เหตุผล |

- ผลลง `qc/<shot_id>.json` → ช็อตที่ fail เข้าคิว regen อัตโนมัติ (สูงสุด N ครั้ง แล้วรอคนตัดสิน)
- regen ใช้ prompt เดิม + ปรับตามเหตุผลที่ fail (เช่น เพิ่มย้ำ look ตัวละคร)

### 8.8 Stage H — Assembly (→ G4)
- ต่อคลิปตาม timeline, trim ตามจุดตัดจริง
- เสียง: loudnorm ทุกคลิป (เป้า −14 LUFS สำหรับโซเชียล), ducking เพลงใต้บทพูด
- โหมดเสียง:
  - `native` ใช้เสียงจากโมเดล + loudnorm
  - `dub` ทำเสียงไทยรวดเดียวทั้งตอนต่อตัวละคร (TTS หรือ voice-change จากเสียงไกด์) แล้ววางตามเวลา dialogue
  - `narration` เสียงบรรยายคนเดียว
- ซับ SRT จากเวลาพูดจริง (Whisper word timestamps) แล้วเบิร์นตาม `subtitle_style`
- Remotion templates: การ์ดชื่อเรื่อง/ตอน, end card "ตอนต่อไป", การ์ดสินค้า, ป้าย "เนื้อหานี้สร้างด้วย AI"
- Export: 9:16 1080×1920 / 16:9 1920×1080, H.264, + SRT แยกไฟล์ + ปกตอน (frame เด่นจาก cliffhanger)

### 8.9 Upscale / Final
- ช็อตที่ผ่าน G3 ค่อยเจนคุณภาพสูง หรือ upscale (ประหยัดเครดิต)

---

## 9. MCP Tools

| tool | input หลัก | output |
|---|---|---|
| `list_styles` | – | รายการ preset |
| `create_series` | title, logline, style_id, aspect, episodes, ep_length_sec, product? | series_id |
| `get_series` | series_id | สรุปสถานะทุกตอน |
| `write_bible` | series_id, story, characters[], locations[], props[] | validate result |
| `gen_reference` | series_id, entity_type, entity_id, views[] | job ids |
| `lock_asset` / `unlock_asset` | entity_id | ok |
| `write_outline` | series_id, episode, beats[] | validate result |
| `write_script` | episode, lines[] | timing warnings |
| `write_shots` | episode, shots[] | validator report |
| `compile_prompts` | episode | batch list + prompts |
| `export_prompt_sheet` | episode | ไฟล์ .md/.csv สำหรับโหมด manual |
| `import_clips` | episode, folder | map ไฟล์ → shot |
| `generate` | episode, batch_ids?, quality | job ids |
| `job_status` | job_ids | สถานะ |
| `run_qc` | episode, shot_ids? | QC report |
| `get_keyframes` | shot_id | ภาพ 3 เฟรม (ให้ Claude ดู) |
| `regen_shot` | shot_id, fix_notes | job id |
| `update_continuity` | episode, state | ok |
| `assemble` | episode, options | path ไฟล์ final |
| `approve_gate` | series_id, gate, episode? | ok |
| `cost_report` | series_id | เครดิตต่อตอน |

**MCP Resources**: `series://<id>/bible`, `series://<id>/ep/<n>/shots` ให้ Claude อ่านบริบทได้โดยไม่กินแชท

**MCP Prompts** (template สำเร็จรูป): `plan_series`, `breakdown_episode`, `fix_failed_shots`

---

## 10. Chrome Extension (Flow driver)

- เชื่อม server ผ่าน `ws://127.0.0.1:<port>` + token ที่จับคู่ครั้งแรก
- ความสามารถ: สร้าง/เลือก Character, อัปโหลด ref, วาง prompt, ตั้งค่า (aspect/คุณภาพ), กดเจน, รอผล, ดาวน์โหลดไฟล์กลับ
- **Selector อยู่ในไฟล์ config แยก** (`flow-selectors.json`) อัปเดตได้โดยไม่ build ใหม่
- โหมดปลอดภัย: ทำทีละงาน, หน่วงสุ่ม, หยุดทันทีเมื่อเจอหน้าที่ไม่รู้จัก แล้วแจ้ง Dashboard
- ไม่เก็บรหัสผ่าน ใช้ session ที่ผู้ใช้ล็อกอินเองใน Chrome

---

## 11. Dashboard PWA

หน้าจอ:
1. **Series list** — สร้างใหม่ (wizard: ไอเดีย → สไตล์พร้อมภาพตัวอย่าง → อัตราส่วน → จำนวนตอน)
2. **Bible board** — การ์ดตัวละคร/ฉาก/ของ + ภาพ ref + ปุ่ม Lock
3. **Episode board** — kanban สถานะตอน
4. **Shot grid** — storyboard ทุกช็อต + คลิป + badge QC (เขียว/แดง) + ปุ่มเจนใหม่
5. **Review player** — ดูดราฟต์ทั้งตอน กด approve / คอมเมนต์ที่เวลา (ส่งเป็น fix_notes)
6. **Queue & Cost** — งานค้าง, เครดิตที่ใช้
7. **Settings** — engine, threshold QC, เสียง, โฟลเดอร์ export

ใช้บนมือถือได้ (ดู/อนุมัติ) การสั่งงานหนักทำผ่าน Claude

---

## 12. Product Mode (ละครขายของ)
- ใส่สินค้า: ชื่อ, รูป packshot, จุดขาย 3 ข้อ, CTA, ลิงก์
- สินค้าเป็น prop ที่ lock เหมือนตัวละคร
- บังคับจังหวะ `bridge` ในตอนที่เลือก + การ์ดสินค้าท้ายตอน
- ใส่ป้าย "โฆษณา" อัตโนมัติ

---

## 13. Milestones + เกณฑ์ผ่าน

| M | งาน | เกณฑ์ผ่าน (ต้องผ่านก่อนไปต่อ) |
|---|---|---|
| **M0** | Monorepo, zod schemas, file store, MCP server เปล่า | Claude Desktop เห็น tool `list_styles` และเรียกได้ |
| **M1** | Series/Bible/Outline tools + 11 style presets + validator | สร้างซีรีส์ทดลอง 3 ตอนจากแชท ได้ไฟล์ครบตาม §6 |
| **M2** | Script + Shot breakdown + Prompt compiler + export prompt sheet + import_clips | ได้ prompt sheet ไปเจนใน Flow เอง แล้ว import กลับ map ถูกช็อต |
| **M3** | QC workers (scdet, whisper, similarity, black/freeze) + get_keyframes + regen loop | รัน QC กับตอนจริง ได้รายงาน และจับช็อตพังที่ใส่ไว้ทดสอบได้ ≥ 80% |
| **M4** | Assembly: loudnorm, SRT, Remotion cards, export 9:16/16:9 | ได้ไฟล์ final 1 ตอน เสียงดังเท่ากัน ซับตรงเวลา ±0.2s |
| **M5** | Dashboard PWA (หน้าจอ 1–6) + approve gates | อนุมัติ G1–G4 จากมือถือได้ |
| **M6** | Chrome Extension flow_ext + Flow Characters | เจน 1 ตอนแบบไม่ต้องแตะ Flow เอง |
| **M7** | Voice modes (dub/narration) + voice adapter | ตอนสไตล์ `live_kdrama_dub` เสียงตัวละครเดิมทุกคลิป |
| **M8** | Product mode + continuity ข้ามตอน + cost report | ซีรีส์ 10 ตอนจบ ไม่มีความผิดพลาดเรื่องชุด/แผลข้ามตอน |

> ใช้ผลิตงานจริงได้ตั้งแต่ M4 (โหมด manual) — M5+ คือเพิ่มความสะดวก

---

## 14. ความเสี่ยงและข้อควรระวัง
- **ข้อตกลงการใช้งานของ Google Flow**: การกดอัตโนมัติอาจขัดเงื่อนไข → มีโหมด manual เสมอ, ทำช้าแบบคน, ผู้ใช้รับผิดชอบบัญชีตัวเอง
- **Flow เปลี่ยน UI** → selector แยก config + หยุดอย่างปลอดภัย
- **หน้าตาเหมือนคนจริง/ดารา** → เช็กใน G2, ห้ามใส่ชื่อคนจริงใน prompt
- **IP การ์ตูน** → ห้ามอ้างชื่อตัวละคร/สตูดิโอที่มีลิขสิทธิ์ใน preset และ prompt
- **ความต่อเนื่อง 100% ทำไม่ได้กับโมเดลปัจจุบัน** → เป้า ≥ 90% ช็อตผ่าน QC ภายใน 2 รอบ
- **แพลตฟอร์มโซเชียล** → ติดป้ายเนื้อหา AI / โฆษณาตามกติกา

---

## 15. ตัวชี้วัดความสำเร็จ
- เวลาผลิต 1 ตอน 2 นาที (หลัง asset lock): ≤ 2 ชม. งานคน
- ช็อตผ่าน QC รอบแรก ≥ 60%, ภายใน 2 รอบ ≥ 90%
- เครดิตต่อตอน ลดลง ≥ 30% เทียบกับการเจนแบบไม่มี QC
