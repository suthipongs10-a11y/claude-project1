# วิธีใส่เสียงพากย์ (ElevenLabs) — คลิป AI Circular Deal

**ไม่ต้องใช้ Claude Desktop** — รันบนเครื่องไหนก็ได้ที่มี ElevenLabs API key (คือ `.env` บน PC ของคุณ)
ต้องมี: **Node.js**, **ffmpeg**, และ (ถ้าจะเรนเดอร์เอง) **Python + Pillow + numpy**

มี 2 ทางเลือก — เลือกทางใดทางหนึ่ง:

---

## ทาง A — ทำครบจบบน PC (ถ้า PC มี Python + Pillow + numpy)

```bash
cd projects/2026-07-ai-circular/elevenlabs

# 1) สร้าง .env (ครั้งเดียว)
#    ELEVENLABS_API_KEY=xi-...
#    VOICE_ID=...        # ถ้ายังไม่รู้ ให้ดูข้อ 2

# 2) (ถ้ายังไม่มี VOICE_ID) ลิสต์เสียง แล้วเลือกเสียงผู้ชายทุ้ม โทน documentary
node pipeline.mjs voices

# 3) gen เสียง 9 ท่อน → audio/seg-01..09.mp3 + timing.json
node pipeline.mjs gen

# 4) เรนเดอร์วิดีโอสุดท้าย (ยืดฉากพอดีเสียง + รวมเสียง+เพลงอัตโนมัติ)
cd ..
pip install pillow numpy          # ครั้งเดียว ถ้ายังไม่มี
python3 render_ai.py --final mrwhylab-ai-final.mp4
```
ได้ไฟล์ `mrwhylab-ai-final.mp4` พร้อมโพสต์เลย 🎉

---

## ทาง B — gen เสียงบน PC แล้วให้ Claude (คลาวด์) เรนเดอร์ให้ (ถ้า PC ไม่มี Python graphics)

บน PC ทำแค่ข้อ 1-3 ข้างบน (Node + ffmpeg เท่านั้น) แล้ว push ไฟล์เสียงขึ้น branch:

```bash
cd projects/2026-07-ai-circular
git add elevenlabs/audio/*.mp3 elevenlabs/timing.json
git commit -m "add AI circular deal voiceover"
git push
```
จากนั้นบอก Claude ในเซสชันคลาวด์ว่า **"เสียงพากย์ push แล้ว เรนเดอร์ final ให้หน่อย"**
— Claude จะ pull, รัน `python3 render_ai.py --final`, แล้วส่งวิดีโอสุดท้ายกลับให้

---

## ปรับแต่งเสียง
- แก้ข้อความ/ความเร็วรายท่อนได้ที่ `elevenlabs/segments.json` (ฟิลด์ `text`, `speed`)
- `defaults` คุมโทนเสียงรวม: `stability` (สูง=นิ่ง), `style` (สูง=มีอารมณ์), `speed`
- แนะนำเสียงคลิปนี้: ผู้ชายทุ้ม จริงจัง โทนสารคดี (stability ~0.45, style ~0.3, speed ~1.0)
- gen ใหม่ทับ: `node pipeline.mjs gen --force`

## หมายเหตุจังหวะ
- `render_ai.py --final` จะ **ยืดความยาวแต่ละฉากอัตโนมัติ** ให้ = เสียงพากย์ + หัว 0.45s + ท้าย 0.9s
  (ปรับค่า `HEAD`, `TAIL` ได้ในไฟล์)
- เพลงรองพื้นจะถูกหรี่ลงเหลือ ~13% ใต้เสียงพากย์อัตโนมัติ
- เสียงพากย์แต่ละท่อนวางตรงต้นฉากที่ตรงกัน (seg-01 → scene01 ...)
- `.env` และ `audio/*.mp3` **ไม่ควร commit key** — commit เฉพาะไฟล์เสียงถ้าใช้ทาง B
