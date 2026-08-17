# Web-Review Clip Pipeline

คลิปรีวิวแนว "เปิดหน้าเว็บของสินค้า สลับกับฟุตเทจ + เสียง TTS" — แบบที่ช่องรีวิว AI ทำกัน
ทำงานได้ทั้งบน Claude Code cloud (มือถือ) และบน PC

```
pipeline/
  capture_web.mjs   Playwright: แคปหน้าเว็บต้นทาง → full.png / view-NN.png / sel-*.png / scroll.webm
  captions.py       Pillow: วาด caption + ป้ายแหล่งที่มา เป็น PNG โปร่งใส
  fit_timing.py     ยืด/ย่อ dur ของทุก shot ให้รวมเท่าความยาวเสียงพากย์
  assemble.py       ffmpeg: ต่อ shot → ใส่เสียง → ออก MP4 (16x9 / 9x16 / 1x1)
demo/
  nimbus-desk.html  หน้าเว็บสินค้า *สมมติ* สำหรับเทสต์ pipeline (ไม่ใช่บริษัทจริง)
shotlist.json       ไฟล์คุมทั้งคลิป
```

## รันทั้งกระบวนการ

```bash
npm install                     # playwright (เบราว์เซอร์มีอยู่ในเครื่องแล้ว)
pip install imageio-ffmpeg pillow

# 1) แคปหน้าเว็บต้นทาง
node pipeline/capture_web.mjs --url https://<สินค้า>.com \
  --out capture/<ชื่อ> --views 4 --sel "pricing=#pricing" --video

# 2) เสียงพากย์ → วางไว้ที่ vo/full.mp3  (ดู "เสียง" ด้านล่าง)

# 3) จับ timing ให้ตรงเสียง
python3 pipeline/fit_timing.py shotlist.json --vo vo/full.mp3 --tail 1.2 -o shotlist.json

# 4) เรนเดอร์
python3 pipeline/assemble.py shotlist.json --aspect 16x9 -o out/review-16x9.mp4
python3 pipeline/assemble.py shotlist.json --aspect 9x16 -o out/review-9x16.mp4
```

## shot types

| type | ใช้ทำอะไร | คีย์สำคัญ |
|---|---|---|
| `web_pan` | สกรอลล์ลงบนภาพเต็มหน้า | `pan` (down/up), `travel` (สกรอลล์กี่ % ของหน้า), `start_at` (เริ่มที่ % ไหน), `zoom` |
| `web_hold` | ภาพนิ่ง + ken burns | `zoom_to`, `focus` [x,y] 0–1, `fit` (cover/width) |
| `broll` | ฟุตเทจวิดีโอ crop เต็มเฟรม | `in` (ตัดเข้าวินาทีที่), วนซ้ำเองถ้าคลิปสั้น |
| `title` | การ์ดตัวอักษร | `bg`, `caption_scale` |

ทุก shot ใส่ได้: `caption`, `source_label` (ป้าย URL มุมซ้ายบน), `fade_in`, `fade_out`,
`lock` (ไม่ให้ fit_timing ยืด), `skip`

## สถานะบน Claude Code cloud (ทดสอบจริง 2026-08-17)

| ขั้นตอน | ในคลาวด์นี้ | หมายเหตุ |
|---|---|---|
| หาหัวข้อที่กำลังมาแรง | ทำได้ | WebSearch + vidIQ (keyword_research / trending_videos / outliers) |
| เขียนสคริปต์ | ทำได้ | |
| เสียงพากย์ | ทำได้ | vidIQ voiceover (เสียง ElevenLabs) → โหลดจาก S3 เข้าเครื่องได้ |
| ประกอบ + เรนเดอร์ MP4 | ทำได้ | ffmpeg 7.0.2 จาก `pip install imageio-ffmpeg` |
| **แคปหน้าเว็บจริง** | **ติด** | network policy ของ environment บล็อกเว็บนอก (403 ที่ CONNECT) |
| **โหลดฟุตเทจ Pixabay/Pexels** | **ติด** | `vidiq_generate_broll` คืน URL ได้ แต่ `videos.pexels.com` โหลดไม่ได้ |
| อัปขึ้น YouTube | ไม่ได้ | ต้องใช้บัญชีเจ้าของช่อง |

โดเมนที่เข้าได้ในคอนเทนเนอร์นี้: npm, pypi, crates, go proxy, `*.anthropic.com`,
`texttospeech.googleapis.com`, `storage.googleapis.com`, S3 ของ vidIQ, localhost
— ที่เหลือ 403 หมด

### ปลดล็อก 2 ข้อที่ติด
เปิด network policy ของ environment ให้กว้างขึ้น (ดู
https://code.claude.com/docs/en/claude-code-on-the-web) หรือ allowlist เฉพาะ:
เว็บสินค้าที่จะรีวิว + `videos.pexels.com` + `cdn.pixabay.com`
ถ้าเปิดให้แล้ว pipeline นี้จบงานได้เองทั้งหมดในคลาวด์

## เสียง

3 ทาง เลือกอันใดก็ได้ ปลายทางคือไฟล์ `vo/full.mp3`

1. **vidIQ MCP** (ใช้ในเดโมนี้) — `vidiq_voiceover_generate` + `vidiq_job_poll`
   คิด 14 credits / 1000 ตัวอักษร ≈ 1 คลิปสั้น 14–28 credits
2. **ElevenLabs ตรง** — pipeline เดิมที่ `projects/2026-07-*/elevenlabs/` ใช้อยู่ ต้องมี `.env` (คีย์อยู่บน PC)
3. **Google Cloud TTS** — env `GOOGLE_TTS_API_KEY` ในคลาวด์นี้ใช้ไม่ได้ (invalid) ต้องใส่คีย์จริง

## ข้อควรระวังก่อนปล่อยคลิป

- **ภาพหน้าเว็บ**: การแคปหน้าเว็บมาประกอบรีวิว/วิจารณ์ ปกติถือเป็น fair use ได้ แต่ต้อง
  เป็นการรีวิวจริง มีความเห็นของเราเอง และควรติด `source_label` บอกที่มาไว้ในเฟรม
  ห้ามสร้างหน้าเว็บปลอมแล้วทำเหมือนเป็นของบริษัทจริง
- **ฟุตเทจ Pexels/Pixabay**: ฟรีแต่ต้องเครดิตช่างภาพ — `vidiq_generate_broll` คืนชื่อ
  `photographer` + `pageUrl` มาให้ เก็บลง description ทุกครั้ง
- **ตัวเลขในคลิป**: ตัวเลขที่อ่านจากหน้าเว็บผู้ขายคือ "ที่ผู้ขายอ้าง" ควรพูดตามนั้น
  อย่าเปลี่ยนเป็นข้อเท็จจริงลอย ๆ
- **เสียง AI**: YouTube ต้องติ๊ก "altered or synthetic content" ตอนอัปโหลด

## เดโมที่เรนเดอร์ไว้แล้ว

`out/PIPELINE-DEMO-16x9.mp4` — 1:17 นาที 1920×1080 30fps
สินค้าในคลิปเป็น **ของสมมติ** (`demo/nimbus-desk.html`) เพราะเว็บจริงยังแคปไม่ได้
พิสูจน์ว่า capture → caption → ken burns → สลับ b-roll → เสียงพากย์ → เรนเดอร์ ครบทุกขั้น
