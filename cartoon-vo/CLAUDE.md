# CLAUDE.md — Cartoon VO Pipeline

ระบบสร้างวีดีโอการ์ตูนไทยที่ **เวลาทุกอย่างมาจากเสียงพากย์** ไม่ใช่จากการกะเอา

```
script.json ──► tts.mjs ──► seg_NN.mp3 + alignment
                              │
                              ├─ align.mjs   ตัดคำไทย + map ตัวอักษร→คำ
                              └─ cues.mjs    ประกอบเป็น cues.json  ◄── single source of truth
                                                │
                              ┌─────────────────┼─────────────────┐
                          TextLayer         MouthRig          Scene beats
                        (คำเด้งตามเสียง)   (ปากขยับ)       (จังหวะฉากยืดตามพากย์)
```

---

## กฎเหล็ก — ห้ามละเมิด ถ้าจะละเมิดต้องถามก่อน

1. **ทุกอย่างเป็นฟังก์ชันของ `frame` เท่านั้น**
   ห้าม CSS animation / `setInterval` / `Date.now()` / `requestAnimationFrame` ในโค้ดที่วาดภาพ
   เทสต์: เรียก `render(f)` ด้วยเลขเดิม ต้องได้ภาพเดิมเป๊ะทุกครั้ง ไม่งั้นเรนเดอร์ออกมาจะไม่ตรงกับที่พรีวิว

2. **ห้ามฝังเลขเวลาในคอมโพเนนต์**
   `if (t > 8.6)` = ผิด · `if (t > beats.touch[0])` = ถูก
   เวลาทั้งหมดมาจาก `cues.json` เท่านั้น เปลี่ยนพากย์ใหม่แล้วภาพต้องขยับตามเองโดยไม่แตะโค้ด

3. **ห้าม `Math.random()` ในโค้ดที่เรนเดอร์**
   ใช้ seeded PRNG (mulberry32) ตอน init หรือ `Math.sin(frame * k)` เท่านั้น
   ไม่งั้นแต่ละเฟรมที่เรนเดอร์แยกกันจะได้ตำแหน่งฝุ่น/ละอองไม่ตรงกัน = ภาพกระตุก

4. **ตัดคำไทยใช้ `Intl.Segmenter` เท่านั้น**
   ```js
   const seg = new Intl.Segmenter("th", { granularity: "word" });
   [...seg.segment(text)].filter(s => s.isWordLike)
   ```
   มากับ Node/Chrome อยู่แล้ว ไม่ต้องลง newmm ไม่ต้องมีดิกชันนารี ไม่มีค่าใช้จ่าย

5. **เสียงคือ ground truth ของเวลา**
   - ตอน **เรนเดอร์** Remotion: frame เป็นตัวหลัก เสียง mux ตาม `<Audio>` — ตรงอัตโนมัติ
   - ตอน **พรีวิวในเบราว์เซอร์**: ต้องอ่านเฟรมจาก `audio.currentTime * fps` ห้ามเดินเฟรมเองแล้วสั่งเสียงตาม เพราะจะเลื่อนสะสมจนปากไม่ตรงเสียงตั้งแต่นาทีที่ 2-3

6. **API key อยู่ใน `.env` เท่านั้น** — `.env` ต้องอยู่ใน `.gitignore` ห้าม hardcode ห้าม log ค่าออกมา

---

## Contracts

### `script.json` — อินพุตที่คนเขียน

```jsonc
{
  "voiceId": "xxxx",
  "modelId": "eleven_v3",        // ไทยใช้ v3
  "tailOut": 0.4,
  "lines": [
    {
      "id": "L1",
      "text": "เช้าวันแรกในป่าลึก",
      "style": "calm",           // calm | alarm | run | caption → ตรงกับ style ใน TextLayer
      "startAt": 1.10,           // ปักหมุดบนไทม์ไลน์ (ไม่ใส่ = ต่อจากบรรทัดก่อน)
      "gapAfter": 0.4,
      "hold": 1.9                // ข้อความค้างบนจอต่ออีกกี่วินาทีหลังพูดจบ
    }
  ],
  "beats": [
    { "name": "walk",  "start": 0.30 },
    { "name": "panic", "anchorLine": "L3", "offset": -0.05 }  // ผูกกับบรรทัดพากย์
  ]
}
```

`anchorLine` คือหัวใจ — พากย์ยาวขึ้น 2 วินาที จังหวะฉากเลื่อนตามเอง ไม่ต้องไล่แก้เลขทีละจุด

### `cues.json` — เอาต์พุตที่เครื่องอ่าน

