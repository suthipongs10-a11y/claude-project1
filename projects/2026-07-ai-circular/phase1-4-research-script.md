# 2026-07-ai-circular — "The $1.4 Trillion Bet: AI's Circular Deal"

**คลิปแรกจริงของช่อง Mr.WhyLab | สถานะ: วิดีโอ Vox-style เสร็จ (57.5 วิ) — รอเสียงพากย์ + โพสต์**

แนว: การเงิน/ธุรกิจ · เกาะกระแสไวรัล (คำถาม "ฟองสบู่ AI จะแตกไหม")
Format: paper-collage gen จากโค้ด 100% ไม่ใช้ฟุตเทจภายนอก → ปลอด Content ID + เสียงไม่ทับ

## Phase 1 — Angle
- หัวข้อไวรัลที่สุดของการเงินปี 2026: ดีลวนเวียน (circular deals) ระหว่าง OpenAI / Nvidia / คลาวด์ยักษ์
- Hook: การพนันครั้งใหญ่ที่สุดในประวัติศาสตร์ — จ่าย $1.4 ล้านล้าน บนรายได้แค่ ~$13B
- Villain/prophet: Michael Burry (The Big Short) เดิมพัน ~$1.1B ว่า AI จะแตก
- Balance: แต่ Nvidia ยังทำกำไรเกินคาด → ปิดด้วยคำถาม "ฟองสบู่ หรือ การปฏิวัติ"

## Phase 2 — ข้อเท็จจริง (เช็คแล้ว ก.ค. 2026)
- OpenAI คอมมิต infrastructure spending รวม ~$1.15–1.4 ล้านล้าน (2025–2035) กับ 7 เจ้า:
  Broadcom $350B, Oracle $300B, Microsoft $250B, Nvidia $100B, AMD $90B, AWS $38B, CoreWeave $22B
- รายได้ OpenAI ปี 2025 ~$13B (บางแหล่งสูงกว่าเล็กน้อย — ใช้ ~ กำกับ)
- **วงเงินไหลวน Nvidia:** Nvidia ลงทุนสูงสุด $100B ใน OpenAI (หุ้นไม่มีสิทธิออกเสียง) →
  OpenAI เอาไปซื้อชิป Nvidia (≥10 GW) = เงินออกแล้ววนกลับ
- **ดีล AMD:** AMD ให้ warrant ซื้อหุ้น ~10% ของ AMD ที่ 1 เซนต์/หุ้น แลก OpenAI สั่ง 6 GW (~$90B)
- **เทียบ dot-com:** vendor financing แบบเดียวกับยุค Cisco 2000; Nasdaq ร่วง ~78% จากจุดพีค
- **Michael Burry (มิ.ย.–ก.ค. 2026):** เปิดชอร์ต Nvidia/Palantir ฯลฯ, พีคช่วงหนึ่ง ~80% พอร์ต
  เป็น puts (~$1.1B notional) เหตุผล: ลูกค้ากระจุกตัว, ค่าเสื่อมถูกยืดอายุ, ภาระ lease นอกงบดุล
- **สถานะ ณ กลางปี 2026:** ยังไม่รู้ใครถูก — Nvidia ยัง beat ทุกไตรมาส

## Phase 3-4 — สคริปต์เสียงพากย์ (EN, ~55 วิ, ต่อ scene01-09)
1. (0:00) "This is the biggest bet in history. One point four trillion dollars — from a single company."
2. (0:06) "Here's the problem. OpenAI has promised to spend $1.4 trillion... on about $13 billion a year in revenue."
3. (0:12) "And the deals are strange. Nvidia invests up to $100 billion into OpenAI — which then spends it buying Nvidia's chips. The same money, going in a circle."
4. (0:19) "It's not just Nvidia. Broadcom, Oracle, Microsoft, AMD — over $1.1 trillion in promises, all pointing back at one startup."
5. (0:26) "The strangest? AMD handed OpenAI the right to 10% of its shares for a penny each — and OpenAI ordered $90 billion of AMD chips. The customer now owns the supplier."
6. (0:33) "We've seen this before. In the dot-com bubble, chip makers funded their own buyers too. Then the Nasdaq fell 78%."
7. (0:40) "One man is betting it all falls: Michael Burry — who called the 2008 crash — is shorting Nvidia with over a billion dollars."
8. (0:47) "But... Nvidia keeps beating every earnings call. The revenue is real, so far. Maybe it's not a bubble — maybe it's the biggest buildout ever."
9. (0:53) "Bubble? Or revolution? Nobody knows yet. Mr. WhyLab — we ask why."

## ไฟล์
- `vox_style.py` — engine กราฟิกกลาง (คัดลอกมาจากโปรเจกต์ crab)
- `finance_shapes.py` — ภาพเฉพาะการเงิน: ชิป, โหนดบริษัท (auto-fit ชื่อ), ธนบัตร,
  กราฟฟองสบู่ดิ่ง, หมี (ขาลง), แว่นขยาย, brain-chip (OpenAI)
- `render_ai.py` — ประกอบ 9 ฉาก + animate + เรนเดอร์ MP4
  - `python3 render_ai.py --stills` → PNG ลง assets/
  - `python3 render_ai.py out.mp4` → วิดีโอเต็ม 1080x1920@30
- `assets/scene01-09.png` — การ์ดนิ่งแต่ละฉาก

## งานที่เหลือ (ทำบน PC หรือคลาวด์)
1. gen เสียงพากย์ 9 ท่อน (ElevenLabs, เสียงผู้ชายทุ้มจริงจัง) → ปรับ dur แต่ละฉากตามเสียง
2. เพลงประกอบจริง (แทร็กใน preview เป็น placeholder)
3. โพสต์: title "AI's $1.4 Trillion Circular Bet", tag #AI #stocks #Nvidia #OpenAI

## ข้อควรระวัง (ความถูกต้อง)
- ตัวเลขทั้งหมดเป็น "คำสัญญา/คอมมิต" ระยะยาว ไม่ใช่จ่ายแล้ว — สคริปต์ใช้คำว่า "promised"
- "$1.4 trillion" เป็นตัวเลขที่ Altman พูด; ยอด commit ตามดีล ~$1.15T — ทั้งคู่ใช้ได้แต่ระบุให้ตรง
- ประเด็น Burry/ฟองสบู่เป็น "การวิเคราะห์/ความเห็น" ไม่ใช่คำพยากรณ์ที่พิสูจน์แล้ว — คลิปวางกลางๆ
