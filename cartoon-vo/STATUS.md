# STATUS

## M ล่าสุดที่ผ่าน

**M0 · โครงโปรเจกต์** — ผ่าน acceptance ครบ (tag `m0-scaffold`)

| Acceptance | ผล |
|---|---|
| `git status` ไม่มี `.env` โผล่ | ✅ `.gitignore` ตั้งก่อน commit แรก · `git check-ignore .env` ยืนยันแล้ว |
| `node -e "import('./src/timing.ts')"` ไม่พัง | ✅ `exit=0` (Node v22.22.2 strip types ให้เอง ไม่ต้องใส่ flag) |

ตรวจเพิ่มเองนอกเหนือจาก acceptance: `lerp / prog / easeOut / easeIO / pop / mulberry32`
มีครบ คืนค่าถูก · `prog` clamp ที่ขอบจริง · `mulberry32(42)` เรียกสองครั้งได้ลำดับเดิม (deterministic)

## ยอด API call สะสม

**0** — ยังไม่ได้ยิง ElevenLabs แม้แต่ครั้งเดียว

## สิ่งที่ค้าง

1. **ไม่มี `ELEVENLABS_API_KEY`** — ไม่มีทั้งใน env และ `.env` (ไฟล์ `.env` สร้างไว้แล้วแต่ค่าว่าง)
2. **`api.elevenlabs.io` ถูก network policy ของ environment บล็อก** (`connect_rejected`)
   → ต้องเพิ่มโดเมนใน Allowed domains ของ environment ก่อน ถึงจะยิงได้จาก sandbox
3. **ไม่มี `ffmpeg` / `ffprobe` ใน PATH** — M3 ต้องใช้
   มีไบนารีที่ใช้ได้อยู่ในเครื่องแล้วจาก `imageio-ffmpeg`:
   `/tmp/.../venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2`
   (ffprobe ยังต้องหาเพิ่ม — ffmpeg bundle ตัวนี้ไม่มี ffprobe มาด้วย)
4. ยังไม่ได้ `npm init` / ลง Remotion — รอ M4

## ไฟล์ที่แตะล่าสุด

- `src/timing.ts` — เขียนจริง ใช้งานได้ (ตัวเดียวใน M0 ที่ไม่ใช่ stub)
- `assets/script.json` — บทเรื่อง "ยุงนอนไหม? แล้วทำไมเจอยุงได้ทุกเวลา" 10 บรรทัด 9 beats
  พร้อมข้อเท็จจริงและแหล่งอ้างอิงใน `_notes`
- `pipeline/*.mjs`, `src/*.tsx`, `verify/frames.mjs` — stub ที่ throw บอกว่าอยู่ M ไหน
  (ตามกฎ BUILD-PLAN: ห้ามเขียน M ถัดไปคร่อมมาก่อน)
- `verify/verify.mjs` — ของที่แนบมา คัดลอกเข้ามาตรง ๆ ไม่แก้

## ก้าวถัดไป

**M1 · TTS + cache** — เขียน `cache.mjs` + `tts.mjs`
Acceptance: รัน `node pipeline/tts.mjs` สองรอบ รอบสองต้องขึ้น `cached` ทุกบรรทัดและไม่มี network call

> ⚠️ M1 รันจริงไม่ได้จนกว่าจะแก้ข้อค้าง 1 กับ 2 ข้างบน
> ระหว่างนี้เขียนโหมด estimate (`0.09 + len * 0.055` วิ) ไว้ก่อนได้ตาม CLAUDE.md ข้อ 3
