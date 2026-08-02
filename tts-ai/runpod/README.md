# 🚀 เซิร์ฟเวอร์เสียงประจำช่องบน RunPod — คู่มือทีละขั้น

เปลี่ยนเครดิต RunPod ให้เป็น "เครื่องเสียง TTS ส่วนตัว" ที่**ทุกแชท Claude / ทุกเครื่อง**เรียกใช้ได้ผ่าน URL เดียว

## แนวคิด

- เปิด **Pod GPU เฉพาะตอนจะเจนเสียง** → ใช้เสร็จ **Stop** → เงินหยุดไหล (จ่ายเฉพาะชั่วโมงที่เปิด)
- เซิร์ฟเวอร์โหลดโปรไฟล์เสียง + เสียงอ้างอิง + ตัวแปลงตัวเลข **จาก repo นี้อัตโนมัติ** — อัปเดตเสียง/สคริปต์ที่ repo ที่เดียว ทุกที่ได้ผลเหมือนกัน
- ค่าใช้จ่ายโดยประมาณ: RTX 4090 ~$0.35–0.70/ชม. → เจนเสียงคลิป Shorts 1 คลิป (รวมเปิดเครื่อง+โหลดโมเดล) ตกครั้งละ **ไม่กี่บาท**

## ขั้นตอนตั้งค่า (ครั้งแรก ~15 นาที)

### 1. สร้าง Pod
1. เข้า [runpod.io](https://www.runpod.io/) → Console → **Pods** → **Deploy**
2. เลือก GPU: **RTX 4090** (แรงคุ้ม) หรือ RTX 3090 / RTX A5000 (ถูกกว่า — งานนี้ใช้ VRAM แค่ ~6GB อะไรก็พอ)
3. Template: **RunPod PyTorch** (ตัวทางการเวอร์ชันล่าสุด)
4. ช่อง **Expose HTTP Ports** ใส่: `8000`
5. (แนะนำถ้าจะใช้บ่อย) เพิ่ม **Network Volume** ~20GB — เก็บโมเดลไว้ ไม่ต้องโหลด 4GB ใหม่ทุกครั้งที่เปิด pod (~$0.07/GB/เดือน)
6. กด **Deploy** รอสถานะ Running

### 2. ติดตั้ง + เปิดเซิร์ฟเวอร์
เปิดสวิตช์ **Enable web terminal** → กด **Connect to web terminal** แล้ววาง (แก้ `ตั้งรหัสลับเอง` เป็นรหัสของคุณ):

```bash
cd /workspace \
  && git clone -b claude/tts-ai-tools-resources-m5rku5 https://github.com/suthipongs10-a11y/claude-project1.git \
  && export TTS_API_KEY=ตั้งรหัสลับเอง \
  && nohup bash claude-project1/tts-ai/runpod/setup_runpod.sh > /workspace/tts.log 2>&1 & \
  sleep 2 && tail -f /workspace/tts.log
```

รอจนขึ้น **`✅ พร้อมรับงาน`** (ครั้งแรก ~5 นาที: ติดตั้ง + โหลดโมเดล) แล้วกด `Ctrl+C` ออกจาก tail ได้ — เซิร์ฟเวอร์รันต่อเบื้องหลัง ปิดแท็บได้ ไม่ดับ (ดู log ทีหลัง: `tail -f /workspace/tts.log`)

### 3. หา URL ของเซิร์ฟเวอร์
ในหน้า pod ดู **Pod ID** (เช่น `abc123xyz`) → URL คือ:

```
https://abc123xyz-8000.proxy.runpod.net
```

(หรือกด Connect → HTTP Service [Port 8000] ได้ลิงก์เดียวกัน)

### 4. ทดสอบจากเครื่องไหนก็ได้

```bash
curl -H "x-api-key: รหัสลับ" https://abc123xyz-8000.proxy.runpod.net/health
```

ได้ `{"ok": true, ...}` = ใช้งานได้แล้ว 🎉

## การใช้งานประจำวัน

| ใคร | ทำยังไง |
|---|---|
| **Claude แชทอื่น/โปรเจกต์อื่น** | บอกแชทนั้นว่า: *"อ่าน tts-ai/runpod/README.md ใน repo claude-project1 — เซิร์ฟเวอร์เสียงอยู่ที่ `https://...proxy.runpod.net` key คือ `...` ใช้ client.py หรือ curl สั่งเสียงได้เลย"* |
| **PC (ทำ CapCut)** | `python tts-ai/runpod/client.py --server https://... --key ... --job tts-ai/voice-jobs/งาน.json --outdir projects/xxx/voice` → ได้ wav + timing.json |
| **curl เร็ว ๆ** | `curl -X POST -H "x-api-key: KEY" -H "Content-Type: application/json" -d '{"text":"สวัสดีครับ"}' https://.../tts -o out.wav` |
| **Claude Code cloud เรียกเองในแชท** | เพิ่ม `proxy.runpod.net` ใน network policy ของ environment (claude.ai → Code → environment settings) → จากนั้น Claude เจนเสียง+commit ได้เองจบในแชท |

## เลิกใช้ = กด Stop

- หน้า pod → **Stop** — หยุดคิดเงิน GPU ทันที (เหลือค่า volume จิ๊บ ๆ ถ้ามี)
- เปิดใหม่ครั้งหน้า: Start pod → Web Terminal → 
  `cd /workspace && export TTS_API_KEY=รหัสเดิม && bash claude-project1/tts-ai/runpod/setup_runpod.sh`
  (มี volume = โมเดลอยู่ครบ ขึ้น ✅ ใน~1-2 นาที / **Pod ID เปลี่ยน = URL เปลี่ยน** — แจ้ง URL ใหม่ให้แชทที่ใช้งานด้วย)
- อัปเดตเสียง/โค้ดเวอร์ชันใหม่: `cd /workspace/claude-project1 && git pull` แล้วรัน setup ใหม่

## ความปลอดภัย

- URL เป็นสาธารณะ — **ต้องตั้ง `TTS_API_KEY` เสมอ** และอย่า commit รหัสลง repo (ส่งให้แชทอื่นทางข้อความแทน)
- เสียงโคลนเป็นเสียงส่วนตัวของเจ้าของช่อง — อย่าแชร์ URL+key ให้คนนอก
