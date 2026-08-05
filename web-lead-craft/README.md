# Web Lead Craft — สายการผลิตเว็บไซต์ลูกค้า

โฟลเดอร์นี้คือธุรกิจรับทำเว็บไซต์ (แพ็กเกจ 990 / 1,990 / 4,990 บาท ตามใบปลิว)
แยกขาดจากโปรเจกต์อื่นใน repo — เว็บลูกค้าทุกตัวสร้าง build และเก็บที่นี่

## ติดตั้งครั้งเดียว

```bash
cd web-lead-craft && npm install
```

## โครงสร้าง

```
tools/
  fetch-fonts.mjs   ดึง Google Fonts มาฝังเป็น data URI (ใช้ซ้ำได้ทุกเว็บ)
  build-site.mjs    ประกอบ src/ → dist/ (ของที่ deploy) + preview.html
  qa-site.mjs       ตรวจงานด้วยเบราว์เซอร์จริงก่อนส่งลูกค้า
sites/
  demo-cleaning/    เว็บเดโม่แพ็กเกจ 990.- (ธุรกิจทำความสะอาดบ้าน/คอนโด)
    site.json       ← โดเมนลูกค้า + ชื่อแบรนด์ (ใช้สร้าง sitemap/canonical)
    src/            head.html · styles.css · body.html · favicon.svg
                    fonts.css (generated — อย่าแก้มือ)
      img/          รูปต้นฉบับ .webp ความละเอียดเต็ม (commit ลง git)
    dist/           ← ของที่ deploy (gitignored, สั่ง build ใหม่ได้เสมอ)
    preview.html    ← พรีวิวเป็น artifact บน claude.ai (ห้าม deploy)
    .qa/            สกรีนช็อตจาก qa-site (gitignored)
```

`dist/` ที่ build ออกมาจะมี: `index.html` · `404.html` · `favicon.svg` ·
`robots.txt` · `_headers` (security headers) · `sitemap.xml` (ถ้า site.json มีโดเมนจริง)

## ทำเว็บใหม่ 1 ตัว

```bash
cp -r sites/demo-cleaning sites/<ชื่องานใหม่>
rm -rf sites/<ชื่องานใหม่>/dist sites/<ชื่องานใหม่>/.qa
# แก้ site.json (โดเมน+ชื่อแบรนด์) แล้วแก้ src/ ตามธุรกิจลูกค้า
node tools/fetch-fonts.mjs "<css2-url>" sites/<ชื่องาน>/src/fonts.css   # ถ้าเปลี่ยนฟอนต์
node tools/build-site.mjs sites/<ชื่องาน>
node tools/qa-site.mjs   sites/<ชื่องาน>     # ต้องขึ้น PASS ก่อนส่งงาน
```

หลักการ: HTML เป็นไฟล์เดียวจบ — ฟอนต์ฝังใน, ไอคอนเป็น SVG sprite, ไม่ยิงออกไปหา CDN
ภายนอกเลย → PageSpeed ดี และใช้เป็นพรีวิว artifact ได้ (CSP ของ artifact บล็อก CDN ทุกตัว)

## รูปภาพ

รูปเป็นข้อยกเว้นเดียวที่ไม่ฝังใน HTML — เพราะ data URI ทำ lazy-load ไม่ได้
แคชแยกไม่ได้ และส่งขนาดตามจอไม่ได้ ระบบจึงเป็นแบบนี้:

```bash
# 1. แปลงรูปต้นฉบับ (PNG/JPG จากมือถือหรือ AI) เป็น master WebP
node -e 'import("sharp").then(({default:s})=>s("ต้นฉบับ.png").webp({quality:88})
  .toFile("sites/<ชื่องาน>/src/img/<ชื่อรูป>.webp"))'

# 2. อ้างถึงใน body.html ด้วย placeholder — build จะสร้าง srcset ให้เอง
#    <img {{img:<ชื่อรูป>:(max-width:600px) 88vw, 23vw}} width="1536" height="1024"
#         loading="lazy" alt="คำอธิบายภาษาไทย">
```

