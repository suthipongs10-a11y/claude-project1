# 2026-07-alaska-crab — "The Deadliest Job on Earth" (Vox-Style Motion Graphics)

**สถานะ: เดโม่สไตล์ใหม่เสร็จ (46 วิ) — รอเสียงพากย์ + build CapCut บน PC**

คลิปนำร่อง format ใหม่: ไม่ใช้ฟุตเทจคนอื่นเลย กราฟิก paper-collage สไตล์ Vox ที่ gen
จากโค้ด 100% → ตัดปัญหาเสียงต้นฉบับทับเสียงพากย์ + ปลอด copyright/Content ID

## Phase 1 — Niche/Angle
- หัวข้อ: การจับปูอลาสก้า (Bering Sea king/snow crab) — เรื่องดังจาก Deadliest Catch
- Angle: งานที่ตายง่ายที่สุดในโลก + ทวิสต์ปี 2022 ที่ปู 10 พันล้านตัวหายไป
- Part 2 ที่ tease ไว้ท้ายคลิป: "The $200M Ghost Fleet" (กองเรือตกงานหลังปิดฤดูจับปู)

## Phase 2 — ข้อเท็จจริงที่ใช้ (เช็คแล้ว)
- ฐานเรือปู: Dutch Harbor (Unalaska), ทะเล Bering
- ลอบเหล็ก (pot) หนัก ~600-800 lbs ใช้ปลา cod เป็นเหยื่อ, วางลึก ~100-200 m, แช่ 24-48 ชม.
- รายได้ deckhand ช่วงฤดูดี: หลักหมื่นดอลลาร์ต่อทริปไม่กี่วัน
- อัตราการเสียชีวิตสูงกว่าค่าเฉลี่ยอาชีพทั่วไปหลายสิบเท่า (ยุค 90s สูงถึง ~26x-80x
  แล้วแต่ช่วง/วิธีนับ — ในคลิปใช้ "~80x" ใส่ ~ กำกับ) สาเหตุหลัก: ตกน้ำ/เรือคว่ำจากน้ำแข็งเกาะ
- 2022: ยกเลิกฤดู snow crab ครั้งแรกในประวัติศาสตร์ — ประชากรหายไป ~10 พันล้านตัว
  (2018-2021) สาเหตุที่นักวิจัย NOAA สรุป: marine heatwave 2018-19 → เมตาบอลิซึมเร่ง
  → อดตาย (ไม่ใช่ถูกจับเกิน)

## Phase 3-4 — Outline + สคริปต์เสียงพากย์ (ElevenLabs, EN, ~45-50 วิ)
ต่อฉาก (ตรงกับ scene01-08 ใน assets/):
1. (0:00) "This is the deadliest job on Earth. And it's about catching... crab."
2. (0:05) "Welcome to the Bering Sea — Dutch Harbor, Alaska. Winter water: two degrees."
3. (0:10) "The tool: a 750-pound steel cage. Bait it with cod, and crabs crawl in — but can't crawl out."
4. (0:16) "Drop it a hundred meters deep. Wait two days. Haul it up — full... or empty."
5. (0:22) "One good trip pays a deckhand over ten thousand dollars. In five days."
6. (0:27) "The catch? Minus twenty, forty-foot waves, and ice that builds up until boats flip. This job kills at eighty times the average rate."
7. (0:33) "Then, in 2022 — ten billion snow crabs just... vanished. The season was canceled for the first time ever."
8. (0:39) "A marine heat wave had spiked their metabolism. There wasn't enough food. They starved. Follow for part two: the two-hundred-million-dollar ghost fleet."

## ไฟล์ในโปรเจกต์
- `vox_style.py` — engine กราฟิก: กระดาษ, ขอบฉีก, วงไฮไลต์/ลูกศรเขียนมือ (draw-on ได้),
  ป้ายกระดาษ, ภาพลายเส้น (ปู, เรือ, ลอบ, แผนที่อลาสก้า, ไอคอน)
- `render_preview.py` — ประกอบ 8 ฉาก + animate + เรนเดอร์ MP4 ผ่าน ffmpeg
  - `python3 render_preview.py --stills` → PNG ท้ายฉากลง assets/ (ใช้เป็น asset CapCut ได้เลย)
  - `python3 render_preview.py out.mp4` → วิดีโอเต็ม 1080x1920@30
- `assets/scene01-08.png` — การ์ดนิ่งของแต่ละฉาก
- `capcut-shotlist.json` — สำหรับ build ลง CapCut draft บน PC

## งานที่เหลือ (ทำบน PC)
1. gen เสียงพากย์ 8 ท่อนด้วย ElevenLabs (สคริปต์ด้านบน) → elevenlabs/
2. ปรับ duration แต่ละฉากใน shotlist ให้ตรงความยาวเสียงจริง
3. build ลง CapCut draft **"0711(2)"** ด้วย skill capcut-draft-editor
   (ทางเลือก: เรนเดอร์ MP4 จากคลาวด์แล้วโยนลง CapCut เป็นคลิปเดียว + วางเสียงทับ)
4. เพลงประกอบ: แทร็กใน preview เป็น placeholder — บน PC ใช้เพลง library ของ CapCut แทน
