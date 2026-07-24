# BGM PROMPTS — ดนตรีประกอบช่อง ถอดรหัสจักรวาล

ใช้กับ Suno / Udio / ElevenLabs Music / Stable Audio ฯลฯ (DashScope ไม่มีโมเดลเพลง)
หลัก: **instrumental ล้วน ไม่มีร้อง · เว้นที่ให้เสียงพากย์ · loop ได้ · เบา ๆ ไม่กลบเสียง**

---

## 🎵 1. MAIN BED — ตัวหลัก (ใช้ ~70% ของคลิป เล่าเนื้อหาทั่วไป)

```
Curious, uplifting cosmic background music for a science explainer video.
Light plucky synth arpeggios, soft warm pads, gentle pulsing sub bass, subtle
marimba and glockenspiel sparkles, a sense of wonder and discovery. Playful but
intelligent, very spacious mix with lots of room for a voiceover on top.
Instrumental, no vocals, no loud drums. Tempo ~90 BPM, loopable, steady low-mid
energy. Mood: exploring the universe and decoding its mysteries.
```

## 🌑 2. MYSTERY / TENSION — ช่วงลึกลับ/ดราม่า (ตกหลุมดำ, ตายสองครั้ง, เอกฐาน)

```
Mysterious, suspenseful ambient space music. Deep low drones, slow evolving
pads, distant twinkling bells, a subtle heartbeat-like pulse, faint eerie
shimmer. Dark cosmic wonder with quiet building tension. Minimal and
atmospheric with plenty of headroom for narration. Instrumental, no vocals.
Tempo ~70 BPM, cinematic, loopable. Mood: standing at the edge of a black hole,
facing the unknown.
```

## ⚡ 3. HOOK / OUTRO — อินโทร + ปิดท้าย CTA (ปลุกพลัง ดึงให้ดูต่อ)

```
Energetic, punchy cosmic intro/outro music for a YouTube science channel.
Bright driving synth pulse, catchy plucky melody, crisp claps, upbeat
electronic groove, a hooky riser and a satisfying hit at the end. Fun, modern,
exciting, makes you want to keep watching. Instrumental, no vocals. Tempo
~120 BPM, short and loopable. Mood: exciting space adventure, hype and curiosity.
```

---

## 🎚️ วิธีใช้ในคลิป
- **ระดับเสียง:** ลด BGM ให้อยู่ราว **−18 ถึง −22 dB** ใต้เสียงพากย์ (ดัก/duck ตอนพูด)
- **จับคู่ช่วง EP.01:** #3 อินโทร 0:00–0:17 + outro 4:36–5:07 · #1 เนื้อหาทั่วไป · #2 ACT2 (ตก) + ACT3 (ตายสองครั้ง) + ACT4 (เอกฐาน)
- **ความยาว:** gen ~30–60 วิ แล้ว loop / หรือขอ full-length ถ้าเครื่องมือรองรับ
- **ไฟล์:** เซฟเป็น `music/bed.mp3`, `music/mystery.mp3`, `music/hook.mp3` — เดี๋ยว HyperFrames ผสมให้อัตโนมัติได้ (ผมเพิ่มฟีเจอร์ mix BGM ให้ในคลิปหน้าได้)
