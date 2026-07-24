# CHANNEL-STYLE — เรื่องเกษตรที่คนไทยควรรู้ (handle: agri)

> DNA ภาพของช่อง ใช้คู่กับ pipeline `bones-and-firelight-pipeline.SKILL.md` + `tools/`
> ต่างจากช่องอื่นที่ **สไตล์ภาพ + มาสคอต + สี** ส่วนขั้นตอนทำเหมือนกันหมด

## 0. Fixed facts
- **ช่อง:** เรื่องเกษตรที่คนไทยควรรู้ — explainer เกษตร ภาษาไทย โทนอบอุ่น จริงใจ น่าเชื่อถือ ใช้ได้จริง
- **สไตล์ = "Warm Flat Farm":** flat vector illustration สะอาด รูปทรงมน เส้นหนาชัด ลงสีแบนโทนดินอบอุ่น
- **เสียง = ElevenLabs** (เลือก voice ตอนทำคลิปแรก — แนะนำเสียงชายไทยอบอุ่น เป็นกันเอง)
- **ภาพ = Wan (`wan2.7-image`)** ผ่าน `tools` (ส่ง `--style-file channels/agri/CHANNEL-STYLE.md`)
- **ฟอนต์ป้าย = Kanit** · **LABELS:** พืช/โรค/ปุ๋ย/เครื่องมือ/สัตว์ ที่สำคัญต้องมีป้ายชื่อไทยกำกับ

## 1. Palette
| บทบาท | สี | HEX |
|---|---|---|
| เส้น (น้ำตาลเข้มนุ่ม ไม่ดำสนิท) | warm ink | `#2A2620` |
| พื้นหลัง (ครีมอุ่น) | warm cream | `#FBF6EC` |
| เขียวใบไม้ (หลัก) | leaf green | `#4CA64C` |
| เขียวเข้ม | deep green | `#2E7D32` |
| น้ำตาลดิน | soil brown | `#8B5E3C` |
| ฟ้าท้องฟ้า | sky blue | `#7EC8E3` |
| เหลืองแดด/ข้าว | sun yellow | `#FFC93C` |
| แดงมะเขือเทศ (accent เตือน/เด่น) | tomato | `#E8613C` |

**กติกา:** โทนอบอุ่นจากดิน+พืช เป็นหลัก / 1 ภาพเน้น accent 2-3 สี / อ่านง่าย สบายตา

## 2. MASCOT (ใส่ verbatim ทุกช็อตที่มีมาสคอต — ห้ามใช้ชื่อเฉพาะใน prompt กันโมเดลเขียนตัวอักษร)

> The mascot is a cheerful young Thai farmer with a round friendly face, warm tan
> skin, small dark dot eyes and a big warm smile, wearing a traditional woven
> cone-shaped Thai farmer hat (ngob), a simple leaf-green short-sleeve shirt and
> rolled-up khaki pants, with small rounded hands. Clean flat-vector style with
> bold uniform outlines and simple flat color fills, friendly and wholesome.
> Keep the round face, the woven cone hat, and the green shirt identical in every shot.

- **บทบาท:** "เพื่อนเกษตรกร" — ชี้ชวน อธิบาย ยกตัวอย่าง ลงมือทำให้ดู
- แสดงอารมณ์ผ่านสีหน้า/ท่าทาง ไม่เปลี่ยนโครงหน้า/หมวก

## 3. STYLE BLOCK (ใส่ verbatim ทุกช็อต)

> STYLE: clean modern flat vector illustration, bold uniform outlines, simple flat
> color fills with minimal soft shading, rounded friendly shapes, warm earthy
> farm palette (leaf green, soil brown, sky blue, sun yellow). ALWAYS set a simple
> relevant BACKGROUND SCENE (rice field, farm plot, vegetable garden, barn,
> village kitchen) — never a plain empty background. Draw complete scenes with
> some generous open sky/ground areas kept low-detail. Wholesome friendly
> Thai-countryside vibe, clear and easy to read. NOT photorealistic, no gradient
> mesh, no realistic texture. Do NOT draw blank signboards, empty labels or empty
> reserved text boxes; a few short real words on a sack/crate are fine, but avoid
> long text or garbled letters. 16:9.

## 4. Captions / Labels / Punch
- **ฟอนต์ = Itim** (`assets/fonts/Itim-Regular.ttf`) — ลายมืออบอุ่น เป็นกันเอง เอกลักษณ์ช่อง
  (ไม่ใช่ฟอนต์มาตรฐานแบบช่องอวกาศ) · ทำหนา/เด้งด้วยขอบหนา
- caption ไฮไลต์เหลือง `#FFC93C`/เขียว · ~35–45% ของช็อต
- **LABELS:** ชื่อพืช/โรค/ปุ๋ย/แมลง/เครื่องมือ ใส่ป้ายชื่อไทยกำกับ (คำ/ป้ายเติมทีหลังแบบเคลื่อนไหว
  วางในที่ว่างจริงของภาพ — **ไม่ gen กรอบเปล่าไว้ในภาพ** เพราะตำแหน่งมักไม่ตรง)
- punch word: คำเด็ดเตือน/เน้น (เช่น "ห้ามใส่!", "เพิ่ม 2 เท่า", "ระวังโรค")
