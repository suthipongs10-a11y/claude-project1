# CHANNEL-STYLE — ถอดรหัสจักรวาล (Decoding the Universe)

> **แบรนด์ภาพ + เสียงของช่อง** — ไฟล์นี้คือ "หน้าตา" ที่ล็อกไว้ ทุกคลิปต้อง match
> สเปกนี้ 100% ใช้คู่กับ pipeline `bones-and-firelight-pipeline.SKILL.md`
> (แต่เปลี่ยนเนื้อหาเป็นจักรวาล/วิทยาศาสตร์ + ภาษาไทย + สไตล์ภาพด้านล่างนี้)

## 0. Fixed facts (ห้ามถามซ้ำ)

- **ช่อง:** ถอดรหัสจักรวาล — สารคดี/explainer เรื่องจักรวาล ดวงดาว วัตถุ สสาร
  วิทยาศาสตร์ **ภาษาไทย** faceless โทนสนุก เข้าใจง่าย น่าค้นหา
- **สไตล์ภาพ = "Sticky Line" (colored doodle explainer):** เส้นวาดมือ doodle
  เส้นดำหนาเท่ากัน ลงสีสดในเส้น (โทนมาร์กเกอร์/เครยอง) พื้นกระดาษออฟไวท์ สนุก
- **มาสคอท = สติ๊กแมนดำ** (ดูข้อ 2) โผล่ประจำเกือบทุกฉากในฐานะ "ผู้ถอดรหัส"
- **ภาพ = PROMPT-ONLY** gen ฟรีใน Google Flow แล้วส่งกลับ (แนบ mascot + style-anchor
  เป็น ingredient ทุกครั้ง) — ไม่ gen ภาพเองแม้มีเครื่องมือจ่ายเงิน
- **เสียง = ElevenLabs `eleven_v3`** (รองรับภาษาไทย) ผ่าน endpoint
  `/with-timestamps` — คืน **เสียง + timestamp รายตัวอักษร** ในคำสั่งเดียว
  → `tts/gen_vo_eleven.py` แปลงเป็น `word-timings.json` โดยตรง
  **ไม่ต้องใช้ whisper/forced alignment อีก**
  - **เสียงประจำช่อง = `Brian` (voice_id `nPczCjzI2devNBz1zQrb`)** — ชายทุ้ม
    น่าเชื่อถือ อบอุ่น (Deep, Resonant and Comforting) ผ่านการฟังจริงแล้ว
  - คีย์เก็บใน env `ELEVENLABS_API_KEY` เท่านั้น ห้ามฝังในไฟล์/commit
  - **VO มาก่อนภาพเสมอ, timing มาจาก timestamp ของ API (ไม่ใช่เดาจากจำนวนคำ)**
  - *(สาย Gemini TTS + forced alignment เดิมยังอยู่ใน `tts/` เป็น fallback)*
- **ประกอบ = HyperFrames**, duration จริงจาก `ffprobe`

## 1. Palette

| บทบาท | สี | HEX |
|---|---|---|
| เส้นหมึก + มาสคอท (ดำล้วน) | near-black | `#111318` |
| พื้นหลัง (กระดาษ) | warm off-white | `#F6F1E7` |
| accent — ม่วงจักรวาล | violet | `#6A3CF0` |
| accent — ไซแอน (ลายเซ็น decode) | cyan | `#17C3D6` |
| accent — ส้มเปลว | orange | `#FF8A3C` |
| accent — เหลืองดาว | yellow | `#FFC93C` |
| accent — คอรัล | coral/red | `#FF5C5C` |
| accent — เขียวธรรมชาติ | green | `#35C46A` |
| ไฮไลต์ caption | เหลืองมาร์กเกอร์ | `#FFE14D` |

**กติกา:** มาสคอท **ดำล้วนเสมอ** / วัตถุ-จักรวาล-ธรรมชาติ-ทุกอย่างอื่น **ลงสีสด**
ในเส้นดำ / 1 ฉากเน้นสี accent ไม่เกิน 2-3 สี ให้อ่านง่าย

## 2. MASCOT — CHARLOCK (ล็อกตัวละคร — ใส่ verbatim ทุกช็อตที่มีมาสคอท)

> CHARLOCK: a solid black stick-figure mascot — round white face with a bold black
> outline, messy tall spiky black anime hair with a few thin white highlight
> streaks, two angular determined eyes, a tiny short-line mouth, a small black "x"
> stitch mark on the LEFT cheek, thin single-line black stick arms and legs, small
> open-loop circle hands and small oval feet, no neck. The body is ALWAYS fully
> solid black, bold clean ink. Keep the face, spiky hair, and the cheek "x"
> identical in every shot.

- **บทบาท:** "นักถอดรหัส" — ชี้ชวนดู, ทำท่าตกใจ/สงสัย/ยูเรก้า, ตัวเล็กเทียบวัตถุจักรวาล
- แสดงอารมณ์ผ่าน "ท่าทาง + คิ้ว/ปาก" ไม่เปลี่ยนโครงหน้า/ผม

## 3. STYLE BLOCK (ล็อกโลก — ใส่ verbatim ทุกช็อต)

> STYLE: playful hand-drawn doodle line-art, bold uniform black ink outlines,
> everything drawn as loose confident marker strokes, flat bright color fills
> (marker/crayon look) for all objects, planets, matter and nature, while the
> mascot stays pure solid black, slight sketchy hand-drawn wobble, clean warm
> off-white paper background (#F6F1E7), generous negative space, fun energetic
> science-explainer vibe, NOT photorealistic, no heavy gradients, no realistic
> texture. 16:9.

## 4. Captions (ใส่คำบ่อยขึ้น — จุดขายของช่อง)

- **ภาษาไทย** คำ/วลีสั้น 1–4 คำ ตัวหนา อ่านเด้ง
- **ความถี่: ~35–45% ของช็อต** (มากกว่า default pipeline ที่ ~20% — ตามที่ต้องการ
  "ใส่คำบ่อยขึ้น") ≈ ทุก 2–3 ช็อตมีคำเด็ดโผล่ 1 คำ
- สไตล์: ตัวอักษรไทยหนา สีดำบนไฮไลต์เหลืองมาร์กเกอร์ `#FFE14D` หรือคำสี accent
  วางมุมบน/พื้นที่ว่าง ไม่ทับหน้ามาสคอท ให้ความรู้สึกเขียนมือ
- ใส่ตอน: ตัวเลข/สถิติ, ชื่อวัตถุ (หลุมดำ, ควาซาร์), จุดพลิก, มุก/คำอุทาน
- **ภาพช็อตที่จะมี caption ต้อง gen แบบเว้นที่ว่างสะอาด ไม่มีตัวอักษรฝังในภาพ**
  (คำเติมทีหลังใน HyperFrames)

## 5. Style-anchor (ล็อกครั้งเดียวต่อช่อง)

gen 1 ภาพ = มาสคอท + วัตถุจักรวาล doodle สี + พื้นกระดาษ + เว้นที่ caption →
เซฟเป็น `assets/style-anchor.png` (channel asset) แล้วแนบเป็น ingredient ทุกคลิป
เพื่อความต่อเนื่องของสไตล์ ดู prompt ปัจจุบันในแชต/ไฟล์ประกอบ

---
*สเปกนี้ทับ (supersede) ตัวเลือก "Cosmic Painterly" ก่อนหน้า — ช่องใช้ Sticky Line
colored doodle ตามไฟล์นี้*
