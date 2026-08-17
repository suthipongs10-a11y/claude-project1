# Phase 1–2 — Honor Robot Phone

## ทำไมเลือกหัวข้อนี้

| เกณฑ์ | สถานะ |
|---|---|
| เพิ่งเกิดข่าว | pre-order 12 ส.ค. 2026, ขายจริงในจีน 18 ส.ค. 2026 — คลิปลงทันช่วงคนค้นหา |
| เถียงกันได้ | ราคาแพงกว่าเรือธงทั่วไปเกือบเท่าตัว แต่ได้ของที่ไม่มีใครมี (กิมบอลจริงในตัว) |
| มีภาพให้ใช้ | หน้าเว็บ Honor มีหน้าสเปก/ราคา + ภาพกล้องขยับ |
| คนยังไม่ได้ลองจริง | รีวิวเชิง "อ่านสเปกแล้ววิเคราะห์" ทำได้เลย ไม่ต้องมีเครื่อง |

## ข้อมูลที่ยืนยันได้ (จากสื่อ ณ 17 ส.ค. 2026)

| หัวข้อ | ค่า |
|---|---|
| ราคา | 9,999 หยวน (~$1,480) รุ่น 12GB/512GB · 12,999 หยวน (~$1,930) รุ่น 16GB/1TB |
| กำหนดขาย | pre-order 12 ส.ค. · ขายจริงในจีน 18 ส.ค. 2026 |
| กล้องหลัก | 200MP บนกิมบอล 3 แกน มอเตอร์ขยับได้ |
| กล้องอื่น | 200MP periscope tele ซูมออปติคอล 2.7x · 50MP ultrawide |
| กิมบอล | Honor เคลมว่าเล็กที่สุดในโลก หนัก 2.6 กรัม บาง 6 มม. |
| จอ | 6.3" LTPO OLED 120Hz ความสว่างพีค 6,800 nits |
| ชิป | Snapdragon 8 Elite Gen 5 |
| แบต | 7,060mAh · ชาร์จสาย 120W · ไร้สาย 50W |
| พาร์ตเนอร์ | ARRI (ผู้ผลิตกล้องภาพยนตร์) — ฟีเจอร์สี/การบันทึกระดับโปร |

**ยังไม่ยืนยัน / ต้องระวังในสคริปต์**
- ยังไม่มีใครรีวิวการใช้จริง — ตัวเลขทั้งหมดคือที่ผู้ผลิตเคลม ต้องพูดว่า "Honor บอกว่า"
- ยังไม่มีข้อมูลว่าจะขายนอกจีนไหม / ราคาไทยเท่าไหร่ — ห้ามเดาราคาไทยเป็นตัวเลขแน่นอน
- ความทนทานของกลไกกิมบอล (ชิ้นส่วนขยับ = จุดเสียในระยะยาว) ยังไม่มีข้อมูล

## แหล่งอ้างอิง

- https://www.techrepublic.com/article/news-honor-robot-phone-launch-price-specs/
- https://newatlas.com/mobile-technology/honor-robot-gimbal-phone-arri/
- https://finance.biggo.com/news/202608151351_Honor_Robot_Phone_launches_with_built-in_gimbal
- https://gsmarena.com/honor_robot_phone_showcased_ahead_of_mwc_-news-70356.php
- https://memeburn.com/honor-robot-phone-launch-specs-price/

## หน้าเว็บที่ต้องแคป (Phase 3)

รอเปิด network policy ให้เข้า honor.com / hihonor.com ก่อน แล้วรัน:

```bash
node pipeline/capture_web.mjs --url https://www.honor.com/<หน้าสินค้า> \
  --out capture/honor-robot --views 5 --video \
  --sel "spec=<selector ตารางสเปก>,price=<selector ราคา>"
```

ช็อตที่อยากได้: หน้าแรกสินค้า (ภาพกล้องขยับ), ตารางสเปกกล้อง, หน้าราคา/รุ่นย่อย,
ส่วนที่พูดถึง ARRI
