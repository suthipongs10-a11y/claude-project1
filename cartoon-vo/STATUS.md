# STATUS

## M ล่าสุดที่ผ่าน

**M5 · Verify harness** — ผ่าน · M6 เรนเดอร์ออกไฟล์ได้แล้วแต่ยัง**ตรวจรับไม่ครบ** (ไม่มีเสียง)

| M | สถานะ | Acceptance |
|---|---|---|
| M0 โครงโปรเจกต์ | ✅ | `.env` ไม่ถูก track · `node -e "import('./src/timing.ts')"` exit 0 |
| M1 TTS + cache | ⚠️ **ผ่านครึ่งเดียว** | รอบสอง cached ครบ 10 บรรทัด · network request = 0 **แต่รอบแรกยังไม่เคยยิงจริง** (ไม่มีคีย์) |
| M2 Alignment → คำ | ✅ | ทุกคำ `s < e` · ไม่ทับกัน · เทสต์ `"ผึ้ง 3 ตัวบินมาที่นี่"` ตัดได้ `ผึ้ง|3|ตัว|บิน|มา|ที่|นี่` เวลาไม่กระโดด |
| M3 cues.json | ✅ | `verify.mjs` exit 0 · *(ยังไม่ได้เทียบกับ `ffprobe` เพราะไม่มีไฟล์เสียง)* |
| M4 Remotion components | ✅ | `grep -nE "[^a-zA-Z](8\.6\|12\.6\|17\.2)" src/` ไม่เจอ · `remotion still` ออกภาพได้ |
| M5 Verify harness | ✅ | `verify.mjs` ผ่าน · `frames.mjs` เรนเดอร์ 9 เฟรม (กลางทุก beat) + สแกน NaN ไม่เจอ · **ดูด้วยตาแล้ว** |
| M6 เรนเดอร์จริง | ⚠️ | ได้ `out/final.mp4` 31.7s 1920×1080 30fps ไฟล์สมบูรณ์ · **แต่ยังฟังไม่ได้ว่าปากตรงเสียง เพราะยังไม่มีเสียง** |

## ยอด API call สะสม

**0** — ยังไม่ได้ยิง ElevenLabs แม้แต่ครั้งเดียว (cache ทั้ง 10 บรรทัดเป็นโหมด estimate)

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

## สิ่งที่ค้าง

1. **ไม่มี `ELEVENLABS_API_KEY`** และ **`api.elevenlabs.io` ถูก network policy บล็อก**
   → M1 ครึ่งหลัง, M3 ส่วน `ffprobe`, และ M6 ทั้งหมด ตรวจรับไม่ได้จนกว่าจะแก้
   วิธีแก้: ใส่คีย์ในช่อง Environment variables + เพิ่มโดเมนใน Allowed domains ของ environment
2. **ไม่มี `ffprobe`** — M3 เขียนโค้ดวัดไว้แล้วแต่ยังไม่เคยรันจริง
3. งานภาพยังเรียบมาก — ยุงลอยอยู่จุดเดิมเกือบตลอด ข้อความชนเส้นขอบพื้นในบางเฟรม
   ถ้าจะใช้จริงควรใส่การเคลื่อนที่ตาม beat มากกว่านี้

## ก้าวถัดไป

พอมีคีย์แล้ว: `node pipeline/tts.mjs` → `node pipeline/cues.mjs` → `node verify/verify.mjs out/cues.json` → เรนเดอร์
**ไม่ต้องแตะโค้ดภาพเลย** เพราะเวลาทั้งหมดมาจาก `cues.json` — พากย์ยาวขึ้น ฉากยืดตามเอง

## คำสั่งที่ใช้บ่อย

```bash
node pipeline/tts.mjs                    # ยิง/estimate ทีละบรรทัด + cache
node pipeline/cues.mjs                   # ประกอบ cues.json
node verify/verify.mjs out/cues.json     # ตรวจสัญญา
SH=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
node verify/frames.mjs --browser $SH     # เฟรมตัวแทนทุก beat + สแกน NaN
npx remotion render Scene out/final.mp4 --concurrency=3 --crf=20 --browser-executable=$SH
```
