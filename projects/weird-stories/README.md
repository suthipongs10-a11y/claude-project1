# weird-stories — คลิปเล่าเรื่องประหลาด คดีแปลก จากทั่วโลก

pipeline ทำคลิปสารคดีสั้นแบบ **ภาพนิ่ง + Ken Burns + เสียงบรรยายไทย** ตั้งแต่ต้นจนได้ mp4
ใช้ Gemini API ทั้งหมด (TTS / ภาพ / ดนตรี) และ ffmpeg ประกอบ — **รันจบได้ในเซสชันนี้ ไม่ต้องพึ่ง PC**

> โปรเจกต์นี้แยกจาก `projects/2026-07-*` (Story Remix) ที่ต้องใช้ CapCut + ElevenLabs บนเครื่อง PC
> ตัวนี้ออกไฟล์ mp4 สำเร็จรูปเลย

---

## เริ่มยังไง

```bash
cd projects/weird-stories

# 1. เขียนสคริปต์ + shotlist ของตอนใหม่
mkdir -p episodes/ep01-ghost-blimp
# สร้าง script.json และ shots.json (ดูตัวอย่างใน episodes/ep00-demo-dancing-plague/)

# 2. gen เสียง -> audio/*.wav + audio/timing.json
python3 tools/gen_voice.py episodes/ep01-ghost-blimp/script.json

# 3. gen ภาพ -> images/*.jpg
python3 tools/gen_images.py episodes/ep01-ghost-blimp/shots.json

# 4. gen ดนตรีประกอบ -> audio/bgm.mp3   (ข้ามได้)
python3 tools/gen_music.py episodes/ep01-ghost-blimp "dark ambient drone, tense, no vocals"

# 5. ประกอบเป็นคลิป -> output.mp4
python3 tools/build_video.py episodes/ep01-ghost-blimp
python3 tools/build_video.py episodes/ep01-ghost-blimp --vertical   # เวอร์ชัน Shorts
```

ทุกสเตปเป็น **incremental** — gen แล้วข้ามของเดิม ถ้าอยากแก้เฉพาะบางท่อน/บางช็อต ใส่ id ต่อท้าย:

```bash
python3 tools/gen_voice.py  episodes/ep01/script.json s03 s07   # อัดเสียงใหม่แค่ 2 ท่อน
python3 tools/gen_images.py episodes/ep01/shots.json  v04       # วาดภาพใหม่แค่ช็อตเดียว
```

---

## โครงสร้าง

```
tools/
  gemini_api.py     ตัวกลางคุย Gemini API — หมุน 3 keys อัตโนมัติเมื่อโควตาเต็ม
  gen_voice.py      สคริปต์ -> เสียงบรรยายไทย (WAV แยกไฟล์ต่อท่อน + timing.json)
  gen_images.py     shotlist -> ภาพประกอบ
  gen_music.py      prompt -> BGM (Lyria)
  captions.py       เรนเดอร์ซับไทยเป็น PNG ด้วย Pillow (ห้ามเปลี่ยนไปใช้ libass — ดูเหตุผลในไฟล์)
  build_video.py    ประกอบทุกอย่างเป็น mp4
assets/fonts/       Noto Sans Thai (SIL OFL)
episodes/<ตอน>/
  script.json       สคริปต์บรรยาย แบ่งเป็น segments
  shots.json        รายการภาพ + บอกว่าช็อตไหนคลุม segment ไหน
  audio/            เสียงที่ gen แล้ว + timing.json + bgm
  images/           ภาพที่ gen แล้ว (เอาภาพจริงมาวางเองก็ได้ ใช้ชื่อ id เดียวกัน)
  output.mp4        ผลลัพธ์  (ไม่ commit — .gitignore กัน *.mp4 ไว้)
CAPABILITIES.md     ผลทดสอบความสามารถทั้งหมด (ทำได้ / ทำไม่ได้)
story-ideas.md      หัวข้อที่รีเสิร์ชไว้แล้ว + สถานะความเป็นไปได้
```

---

## รูปแบบไฟล์

