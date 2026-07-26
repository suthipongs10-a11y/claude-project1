# CHANNEL-STYLE — สุขภาพแบบเข้าใจง่าย (handle: health)

> DNA ภาพของช่อง ใช้คู่กับ pipeline `bones-and-firelight-pipeline.SKILL.md` + `tools/`
> ต่างจากช่องอื่นที่ **สไตล์ภาพ + มาสคอต + สี** ส่วนขั้นตอนทำเหมือนกันหมด

## 0. Fixed facts
- **ช่อง:** สุขภาพแบบเข้าใจง่าย — explainer สุขภาพ ภาษาไทย โทนสะอาด อุ่นใจ น่าเชื่อถือ ไม่น่ากลัว
- **สไตล์ = "Clean Care":** flat illustration สะอาด รูปทรงมนนุ่ม โทนมิ้นต์-เขียวน้ำทะเล + คอรัล
- **เสียง = ElevenLabs** — ยังไม่ได้เลือก voice (เลือกตอนยิง API ได้: เรียก `/v1/voices`
  แล้วคัดเสียงนุ่ม อบอุ่น น่าไว้ใจ ไม่ห้วน มาเทียบ 3 ตัว) · ต่างจาก universe=Brian, agri=Bill
- **ภาพ = Wan (`wan2.7-image`)** ผ่าน `tools` (ส่ง `--style-file channels/health/CHANNEL-STYLE.md`)
- **ฟอนต์ป้าย = Mali** (ดูหัวข้อ 4) · **LABELS:** อวัยวะ/โรค/สารอาหาร/ยา ที่สำคัญต้องมีป้ายชื่อไทยกำกับ

## 1. Palette
| บทบาท | สี | HEX |
|---|---|---|
| เส้น (เขียวเข้มถ่าน ไม่ดำสนิท) | teal ink | `#1E3A38` |
| พื้นหลัง (ขาวมิ้นต์) | mint white | `#F4FBF9` |
| มิ้นต์/เขียวน้ำทะเล (หลัก) | mint teal | `#2BB6A3` |
| เขียวเข้ม | deep teal | `#17998A` |
| ฟ้าอ่อน | soft sky | `#6FC9E8` |
| คอรัล (accent เด่น/หัวใจ) | coral | `#FF6F61` |
| เหลืองอ่อน (accent เล็ก) | soft yellow | `#FFCB47` |
| เขียวดี / แดงเตือน | good/warn | `#3FBF6F` / `#FF5C5C` |

**กติกา:** มิ้นต์+ฟ้าเป็นพื้นอารมณ์สงบสะอาด / คอรัลเน้นจุดสำคัญ/หัวใจ / เว้นที่ว่างเยอะ ดูโปร่ง

## 2. MASCOT (ใส่ verbatim ทุกช็อตที่มีมาสคอต — ห้ามใช้ชื่อเฉพาะใน prompt)

> The mascot is a friendly approachable doctor character with a round soft face,
> warm gentle smile, small dark dot eyes, wearing a clean white coat over a
> mint-teal shirt, with a mint-teal stethoscope around the neck and small rounded
> hands. Clean flat-vector style with smooth rounded shapes, bold soft outlines and
> simple flat fills. Calm, caring and trustworthy, never scary or clinical.
> Keep the round face, white coat, and mint stethoscope identical in every shot.

- **บทบาท:** "บัดดี้สุขภาพ" — อธิบายง่าย ให้กำลังใจ ชวนดูแลตัวเอง
- แสดงอารมณ์ผ่านสีหน้า/ท่าทาง ไม่เปลี่ยนโครงหน้า/เสื้อกาวน์

## 3. STYLE BLOCK (ใส่ verbatim ทุกช็อต)

> STYLE: clean modern flat vector illustration, smooth rounded friendly shapes,
> soft bold outlines, simple flat fills with gentle soft shading, calm health
> palette (mint teal, soft sky blue, coral accents). ALWAYS give a simple soft
> BACKGROUND setting (clinic room, kitchen, home, park, or a soft mint scene with
> light context) — avoid a totally plain empty background, but keep it clean and
> uncluttered with open low-detail areas. Reassuring caring trustworthy mood, NOT
> scary or clinical. NOT photorealistic, no gradient mesh, no realistic texture.
> Do NOT draw blank charts, empty signboards or reserved text boxes; a few short
> real words on a bottle are fine, but avoid long text or garbled letters. 16:9.

## 4. Captions / Labels / Punch
- **ฟอนต์ = Mali** (`assets/fonts/Mali-Bold.ttf`) — นุ่มมน อ่อนโยน น่าไว้ใจ เอกลักษณ์ช่อง
  (ไม่ใช่ฟอนต์มาตรฐานแบบช่องอวกาศ)
- caption ไฮไลต์มิ้นต์/คอรัล · ~35–45% ของช็อต
- **LABELS:** ชื่ออวัยวะ/โรค/สารอาหาร/ค่าต่าง ๆ ใส่ป้ายชื่อไทยกำกับ (คำ/ป้ายเติมทีหลังแบบเคลื่อนไหว
  วางในที่ว่างจริงของภาพ — **ไม่ gen กรอบเปล่าไว้ในภาพ**)
- punch word: คำเด็ดย้ำ (เช่น "อันตราย!", "ลด 30%", "ทำได้ทุกวัน")
