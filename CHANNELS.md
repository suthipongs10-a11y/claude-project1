# CHANNELS — ทะเบียนช่องทั้งหมด (เครือช่องภาษาไทย)

pipeline เดียวกันทุกช่อง (`tools/` + `bones-and-firelight-pipeline.SKILL.md`)
ต่างกันแค่ **DNA ภาพ** ในไฟล์ `CHANNEL-STYLE.md` ของแต่ละช่อง

| handle | ช่อง | สไตล์ภาพ | style file | โปรเจกต์ |
|---|---|---|---|---|
| `universe` | ถอดรหัสจักรวาล | Sticky Line doodle (มาสคอตดำ CHARLOCK) | `CHANNEL-STYLE.md` (root) | `projects/` |
| `agri` | เรื่องเกษตรที่คนไทยควรรู้ | Warm Flat Farm (มาสคอตชาวนา) | `channels/agri/CHANNEL-STYLE.md` | `channels/agri/projects/` |
| `health` | สุขภาพแบบเข้าใจง่าย | Clean Care มิ้นต์ (มาสคอตหมอ) | `channels/health/CHANNEL-STYLE.md` | `channels/health/projects/` |

## เวลาสั่งงาน
บอก **handle ช่องนำหน้า** แล้วตามด้วยโจทย์ เช่น:
- *"agri: ทำคลิปเรื่องปุ๋ยหมักใช้เอง ยาว 5 นาที 50 รูป"*
- *"health: ทำคลิปเรื่องน้ำตาลในเลือด ยาว 6 นาที 55 รูป"*
- *"universe: EP.02 เรื่องดาวนิวตรอน ยาว 5 นาที 53 รูป"*

ผมจะหยิบ `CHANNEL-STYLE.md` ของช่องนั้นมาใช้ (มาสคอต+สี+STYLE BLOCK) อัตโนมัติ
สิ่งที่คุณระบุต่อคลิป = **หัวข้อ + ความยาว + จำนวนรูป** (ที่เหลือผมจัดการตาม DNA ช่อง)

## ที่ใช้ร่วมทุกช่อง
- `tools/` — สคริปต์ pipeline (gen เสียง/ภาพ, แตกช็อต, HyperFrames)
- `assets/fonts/` — Kanit (ป้าย/punch), Sarabun
- คีย์ API เดียวกัน (ElevenLabs + DashScope/Wan)
