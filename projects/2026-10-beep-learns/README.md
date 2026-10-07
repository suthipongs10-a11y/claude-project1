# BEEP Learns — โปรเจกต์คลิปการ์ตูน Motion Studio

ช่อง "BEEP Learns": การ์ตูนโค้ดแอนิเมชัน (BEEP / MOCHI / ชาวบ้าน) สอนคำศัพท์อังกฤษผ่านวัฒนธรรมแต่ละประเทศ เรนเดอร์เป็น MP4 (16:9 / 9:16)

## โครงสร้าง
```
motion-studio-kit/
  SKILL.md        # คู่มือ skill /motion-studio (Brief -> อนุมัติ -> สร้าง) + กฎบ้าน + ตัวละครที่ล็อก
  README_TH.md    # วิธีใช้ชุดนี้
  kit/            # engine: ตัวละคร, เสียง Piper, ดนตรี/SFX, ซับ, ตัวเรนเดอร์
  pilot/          # ตอนตัวอย่าง "BEEP in JAPAN: The Bow" (episode.js, story.js, vo/, MP4)
episodes/         # ตอนใหม่ (สร้างตอนเริ่มทำแต่ละตอน)
```

## วิธีทำตอนใหม่
1. พิมพ์ `/motion-studio` + หัวข้อ เช่น "BEEP ไปออสเตรเลีย" -> Claude ส่ง Brief ภาษาไทยก่อน
2. ตอบ "ผ่าน สร้างได้เลย 16:9 ยาว 90 วิ" -> Claude สร้างและเรนเดอร์ MP4
3. ต้องมี Node 18+, Python 3, ffmpeg (`bash kit/setup.sh`)

หมายเหตุ: `*.mp4` และ `*.zip` อยู่ใน .gitignore ของ repo ดังนั้นไฟล์ MP4 pilot อยู่ในเครื่อง/เซสชันเท่านั้น ไม่ถูก commit
