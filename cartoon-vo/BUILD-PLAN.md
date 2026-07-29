# BUILD-PLAN.md

Milestone-gated ตามปกติ — **แต่ละ M ต้องผ่าน acceptance ก่อนถึงจะขึ้นตัวถัดไป** ผ่านแล้ว commit + tag ทันที
ห้ามเขียน M ถัดไปคร่อมมาก่อน ถ้าติดอะไรให้หยุดแล้วอัปเดต `STATUS.md`

---

## M0 · โครงโปรเจกต์

```
/pipeline    tts.mjs  align.mjs  cues.mjs  cache.mjs
/src         Root.tsx  Scene.tsx  TextLayer.tsx  MouthRig.tsx  timing.ts
/assets      script.json → out/{seg_*.mp3, vo.mp3, cues.json}
/verify      verify.mjs  frames.mjs
.env .gitignore CLAUDE.md STATUS.md
```

- `.env` → `ELEVENLABS_API_KEY=` และใส่ `.env` ใน `.gitignore` **ก่อน** commit แรก
- `timing.ts` เก็บ `lerp / prog / easeOut / easeIO / pop / mulberry32` — pure function ล้วน ห้าม import อะไรจาก Remotion

**Acceptance:** `git status` ไม่มี `.env` โผล่ · `node -e "import('./src/timing.ts')"` ไม่พัง
**Tag:** `m0-scaffold`

---

## M1 · TTS + cache

`cache.mjs` → `key = sha256(text + voiceId + modelId)` เป็นชื่อไฟล์ใน `out/cache/`
`tts.mjs` → ยิงทีละบรรทัด เจอ cache ข้าม ไม่เจอค่อยยิง เก็บทั้ง mp3 และ JSON alignment คู่กัน

**Acceptance:** รัน `node pipeline/tts.mjs` สองรอบติดกัน รอบสองต้องขึ้น `cached` ทุกบรรทัดและ **ไม่มี network call** (log จำนวน request ออกมาให้เห็น)
**Tag:** `m1-tts-cache`

---

## M2 · Alignment → คำ

- ตัดคำด้วย `Intl.Segmenter` เก็บ `from`/`to` เป็น index ตัวอักษรของข้อความ**ดิบ**
- map `character_start_times_seconds[from]` → `character_end_times_seconds[to-1]`
- ไม่มี `alignment` กลับมา → เรียก `/v1/forced-alignment` แทน
- ยุบเครื่องหมายวรรคตอนเข้าคำหน้า (`ผึ้ง` + `!!!` → `ผึ้ง!!!`) ไม่งั้นขึ้นจอแล้วมีช่องว่างแปลก ๆ

**Acceptance:** ทุกคำต้อง `s < e` และ `words[i].e <= words[i+1].s + 0.02` · ทดสอบด้วยประโยคที่มีวรรณยุกต์ซ้อนและตัวเลข (`"ผึ้ง 3 ตัวบินมาที่นี่"`) แล้วเวลาต้องไม่กระโดด
**Tag:** `m2-align`

---

## M3 · cues.json

ประกอบทุกอย่าง + คำนวณ `beats` จาก `anchorLine` + `offset` + วัดความยาวจริงด้วย `ffprobe`
ต่อไฟล์เสียงเป็น `vo.mp3` ตัวเดียวด้วย ffmpeg concat โดยใส่ silence padding ให้ตรงกับ `startAt`

**Acceptance:** `node verify/verify.mjs out/cues.json` ผ่านทุกข้อ · `ffprobe vo.mp3` ได้ความยาวห่างจาก `cues.duration` ไม่เกิน 0.1 วิ
**Tag:** `m3-cues`

---

## M4 · Remotion components

- `Root.tsx` → `calculateMetadata` อ่าน `cues.json` แล้ว set `durationInFrames`, `fps`, ส่ง cues เป็น props
- `TextLayer` → หนึ่ง `<Sequence>` ต่อบรรทัด คำเด้งตาม `word.s` ของตัวเอง + ไฮไลต์คำที่กำลังพูด
- `MouthRig` → เปิด/ปิดจาก `cues.mouth` ช่วงไหนอยู่ในช่วงคำ = อ้า
- `Scene` → อ่าน `beats` ไม่มีเลขเวลาใน component แม้แต่ตัวเดียว

