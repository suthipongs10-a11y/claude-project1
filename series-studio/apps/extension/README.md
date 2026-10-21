# Series Studio Flow Driver (Chrome Extension, MV3)

ขับ Google Flow แทนผู้ใช้ตาม SPEC §10 — รับงานจาก studio-server บนเครื่องเดียวกัน (127.0.0.1) ทำทีละงาน หน่วงเวลาแบบสุ่ม และหยุดทันทีเมื่อเจอหน้าที่ไม่รู้จัก

## ติดตั้ง (dev)
1. เปิด `chrome://extensions` → เปิด Developer mode → **Load unpacked** → เลือกโฟลเดอร์ `apps/extension`
2. รัน studio-server (`pnpm dev:server` หรือผ่าน Claude Desktop) แล้วขอลิงก์จาก Claude ด้วย `dashboard_info` → คัดลอก token
3. คลิกไอคอน extension → ใส่ port (ปกติ 8787) และ token → “จับคู่และเชื่อมต่อ”
4. ตั้ง engine ของซีรีส์เป็น `flow_ext` (`create_series` ใส่ `engine_id: "flow_ext"` หรือแก้ `series.json`) แล้วสั่ง `generate` ตามปกติ — งานจะเข้าคิวให้ extension ทำ

## การทำงาน
- server ส่ง job ผ่าน WebSocket (`role=extension`) → sw.js หา/เปิดแท็บ Flow → inject `driver.js` + `content.js` → ขับ UI ตาม `config/flow-selectors.json` (โหลดจาก server ทุกครั้ง แก้ได้ไม่ต้อง build) → ดึงคลิป → POST กลับที่ `/api/ext/jobs/<id>/result`
- Characters: tool `sync_flow_characters` สร้างงานชนิด `character` → extension สร้าง Character ใน Flow จาก ref ที่ล็อกแล้ว → ส่ง `flow_character_id` กลับมาเก็บใน bible
- หยุดปลอดภัย: ไม่พบ selector/ไม่ใช่หน้า Flow → รายงาน `blocked` คิวทั้งหมดหยุด จนกว่าจะ `extension_status resume=true` (หรือ POST `/api/ext/resume`)
- ไม่เก็บรหัสผ่าน/คุกกี้ Google — ใช้ session ที่ล็อกอินอยู่ใน Chrome

## selectors
`config/flow-selectors.json` รองรับ CSS selector ปกติ + `:has-text('ข้อความ')` (จับจาก textContent, ไม่สนตัวพิมพ์) หลายตัวคั่นด้วย `,` ลองตามลำดับ · key ที่เว้นว่างได้: `settings_button`, `aspect_*`, `quality_*`, `add_ingredient_button`, `error_banner`

## ข้อควรระวัง
การกดอัตโนมัติอาจขัดข้อตกลงการใช้งานของ Flow — ผู้ใช้รับผิดชอบบัญชีตัวเอง ใช้โหมด manual ได้เสมอ (SPEC §14)
