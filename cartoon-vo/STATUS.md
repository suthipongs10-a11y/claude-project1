# STATUS

## M ล่าสุดที่ผ่าน

**M6 · เรนเดอร์จริง** — มีเสียงพากย์จริงแล้วผ่าน Gemini TTS (ไม่ต้องพึ่ง ElevenLabs)

| M | สถานะ | Acceptance |
|---|---|---|
| M0 โครงโปรเจกต์ | ✅ | `.env` ไม่ถูก track · `node -e "import('./src/timing.ts')"` exit 0 |
| M1 TTS + cache | ✅ | รอบแรกยิงจริง 10 request (gemini) · รอบสอง cached ครบ 10 · **network request = 0** |
| M2 Alignment → คำ | ✅ | ทุกคำ `s < e` · ไม่ทับกัน · เทสต์ `"ผึ้ง 3 ตัวบินมาที่นี่"` ตัดได้ `ผึ้ง|3|ตัว|บิน|มา|ที่|นี่` เวลาไม่กระโดด |
| M3 cues.json | ✅ | `verify.mjs` exit 0 · ความยาววัดจาก header WAV จริง 49.315s ตรงกับไทม์ไลน์ (แทน `ffprobe` ซึ่งเครื่องนี้ไม่มี) |
| M4 Remotion components | ✅ | `grep -nE "[^a-zA-Z](8\.6\|12\.6\|17\.2)" src/` ไม่เจอ · `remotion still` ออกภาพได้ |
| M5 Verify harness | ✅ | `verify.mjs` ผ่าน · `frames.mjs` เรนเดอร์ 9 เฟรม (กลางทุก beat) + สแกน NaN ไม่เจอ · **ดูด้วยตาแล้ว** |
| M6 เรนเดอร์จริง | ✅ | `out/final.mp4` 49.3s 1920×1080 30fps **มีเสียงพากย์** · ปากขยับตรงระดับวลี (เวลาคำเป็นค่าประมาณ ดูข้อจำกัดด้านล่าง) |

## ยอด API call สะสม

**10** — Gemini TTS 10 ครั้ง (บรรทัดละครั้ง) · ElevenLabs **0 ครั้ง**
รันซ้ำหลังจากนี้ = 0 request ตราบใดที่ข้อความไม่เปลี่ยน (cache ตาม sha256)

## สถานะคีย์ (เช็คด้วย `node pipeline/keycheck.mjs`)

| คีย์ | Gemini API | Cloud TTS |
|---|---|---|
| `GOOGLE_TTS_API_KEY` #1 | ✅ 200 · 50 โมเดล (TTS 3 ตัว) | ❌ 403 PERMISSION_DENIED — คีย์ AI Studio ถูกล็อกไว้ที่ `generativelanguage.googleapis.com` |

**ใน Environment มีคีย์เดียว ไม่ใช่สามคีย์** — `GOOGLE_TTS_API_KEY` ยาว 39 ตัวอักษร = คีย์เดียวพอดี
โค้ดรองรับหลายคีย์คั่นด้วย `,` แล้ว (`pipeline/keys.mjs`) เติมอีกสองตัวได้เลยไม่ต้องแก้อะไร

## บั๊กที่เจอและแก้ระหว่างทาง

1. **ข้อความตกจอทั้งหมด** — ใช้ `paddingTop: "70%"` แต่ CSS คิด % ของ padding จาก**ความกว้าง**
   70% ของ 1920 = 1344px เกินความสูง 1080 → เปลี่ยนเป็น `position:absolute; top: height * 0.70`
2. **ฟอนต์ไทยไม่ขึ้น** — ประกาศ `font-family` ไว้แต่ไม่ได้โหลดฟอนต์
3. **เว้นวรรคระหว่างวลีหายหมด** — `segmentThai` ทิ้ง segment ที่เป็นช่องว่าง
   ทำให้ `"ตีสองยังโดนกัด บ่ายสามก็โดนอีก"` กลายเป็น `ตีสองยังโดนกัดบ่ายสามก็โดนอีก`
   → เพิ่มธง `sp` บอกว่าคำนี้มีวรรคตามหลัง แล้ว TextLayer เว้น `marginRight`
4. **เรนเดอร์ยาวล้มที่เฟรม 689** — `delayRender("โหลดฟอนต์ไทย")` ค้างเกิน 28 วิ
   Remotion เปิดแท็บใหม่ระหว่างเรนเดอร์ แล้วคำขอไฟล์ฟอนต์ค้างในแท็บนั้น
   → ฝังฟอนต์เป็น data URI (`src/font-data.ts`) ตัด network ออกจากสมการ + ประกัน `continueRender` เสมอ