`build-site.mjs` จะย่อเป็น 480 / 800 / 1200px ลง `dist/img/` พร้อม `srcset`
(มือถือโหลด 480 จอคอมโหลด 1200) และตั้ง cache 1 ปีให้ใน `_headers`
ส่วน `preview.html` จะฝังรูปเป็น data URI แทน เพราะ artifact เป็นหน้าเดียวโดด ๆ

- **`alt` ต้องเขียนทุกรูป** เป็นภาษาไทยที่บอกว่าในรูปมีอะไร — qa-site จะ fail ถ้าขาด
- **`width`/`height` ต้องใส่เสมอ** กันหน้าเว็บกระโดดตอนรูปโหลด และ CSS ต้องมี
  `height: auto` คู่กันเสมอ ไม่งั้น attribute จะชนะ `aspect-ratio` (เคยพลาดมาแล้ว)
- ต้นฉบับความละเอียดเต็มอยู่ใน `src/img/` และ commit ลง git — ขนาดที่ย่อแล้วเป็น
  build output ไม่ต้อง commit

### qa-site ตรวจอะไรให้บ้าง

เปิดเว็บด้วย Chromium จริงผ่าน HTTP (ไม่ใช่ `file://` — path แบบ `/favicon.svg`
จะได้ทำงานเหมือนตอน deploy) ที่ความกว้างจอคอมและมือถือ แล้วรายงาน:
JS/network error · เว็บล้นขอบจอแนวนอน · section ที่แอนิเมชันค้างจนมองไม่เห็น ·
รูปที่ไม่มี alt · ลิงก์ `#` ที่ชี้ไปไม่มีอะไร · ปุ่มที่เล็กกว่า 44px (นิ้วกดพลาด) ·
ลิงก์ `tel:` หาย · ความยาว title/description · จำนวน `<h1>` · favicon · `lang` ·
หน้า 404 ใช้ได้จริงไหม — พร้อมเซฟสกรีนช็อตเต็มหน้าไว้ที่ `.qa/`

## Deploy: Cloudflare Pages (ฟรี)

**Framework preset เลือก `None`** — เว็บเราไม่มี build step บนฝั่ง Cloudflare
(ไม่ใช่ Astro / Next / Hugo) เพราะ `dist/` ถูก build เสร็จจากเครื่องเราแล้ว

### วิธีที่แนะนำ — Direct Upload

Cloudflare Dashboard → Workers & Pages → Create → Pages → **Upload assets** →
ตั้งชื่อโปรเจกต์ → ลากโฟลเดอร์ **`dist/`** ขึ้นไป → Deploy
จากนั้นผูกโดเมนลูกค้าที่แท็บ Custom domains

วิธีนี้ไม่ถามหา framework preset เลย และไม่กินโควตา build 500 ครั้ง/เดือน
ทำผ่าน CLI ก็ได้ (เร็วกว่าเวลาแก้งานบ่อย):

```bash
npx wrangler pages deploy sites/<ชื่องาน>/dist --project-name=<ชื่อโปรเจกต์>
```

### ถ้าจะต่อ Git ให้ deploy อัตโนมัติ

| ช่อง | ใส่ |
|---|---|
| Framework preset | **None** |
| Build command | `cd web-lead-craft && npm ci && node tools/build-site.mjs sites/<ชื่องาน>` |
| Build output directory | `web-lead-craft/sites/<ชื่องาน>/dist` |

ข้อเสีย: repo นี้มีเว็บลูกค้าหลายเจ้าปนกัน push ครั้งเดียว deploy หมด และถ้าจะ
ส่งมอบโปรเจกต์ให้ลูกค้าภายหลังต้องให้สิทธิ์ repo ด้วย — **งานลูกค้าใช้ Direct Upload
ดีกว่า** เก็บ Git integration ไว้ใช้กับเว็บของเราเอง

> ห้าม deploy โฟลเดอร์ `sites/<ชื่องาน>/` ทั้งอัน — `src/` กับ `preview.html`
> จะโดนเปิดสาธารณะไปด้วย **deploy เฉพาะ `dist/`**

### ลิมิต free plan

ตามเอกสารทางการของ Cloudflare — ก่อนวางแผนเกิน ~50 เว็บ เปิดลิงก์ท้ายตารางเช็กอีกรอบ

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
- ก่อนส่งงานทุกครั้ง `qa-site` ต้องขึ้น **PASS**
