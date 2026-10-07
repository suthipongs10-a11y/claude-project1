# Motion Studio: ชุดผลิตช่อง BEEP Learns

## ในแพ็กนี้มีอะไร
- `SKILL.md`: คู่มือการทำงานของ AI ตั้งแต่ Brief → อนุมัติ → สร้างคลิป รวมกฎบ้าน และข้อมูลตัวละครที่ล็อกไว้
- `kit/`: เครื่องยนต์ทั้งหมด
  - ตัวละคร BEEP / MOCHI / ชาวบ้าน (โค้ดล็อก หน้าตาเหมือนเดิมทุกตอน)
  - ระบบเสียงพูด Piper ฟรี พร้อมลิปซิงก์
  - ดนตรีและเสียงเอฟเฟกต์ 60 แบบ
  - ซับ, การ์ดเปิดตอน, การ์ด "Today BEEP learned"
  - ตัวเรนเดอร์ 16:9 / 9:16
- `pilot/`: ตอนตัวอย่าง "BEEP in JAPAN: The Bow" ไว้ให้ AI ใช้อ้างอิงเวลาเขียนตอนใหม่

## ใช้กับ Claude
1. บันทึก skill จากการ์ดที่ Claude เสนอในแชท หรือนำ `SKILL.md` ไปเพิ่มเป็น skill เอง
2. ในแชทใหม่ แนบไฟล์ `motion-studio-kit.zip` แล้วพิมพ์ เช่น "สร้างคลิป BEEP ไปออสเตรเลีย"
3. Claude จะส่ง Brief มาก่อน อ่านแล้วตอบว่า "ผ่าน สร้างได้เลย 16:9 ยาว 90 วิ" (หรือ 9:16 / ทั้งสองแบบ)
4. ได้ไฟล์ MP4 กลับมา

**ทางลัด:** อัปโหลดโฟลเดอร์นี้ขึ้น GitHub repo ส่วนตัว แล้วบอก Claude ให้ clone ทุกครั้ง จะได้ไม่ต้องแนบ zip

## รันเองบนเครื่อง (Claude Code)
ต้องมี Node 18+, Python 3, ffmpeg
```bash
cd pilot && cp -r ../kit kit   # หรือใช้ kit เดิม
bash kit/setup.sh
python3 kit/voice.py && node kit/audio.cjs
node kit/render.mjs video 1920 1080 0 17 && node kit/render.mjs final 1920 1080 test.mp4
```
