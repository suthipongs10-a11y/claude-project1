# HANDOFF — ทำต่อบน PC (C:\Work\VideoTest) กับ Claude Desktop

> **สำหรับ Claude:** ผู้ใช้ย้ายงานจาก Claude Code cloud มาทำต่อบนเครื่องนี้
> อ่านไฟล์นี้จบแล้วเริ่มที่หัวข้อ "งานแรกที่ต้องทำ" ได้เลย — ทุกอย่างเตรียมไว้ให้แล้ว

## บริบทโปรเจกต์ (อัปเดต 11 ก.ค. 2026)

ช่อง YouTube Shorts ใหม่ชื่อ **Mr.WhyLab** — explainer การเงิน/ธุรกิจ สไตล์ **Vox paper-collage
gen จากโค้ด Python 100%** (ไม่ใช้ฟุตเทจภายนอก → ปลอด Content ID, ไม่มีปัญหาเสียงต้นฉบับทับเสียงพากย์)
นี่คือ format ใหม่ที่มาแทนแนว remix ฟุตเทจของ 2 โปรเจกต์แรก (en-football, outdoorboys — เสร็จ รอ export ใน CapCut ตามเดิม)

สถานะบน branch `claude/project-status-summary-fot6bk` (ต้อง pull ก่อนเริ่ม):

| โปรเจกต์ | สถานะ |
|---|---|
| `projects/2026-07-alaska-crab` | เดโม่พิสูจน์สไตล์ (46 วิ) — เสร็จ ไม่ต้องทำอะไรต่อ |
| `projects/2026-07-ai-circular` | **คลิปแรกจริงของช่อง — เหลือแค่เสียงพากย์** ← งานปัจจุบัน |

คลิป: **"The $1.4 Trillion Bet: AI's Circular Deal"** — 9 ฉาก อธิบายดีลวนเวียน OpenAI/Nvidia/AMD,
เทียบ dot-com, Michael Burry ชอร์ต $1.1B, ปิดด้วย "Bubble or Revolution?"
ข้อมูลเช็คแล้วทั้งหมด ดู `projects/2026-07-ai-circular/phase1-4-research-script.md`

## ⚠️ เรื่องความปลอดภัยที่ต้องบอกผู้ใช้ก่อนเริ่ม

API key ElevenLabs ตัวเก่า (`sk_8dd8...af6c`) **ถูกวางในแชท cloud session ไปแล้ว — ต้อง revoke ทิ้ง**
ให้ผู้ใช้เข้า elevenlabs.io → API Keys → ลบตัวเก่า → **สร้างตัวใหม่** มาใช้ในไฟล์ .env ด้านล่าง
(.env ถูก gitignore แล้ว ห้าม commit คีย์เด็ดขาด)

## งานแรกที่ต้องทำ: gen เสียงพากย์ + เรนเดอร์ final

เครื่องนี้ต้องมี: **Node.js, ffmpeg, Python + pillow + numpy** (ถ้าขาด: `pip install pillow numpy`)
โค้ดรองรับ Windows แล้ว (ฟอนต์ fallback ไป Georgia/Times อัตโนมัติ)

```powershell
cd C:\Work\VideoTest
git fetch origin claude/project-status-summary-fot6bk
git checkout claude/project-status-summary-fot6bk

cd projects\2026-07-ai-circular\elevenlabs
# 1) สร้างไฟล์ .env (คีย์ใหม่ที่เพิ่งสร้าง):
#    ELEVENLABS_API_KEY=sk_ใหม่...
#    VOICE_ID=N2lVS1w4EtoT3dr4eOWO
# 2) gen เสียง 9 ท่อน → audio/seg-01..09.mp3 + timing.json
node pipeline.mjs gen

# 3) เรนเดอร์วิดีโอสุดท้าย (ยืดฉากพอดีเสียง + mix เสียงพากย์กับเพลงอัตโนมัติ)
cd ..
python render_ai.py --final mrwhylab-ai-final.mp4
```