**`script.json`**
```json
{
  "title": "ชื่อตอน",
  "voice": "Charon",
  "style": "อ่านแบบผู้บรรยายสารคดีลึกลับ เสียงต่ำ พูดช้า เว้นจังหวะก่อนประโยคสำคัญ",
  "segments": [
    { "id": "s01", "text": "..." },
    { "id": "s02", "text": "...", "voice": "Kore" }
  ]
}
```

**`shots.json`**
```json
{
  "model": "gemini-3-pro-image",
  "aspect": "16:9",
  "style": "cinematic documentary still, 35mm film grain, no text or watermark",
  "shots": [
    { "id": "v01", "seg": "s01", "prompt": "..." },
    { "id": "v02", "seg": ["s02", "s03"], "prompt": "..." }
  ]
}
```
`seg` บอกว่าช็อตนี้ค้างอยู่ระหว่าง segment ไหนบ้าง → ความยาวช็อตคำนวณจากความยาวเสียงจริง

---

## เคล็ดลับเขียนสคริปต์ให้ TTS อ่านถูก

- **เขียนตัวเลขเป็นคำ** — `1518` อ่านผิดได้ ให้เขียน `หนึ่งห้าหนึ่งแปด` หรือ `ปี ค.ศ. 1518` (แบบหลังอ่านถูก)
- **ใส่ช่องว่างคั่นวลี** แทนการใช้จุลภาค — TTS ใช้ช่องว่างเป็นจังหวะหายใจ และ `captions.py` ก็ใช้ตัดบรรทัดซับด้วย
- **ชื่อต่างประเทศให้ทับศัพท์ไทย** — `Frau Troffea` → `ฟราว โทรฟเฟีย`
- **ท่อนละ 15–30 วินาที** — ยาวกว่านี้ซับจะซอยเยอะและแก้ยากเวลาอยากอัดใหม่

## เคล็ดลับเขียน prompt ภาพ

- บรรยาย **ฉาก แสง มุมกล้อง อารมณ์** ไม่ใช่แค่ชื่อสิ่งของ
- ปิดท้าย `style` ด้วย `no text, no watermark` เสมอ — โมเดลชอบแอบใส่ตัวหนังสือ
- **อย่าให้โมเดลเขียนภาษาไทยลงในภาพ** สะกดเพี้ยนแน่นอน ใส่ตัวหนังสือทีหลังด้วย `captions.py`
- อย่าขอให้วาดหน้าคนจริงที่ยังมีชีวิต

---

## กติกาภาพ (สำคัญ — อย่าข้าม)

ภาพในคลิปทุกใบเป็น **ภาพที่ AI สร้างขึ้นใหม่ ไม่ใช่ภาพถ่ายของเหตุการณ์จริง**
เพราะเครื่องนี้โหลดภาพจากอินเทอร์เน็ตไม่ได้ (เน็ตถูกบล็อก — ดู `CAPABILITIES.md`)

ดังนั้นทุกคลิปต้อง:
1. ขึ้นข้อความกำกับช่วงต้นคลิปว่า **"ภาพประกอบเป็นภาพจำลอง"**
2. ใส่บรรทัดเดียวกันไว้ในคำอธิบายวิดีโอ พร้อมลิสต์แหล่งอ้างอิงของเนื้อหา
3. ไม่วาดภาพให้ดูเหมือนหลักฐานจริง (เอกสารราชการปลอม ภาพถ่ายที่เกิดเหตุปลอม)

ถ้าอยากใช้ภาพจริง ให้โหลดมาเองบนเครื่องคุณแล้ววางไว้ใน `episodes/<ตอน>/images/`
ตั้งชื่อไฟล์ตาม id ของช็อต (เช่น `v03.jpg`) — pipeline หยิบไปใช้ทันที ไม่ต้องแก้โค้ด

---

## ติดตั้ง (ถ้าเปิดเซสชันใหม่แล้วของหาย)

```bash
pip3 install imageio-ffmpeg pillow
```

ต้องมี env `GOOGLE_TTS_API_KEY` (ใส่ได้หลาย key คั่นด้วยคอมมา) — **อย่า commit key ลง repo**