**Acceptance:** `grep -nE "[^a-zA-Z](8\.6|12\.6|17\.2)" src/` ต้องไม่เจออะไร (ไม่มีเวลา hardcode) · `npx remotion still Scene out/f200.png --frame=200` ออกภาพได้
**Tag:** `m4-comps`

---

## M5 · Verify harness ⭐

ตัวนี้สำคัญที่สุด อย่าข้าม — บั๊กอนิเมชั่นส่วนใหญ่ไม่ throw error มันแค่วาดผิดตำแหน่งเงียบ ๆ

1. **`verify.mjs`** — ตรวจ `cues.json` ตามสัญญา (ดูไฟล์ที่แนบมา รันได้เลย)
2. **`frames.mjs`** — เรนเดอร์เฟรมตัวแทนของทุก beat เป็น PNG แล้ว **เปิดดูด้วยตาจริง ๆ**
   ```bash
   for f in 30 150 258 285 380 520 620; do
     npx remotion still Scene out/qc_$f.png --frame=$f
   done
   ```
3. **NaN scan** — ไล่ทุกเฟรมแล้วสแกน transform/attribute ที่มี `NaN` หรือ `undefined`
   เจอบ่อยมากเวลาหารด้วยศูนย์หรือ index หลุด และ**ไม่มีทางเห็นจากภาพนิ่ง**

**Acceptance:** `node verify/verify.mjs` ผ่าน · ดู PNG ทุกใบแล้วยืนยันว่าของอยู่ถูกที่
**Tag:** `m5-verify`

---

## M6 · เรนเดอร์จริง

```bash
npx remotion render Scene out/final.mp4 --concurrency=4 --crf=18
```

**Acceptance:** เปิดไฟล์ฟังแล้วปากตรงเสียงตลอด 24 วิ · ข้อความไม่ล้นกรอบ · ไม่มีวรรณยุกต์โดนตัด
**Tag:** `m6-render`

---

## บทเรียนจากตอนสร้างต้นแบบ — ให้ Claude Code ระวังไว้

- **ตำแหน่ง asset ที่ต้องแตะกัน ให้คำนวณ อย่ากะ** ตอนทำงวงช้างแตะรังผึ้ง กะมุมเอาแล้วงวงชี้ผิดทางเลย เขียน forward kinematics คำนวณปลายงวงจากมุมข้อต่อทั้ง 4 ปล้อง แล้วค่อยวางรังตรงจุดนั้น จบใน 1 รอบ
- **`rotate()` ใน SVG หมุนรอบ (0,0) ของ group เสมอ** จะสเกล/หมุนเอฟเฟ็ครอบหัวตัวละคร ต้อง `translate(หัว) scale() ` ไม่ใช่ `scale()` เฉย ๆ ไม่งั้นเอฟเฟ็คลอยหนีออกจากตัว
- **ของที่วางทับกันตามลำดับ markup** ตอนแรกวางปากไว้ตรงโคนงวงพอดี งวงบังมิด ทดสอบด้วยการเรนเดอร์ 2 ครั้ง (เปิด/ซ่อน element) แล้ว diff พิกเซล ถ้าไม่ต่างแปลว่าโดนบัง
- **เลเยอร์ parallax ต้อง wrap** พอกล้องแพนไกล ๆ ตอนวิ่ง ละอองกับนกหลุดออกนอกจอหมด ต้อง modulo กลับเข้ามา
- **class ที่ toggle ต้องเก็บกวาด** ไฮไลต์คำค้างอยู่บนบรรทัดที่หมดเวลาไปแล้ว เพราะ loop ข้าม element ที่ opacity 0

---

## STATUS.md

จบทุก session เขียน: M ล่าสุดที่ผ่าน · ยอด API call สะสม · สิ่งที่ค้าง · ไฟล์ที่แตะล่าสุด
