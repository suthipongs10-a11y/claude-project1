# fonts/

ฟอนต์ที่แนบมากับ Series Studio เพื่อให้การ์ดและซับไตเติลเรนเดอร์ภาษาไทยได้เหมือนกันทุกเครื่อง (ffmpeg drawtext ใช้ `fontfile`, libass ใช้ `fontsdir`) โดยไม่ต้องพึ่ง fontconfig

- `Sarabun-Regular.ttf`, `Sarabun-Bold.ttf` — Sarabun by Cadson Demak, SIL Open Font License 1.1 (`OFL-Sarabun.txt`) มีทั้งอักษรไทยและละติน

เปลี่ยนฟอนต์ได้ที่ `config/local.json` → `assembly.font_file`, `assembly.fonts_dir`, `assembly.subtitle_font`, `assembly.card_font`
