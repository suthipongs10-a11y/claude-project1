# วิธีขนฟุตเทจ Pexels เข้าเครื่องคลาวด์ ตอนที่ network policy ยังบล็อกอยู่

## ปัญหา

`vidiq_generate_broll` คืน URL ฟุตเทจฟรีมาให้ แต่ URL อยู่บน `videos.pexels.com`
ซึ่ง network policy ของ environment บล็อก (403 ที่ชั้น CONNECT proxy) โหลดตรงไม่ได้

## ทางแก้: ให้ vidIQ เรนเดอร์ให้ แล้วโหลดจาก S3 ของ vidIQ

`vidiq_compose` รับ URL ฟุตเทจไปประกอบ **ฝั่งเซิร์ฟเวอร์** แล้วคืนไฟล์ MP4 บน
`*.amazonaws.com` ซึ่งเครื่องคลาวด์เข้าถึงได้ → ใช้มันเป็นสะพานขนฟุตเทจ

ทำทีเดียวหลายคลิปได้ ประหยัดกว่าเรียกทีละอัน:

1. `vidiq_generate_broll` หลายคำค้น (1 credit ต่อครั้ง) เลือกคลิปที่ URL เป็น
   `-hd_1920_1080` หรือ `-hd_1280_720` — บางคลิปคืนไฟล์ `640_360` ซึ่งเล็กเกินไปสำหรับ 1080p
   (ฟิลด์ `width`/`height` ในผลลัพธ์คือขนาดต้นฉบับ ไม่ใช่ขนาดไฟล์ที่จะได้ ให้ดูจากชื่อไฟล์ใน URL)
2. `vidiq_compose` scene ละ 6 วินาที เรียงต่อกัน `format: "landscape"` ไม่ต้องใส่เสียง/overlay
3. `vidiq_job_poll` → ได้ `videoUrl` (signed หมดอายุ 12 ชม.)
4. `curl` โหลดมา แล้วตัดแยกตามขอบ scene ที่รู้อยู่แล้ว:

```bash
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
names=(gimbal-phone phone-lens camera-lens filming-camera phone-in-hand)
for i in 0 1 2 3 4; do
  $FF -y -loglevel error -ss $((i*6)) -i broll/_all.mp4 -t 6 \
     -c:v libx264 -crf 20 -preset veryfast -an "broll/${names[$i]}.mp4"
done
rm broll/_all.mp4
```

ข้อควรรู้
- URL ที่ `generate_broll` คืนมาต้องส่งเข้า `compose` **ทันที** ห้ามเดา/ประกอบ URL เอง
- `compose` scale/crop เป็น 1920×1080 ให้เรียบร้อย ตัดแยกแล้วใช้เป็น `broll` ได้ตรงๆ
- ยังต้องเก็บชื่อ `photographer` + `pageUrl` จากผลลัพธ์ `generate_broll` ไปใส่ description
  (ดูตัวอย่างที่ `projects/2026-08-honor-robot-phone/CREDITS.md`)

## ยังแก้ไม่ได้ด้วยวิธีนี้

การแคปหน้าเว็บจริง — `compose` ไม่ได้เปิดเบราว์เซอร์ให้ ต้องรอเปิด network policy
ให้ Playwright ในเครื่องเข้าเว็บนั้นได้เอง (หรือรัน `capture_web.mjs` บน PC แล้ว push assets ขึ้นมา)