### เรื่องเสียง (ผู้ใช้เลือกไว้แล้ว: ไม่เอา Adam)
- แนะนำ **Callum** (`N2lVS1w4EtoT3dr4eOWO`) — ทุ้มกร้าว เข้ม เข้าธีมการเงินระทึก
- สำรอง: Brian `nPczCjzI2devNBz1zQrb` (สารคดีนุ่ม), George `JBFqnCBsd6RMkjVDRZzb` (อังกฤษสุขุม)
- ถ้า id ไหนไม่มีในบัญชี: `node pipeline.mjs voices` แล้วเลือกเสียงผู้ชายทุ้มโทน documentary แทน
- ปรับโทน/ความเร็วรายท่อนได้ใน `elevenlabs/segments.json` แล้ว `node pipeline.mjs gen --force`

### กลไก `--final` (อยู่ใน render_ai.py แล้ว ทดสอบ end-to-end ผ่านแล้ว)
- อ่าน `elevenlabs/timing.json` → ยืดแต่ละฉากเป็น `เสียง + HEAD 0.45s + TAIL 0.9s`
- เรนเดอร์เงียบ → mux: เสียงพากย์วางตรงต้นฉาก (seg-01→scene01...), เพลงรองพื้นหรี่เหลือ 13%
- ผลลัพธ์จะยาว ~75-85 วิ ถ้าผู้ใช้อยากให้ต่ำกว่า 60 วิ (Shorts) → ตัดสคริปต์ใน segments.json
  ให้กระชับ (ตัด scene 4 หรือ 8 ออกได้โดยเรื่องยังครบ) แล้วแก้ build_scenes() ให้ตรงกัน
- เพลงใน pipeline เป็น placeholder ที่ gen จาก numpy — แนะนำให้ถามผู้ใช้ว่าจะเปลี่ยนเป็น
  เพลง library จริงไหม (วางทับใน CapCut หรือ ffmpeg ก็ได้)

## โครงสร้างโค้ด (โปรเจกต์ ai-circular)
- `vox_style.py` — engine กลาง: paper texture, ขอบกระดาษฉีก, วงไฮไลต์/ลูกศรเขียนมือ (draw-on),
  ป้ายกระดาษ, ฟอนต์ cross-platform
- `finance_shapes.py` — ชิป, โหนดบริษัท (auto-fit ชื่อ), กราฟฟองสบู่, หมี, แว่นขยาย, brain-chip
- `render_ai.py` — build_scenes() 9 ฉาก + El/Stroke animation + `--stills` / preview / `--final`
- `assets/scene01-09.png` — การ์ดนิ่งท้ายฉาก (ใช้เช็คงานหรือทำ thumbnail ได้)
- `VOICEOVER.md` — คู่มือเสียงละเอียด

## หลังคลิปแรกเสร็จ (คิวถัดไปที่คุยกันไว้)
1. โพสต์คลิป: title แนว "AI's $1.4 Trillion Circular Bet" + tease Part 2
2. คลิปที่ 2 ตัวเลือกที่รีเสิร์ชไว้แล้ว: **"TikTok ฆ่าราชาทีวี" (QVC/HSN ล้มละลาย)** —
   ข้อมูลอยู่ในหัวแชท cloud แล้วบางส่วน: หนี้ $6.6B→$1.3B, ยอดขาย $14B→$8.3B,
   เคเบิล 96M→68M ครัวเรือน, โดน TikTok Shop/Shein แย่งลูกค้า
3. แนวทางเลือกหัวข้อ: การเงิน/ธุรกิจ + เกาะกระแสไวรัล ("ทำไม X ถึงเกิด") — เรื่องต้อง
   เล่าได้ด้วยตัวเลข/ไดอะแกรม/แผนที่ ไม่พึ่งฟุตเทจ

## Git
- ทำงานบน branch `claude/project-status-summary-fot6bk` (มีทุกอย่างล่าสุด)
- ห้าม commit: .env, *.mp3 ใน audio/ (commit ได้ถ้าจะให้ cloud เรนเดอร์แทน), *.mp4 (gitignore แล้ว)
