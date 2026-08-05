# Web Lead Craft — สายการผลิตเว็บไซต์ลูกค้า

โฟลเดอร์นี้คือธุรกิจรับทำเว็บไซต์ (แพ็กเกจ 990 / 1,990 / 4,990 บาท ตามใบปลิว)
แยกขาดจากโปรเจกต์อื่นใน repo — เว็บลูกค้าทุกตัวสร้าง build และเก็บที่นี่

## โครงสร้าง

```
tools/
  fetch-fonts.mjs     ดึง Google Fonts มาฝังเป็น data URI (ใช้ซ้ำได้ทุกเว็บ)
  build-site.mjs      ประกอบ src/ ของแต่ละเว็บเป็น index.html + preview.html
sites/
  demo-cleaning/      เว็บเดโม่แพ็กเกจ 990.- (ธุรกิจทำความสะอาดบ้าน/คอนโด)
    index.html        ← ไฟล์ส่งมอบ / deploy (self-contained ไฟล์เดียวจบ)
    preview.html      ← เวอร์ชันสำหรับพรีวิวเป็น artifact บน claude.ai
    src/              head.html · styles.css · body.html · fonts.css (generated)
```

## ทำเว็บใหม่ 1 ตัว

```bash
cp -r sites/demo-cleaning sites/<ชื่องานใหม่>        # เริ่มจากโครงเดิม
# แก้ src/head.html + src/styles.css + src/body.html ตามธุรกิจลูกค้า
node tools/fetch-fonts.mjs "<css2-url>" sites/<ชื่องาน>/src/fonts.css   # ถ้าเปลี่ยนฟอนต์
node tools/build-site.mjs sites/<ชื่องาน>
```

หลักการ: เว็บแพ็กเกจ 990 เป็น **static ไฟล์เดียว** — ฟอนต์ฝังใน, ไอคอนเป็น SVG sprite,
ไม่มี external request เลย → PageSpeed ดี, ใช้ได้ทั้ง deploy จริงและพรีวิว artifact
(CSP ของ artifact บล็อกทุก CDN ภายนอก)

## Deploy: Cloudflare Pages (ฟรี)

ทางที่ง่ายสุดต่อเว็บลูกค้า 1 ตัว: Cloudflare Dashboard → Workers & Pages →
Create → Pages → **Direct Upload** → ลากโฟลเดอร์ที่มี `index.html` ขึ้นไป
แล้วผูก custom domain ของลูกค้าในแท็บ Custom domains

ลิมิตของ free plan (เช็กล่าสุด ส.ค. 2026):

| เรื่อง | ลิมิตฟรี |
|---|---|
| จำนวนโปรเจกต์ (= จำนวนเว็บ) ต่อบัญชี | **100** (soft limit — ขอเพิ่มได้ผ่านฟอร์ม) |
| Bandwidth / จำนวน request ของไฟล์ static | ไม่จำกัด |
| Build ผ่าน git integration | 500 ครั้ง/เดือน (Direct Upload ไม่นับ) |
| Custom domain ต่อโปรเจกต์ | 100 |
| ไฟล์ต่อ deployment | 20,000 ไฟล์ · ไฟล์ละไม่เกิน 25 MB |

ที่มา: developers.cloudflare.com/pages/platform/limits/

## กติกาที่ต้องจำ

- **ห้ามใช้ WordPress** — ตัดสินใจแล้ว (2026-08-05) ทุกเว็บเป็น static
- **ห้ามเอาเว็บลูกค้าไปวางบน VPS เกม RO** — กล่องนั้นเสี่ยง DDoS โดยธรรมชาติของมัน
- "LINE แจ้งเตือน" ของแพ็กเกจ Business ต้องใช้ **LINE Messaging API + LINE OA**
  (LINE Notify ปิดบริการไปแล้วเมื่อ มี.ค. 2025)
- เว็บเดโม่ทุกตัวต้องมี disclaimer "ข้อมูลสมมติ" ที่ footer และแถบเครดิต
  Web Lead Craft (LINE: kitty4uu) — เดโม่คือใบปลิวชิ้นที่สอง
- โดเมนลูกค้า: เก็บแยกจากค่าทำเว็บ หรือรวมปีแรกแล้วเก็บค่าต่ออายุรายปี