5. **Chrome ตัวเต็มเปิดไม่ได้** — ถอด headless แบบเก่าออกแล้ว
   → ใช้ `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`
6. `--scale=0.6667` ทำให้เรนเดอร์ล้ม (ได้ขนาดเป็นเศษ) → เรนเดอร์ที่ความละเอียดเต็มแทน
7. **บั๊กฟอนต์กลับมาอีกที่เฟรม 1306** — ตัวกันเหนียว `setTimeout(finish, 15000)` ไม่ทำงาน
   เพราะแท็บที่ Remotion เปิดใหม่อยู่เบื้องหลัง Chrome หน่วง timer ในแท็บพื้นหลังได้ถึงระดับนาที
   → เลิกใช้ `delayRender` กับฟอนต์ทั้งหมด ฉีด `@font-face` เป็น CSS ตรง ๆ + `font-display: block`
   เป็นงาน DOM ล้วน ไม่มี timer/promise ให้ค้าง
8. **`gemini-2.5-flash-preview-tts` คืน `finishReason=OTHER`** ซ้ำ ๆ กับประโยคไทยบางประโยค
   (ยิง 4 ครั้งล้มทั้ง 4) → เปลี่ยนไปใช้ `gemini-3.1-flash-tts-preview` ซึ่งผ่าน 4/4 + ใส่ fallback ไล่โมเดล
9. **`weightOf` รับ token object แทน string** — `toks.map(weightOf)` ส่ง (el, i, arr) เข้าไป
   → แก้เป็น `toks.map(t => weightOf(t.w))`

## สิ่งที่ค้าง

1. **lip-sync ตรงระดับวลี ไม่ตรงระดับคำ** — Gemini TTS ไม่คืน timestamp
   ขอบบรรทัดเป๊ะ (วัดจากไบต์ PCM จริง) แต่ขอบคำมาจากการกระจายตามน้ำหนักพยางค์
   **ทางแก้ที่ตรงจุด:** สร้างคีย์ใน Google Cloud ที่เปิด Cloud Text-to-Speech API
   แล้วเปลี่ยน `"provider": "google"` — ได้ timestamp รายคำจริงผ่าน SSML `<mark>` โดยไม่ต้องแก้โค้ดอื่นเลย
2. **`api.elevenlabs.io` ยังถูก network policy บล็อก** — provider `elevenlabs` จึงยังทดสอบไม่ได้
   (ไม่ใช่ตัวขวางแล้ว เพราะ gemini ทำงานแทนได้ครบ)
3. **ไม่มี `ffmpeg`/`ffprobe` บนเครื่องนี้** — เลี่ยงด้วยการผสม WAV เองใน Node
   (`mixWav` ใน `cues.mjs`) วางแต่ละบรรทัดที่ตำแหน่ง sample เป๊ะ แม่นกว่า `adelay` ที่ปัดเป็น ms
4. งานภาพยังเรียบมาก — ยุงลอยอยู่จุดเดิมเกือบตลอด ข้อความชนเส้นขอบพื้นในบางเฟรม
   ถ้าจะใช้จริงควรใส่การเคลื่อนที่ตาม beat มากกว่านี้

## ก้าวถัดไป

1. ฟังคลิปแล้วบอกว่าเสียง `Charon` โอเคไหม — เปลี่ยนได้ที่ `geminiVoice` ใน `script.json` (มี 30 เสียงใน `tts-gemini.mjs`)
2. อยากได้ lip-sync เป๊ะระดับคำ → คีย์ Cloud TTS แล้วสลับ `provider` เป็น `google`
3. เพิ่มการเคลื่อนไหวตาม beat ในงานภาพ

**ไม่ต้องแตะโค้ดภาพเลยเวลาเปลี่ยนพากย์** เพราะเวลาทั้งหมดมาจาก `cues.json` — พากย์ยาวขึ้น ฉากยืดตามเอง
(รอบนี้พิสูจน์แล้ว: จาก estimate 31.7s → เสียงจริง 49.3s ภาพยืดตามเองโดยไม่แก้อะไรสักบรรทัด)

## คำสั่งที่ใช้บ่อย

```bash
node pipeline/keycheck.mjs               # เช็คว่าคีย์ที่มีใช้กับ provider ไหนได้
node pipeline/tts.mjs                    # ยิง/estimate ทีละบรรทัด + cache
node pipeline/cues.mjs                   # ประกอบ cues.json
node verify/verify.mjs out/cues.json     # ตรวจสัญญา
SH=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
node verify/frames.mjs --browser $SH     # เฟรมตัวแทนทุก beat + สแกน NaN
npx remotion render Scene out/final.mp4 --concurrency=3 --crf=20 --browser-executable=$SH
```