```jsonc
{
  "fps": 30,
  "duration": 24.66,
  "frames": 740,
  "source": "elevenlabs:eleven_v3",
  "audio": "vo.mp3",
  "beats": { "walk": [0.3, 5.0], "look": [5.0, 8.6] },   // [start, end] วินาที
  "mouth": [[1.1, 1.41], [1.41, 1.665]],                  // ช่วงที่มีเสียงคำ = ปากเปิด
  "lines": [{
    "id": "L1", "style": "calm", "s": 1.1, "e": 4.53,
    "words": [{ "w": "เช้า", "s": 1.1, "e": 1.41, "speak": true }]
  }]
}
```

**กติกา:** ไม่มีใครแก้ `cues.json` ด้วยมือ ถ้าเวลาไม่ถูกให้แก้ `script.json` แล้ว generate ใหม่

---

## ElevenLabs

**หลัก** `POST /v1/text-to-speech/{voice_id}/with-timestamps`
คืน `audio_base64` + `alignment.characters` + `character_start_times_seconds` / `character_end_times_seconds`
→ map ช่วง index ของแต่ละ token ที่ตัดคำไว้ ได้เวลาเริ่ม-จบรายคำ

**สำรอง** `POST /v1/forced-alignment`
ถ้าโมเดลที่เลือกไม่คืน `alignment` มา ให้ส่งไฟล์เสียงที่เพิ่งได้ + ข้อความเข้าไป แล้วได้ timestamp กลับมาเหมือนกัน
เขียน fallback นี้ไว้ตั้งแต่แรก อย่ารอให้พัง เพราะการรองรับ timestamp ต่างกันไปตามโมเดลและเปลี่ยนได้

**ห้ามเชื่อ timestamp ตัวสุดท้ายว่าเป็นความยาวไฟล์** — วัดด้วย `ffprobe` เสมอ ตัวเลขไม่ตรงกันประจำ

---

## คุมค่าใช้จ่าย

1. **cache ตาม hash** — `sha256(text + voiceId + modelId)` เป็นชื่อไฟล์ มีไฟล์แล้วข้าม ไม่ยิงซ้ำ
   แก้บรรทัดที่ 7 บรรทัดเดียว = จ่ายแค่บรรทัดเดียว ไม่ใช่ทั้งคลิป
2. **ยิงทีละบรรทัด ไม่ยิงทั้งสคริปต์รวด** — ได้ cache ละเอียดขึ้น และ retry เฉพาะบรรทัดที่พัง
3. **โหมด estimate ก่อนเสมอ** — ไม่มี key ให้กะเวลาจากจำนวนตัวอักษร (`0.09 + len * 0.055` วิ/คำ) เอาไว้จัด layout ให้จบก่อน แล้วค่อยยิงเสียงจริงรอบเดียว
4. `enable_logging: false` ถ้าสคริปต์เป็นงานลูกค้า

---

## Remotion mapping

| พรีวิว HTML | Remotion |
|---|---|
| `frame` จาก scrub/audio | `useCurrentFrame()` |
| `FPS`, `TOTAL` | `useVideoConfig()` |
| `cues.json` โหลดตอน init | `calculateMetadata()` → set `durationInFrames = cues.frames` + ส่งเป็น props |
| `<audio id="vo">` | `<Audio src={staticFile("vo.mp3")} />` |
| `.cue` div | `<AbsoluteFill>` + `<Sequence from={Math.round(line.s * fps)}>` |
| `pop()` overshoot ที่เขียนเอง | `spring({ frame, fps, config: { damping: 12 } })` |
| `lerp` / `prog` / `easeOut` | `interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })` |

ตัวเลขเวลาใน `cues.json` เป็น **วินาที** ตลอด แปลงเป็นเฟรมที่ขอบเท่านั้น (`Math.round(s * fps)`) อย่าเก็บเป็นเฟรมในไฟล์ เพราะเปลี่ยน fps ทีจะพังทั้งระบบ

---

## ฟอนต์ไทย

- โหลดผ่าน `@remotion/google-fonts` แล้ว `await waitForFonts()` ก่อน render ไม่งั้นเฟรมแรก ๆ จะเป็นฟอนต์ fallback
- `line-height` อย่าต่ำกว่า 1.5 — วรรณยุกต์ซ้อน (เช่น "น้ำ" "ที่") จะโดนตัดหัว
- ขอบตัวอักษรใช้ `text-shadow` 8 ทิศ อย่าใช้ `-webkit-text-stroke` เพราะมันกินเข้าไปในตัวอักษรทำให้สระไทยบางเส้นหาย
- ขึ้นบรรทัดใหม่ให้ตัดที่ขอบ token จาก `words[]` เท่านั้น ห้ามให้เบราว์เซอร์ตัดเอง — ไทยไม่มีเว้นวรรค มันจะตัดกลางคำ
