# 05 — จัดการข้อความภาษาไทยก่อนเข้า TTS (Text Front-end)

จุดที่ทำให้ TTS ไทย "อ่านผิด" มากที่สุดไม่ใช่ตัวโมเดล แต่คือ**ข้อความดิบที่ไม่ได้ normalize** — ตัวเลข วันที่ ตัวย่อ คำอังกฤษปนไทย ไม่มีเว้นวรรคบอกจังหวะ

## เครื่องมือหลัก

| เครื่องมือ | ใช้ทำอะไร | ติดตั้ง |
|---|---|---|
| [PyThaiNLP](https://github.com/PyThaiNLP/pythainlp) ⭐ | มีดพกสวิสของ NLP ไทย: ตัดคำ, แปลงเลข→คำอ่าน, normalize, ทับศัพท์ | `pip install pythainlp` |
| [tltk](https://pypi.org/project/tltk/) | G2P ไทย → สัทอักษร/IPA (ใช้กับโมเดลสาย phoneme เช่น F5-TTS-TH-V2) | `pip install tltk` |
| [ssg](https://github.com/ponrawee/ssg) | ตัดพยางค์ไทย (syllable segmentation) | `pip install ssg` |
| [khanaa](https://github.com/cakimpei/khanaa) | สะกด/ประสมคำไทยจากหน่วยเสียง | `pip install khanaa` |

## สูตร normalize ที่ใช้บ่อย (PyThaiNLP)

```python
from pythainlp.util import num_to_thaiword, bahttext, normalize, thai_strftime
from pythainlp.tokenize import word_tokenize
from pythainlp.transliterate import romanize

num_to_thaiword(2569)        # 'สองพันห้าร้อยหกสิบเก้า'
bahttext(1234.50)            # 'หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์'
normalize("เเปลก")           # แก้ เ+เ → แ, สระ/วรรณยุกต์เพี้ยน
word_tokenize("ตากลม")       # ['ตา','กลม'] — ใช้ช่วยแทรกจังหวะหยุด/แก้กำกวม
```

เช็กลิสต์ก่อนส่งข้อความเข้า TTS:

1. เลข/จำนวนเงิน/เวลา → คำอ่านไทย (`num_to_thaiword`, `bahttext`, เขียนฟังก์ชันอ่าน "13:45 น." → "สิบสามนาฬิกาสี่สิบห้านาที")
2. ตัวย่อ → คำเต็ม ("กทม." → "กรุงเทพมหานคร", "ผบ.ตร." ฯลฯ — ทำ dict ของตัวเอง)
3. คำอังกฤษปนไทย → ขึ้นกับโมเดล:
   - F5-TTS-THAI **V1**: เขียนทับศัพท์ ("Good Morning" → "กู้ดมอร์นิ่ง")
   - F5-TTS-TH-**V2** (IPA) / OmniVoice / ThonburianTTS: ใส่อังกฤษตรง ๆ ได้ (ทดสอบเทียบเสมอ)
4. เว้นวรรค = จังหวะหายใจ — ใส่เว้นวรรคตามวรรคตอนความหมาย ช่วยให้เสียงไม่รวบ
5. อิโมจิ/สัญลักษณ์/มาร์กดาวน์ → ลบหรือแปลงเป็นคำ
6. ไม้ยมก "ๆ" → บางโมเดลอ่านได้ บางตัวต้อง expand ("เร็วๆ" → "เร็วเร็ว")

## G2P / Phoneme (สำหรับสาย IPA)

- `tltk.nlp.th2ipa()` / `th2roman()` — แปลงไทยเป็น IPA/โรมัน
- PyThaiNLP `transliterate(engine="thaig2p")` — G2P ดีปเลิร์นนิงของ PyThaiNLP
- โมเดล V2 ของ F5-TTS-THAI และตัว IPA ของ ThonburianTTS ใช้แนวนี้เพื่อลดการอ่านผิด

## ภาษาอังกฤษ (เผื่อทำสองภาษา)

- ตัวเลข/วันที่: [num2words](https://pypi.org/project/num2words/)
- G2P: [g2p-en](https://pypi.org/project/g2p-en/), [phonemizer](https://github.com/bootphon/phonemizer) (espeak-ng backend — Kokoro/StyleTTS2 ใช้)
- Normalize มาตรฐาน: [NeMo text processing](https://github.com/NVIDIA/NeMo-text-processing) (WFST)

## เคล็ดไม่ลับ

- ทำไฟล์ `normalize_th.py` กลางไว้ใน pipeline — ทุกโมเดลได้ประโยชน์ร่วมกัน ไม่ว่าจะสลับ TTS ตัวไหน
- เก็บ "ประโยคทดสอบมาตรฐาน" ~20 ประโยค (เลข, ชื่อเฉพาะ, อังกฤษปน, ไม้ยมก, ประโยคยาว) ไว้รีเกรสชันทุกครั้งที่เปลี่ยนโมเดล/เวอร์ชัน
