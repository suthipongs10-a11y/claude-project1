#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scenes.py — สตอรี่บอร์ด health EP.01 (60 ภาพ) + สร้าง PROMPTS.json

ทำก่อนมีเสียงพากย์ได้ เพราะผูกฉากกับ "บรรทัดในบท" ไม่ใช่ timing
พอได้ voiceover + word-timings แล้ว ค่อยรัน bind_shots.py จับช็อต -> ฉาก

กฎ prompt (บทเรียนจาก agri EP.01 — ดู CHANNELS.md):
 - ห้ามคำว่า board/sign/banner/speech bubble/panel/frame/text box (โมเดลจะวาดกรอบเปล่า)
 - ข้อห้ามเรื่องตัวหนังสือต้องอยู่ "ต้น prompt" ไม่ใช่แค่ negative
 - ทุกภาพต้องมีฉากหลัง (คลินิก/ครัว/บ้าน/สวน/ร้านกาแฟ)
 - เว้นที่โล่งไว้ให้ caption (HyperFrames หาที่ว่างเอง แต่ช่วยเว้นให้ด้วย)
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))

# (บรรทัดในบท, visual ไทย, ท่ามาสคอต, prompt อังกฤษ)
SCENES = [
 # ── HOOK ──
 ([0], "หมอยกมือทำท่าถามผู้ชม ในห้องตรวจโทนมิ้นต์", "ยกมือถาม ชวนสงสัย",
  "The mascot doctor stands in a clean mint-toned clinic room, one hand raised in a friendly questioning gesture, head tilted, warm curious smile. A simple examination bed and a potted plant behind. Keep the upper-right area open and low-detail."),
 ([1], "ชายหนุ่มรูปร่างผอมยืนบนเครื่องชั่ง เข็มชี้ปกติ ยิ้ม แต่ตับเรืองแสงส้มจาง ๆ ในตัว", "หมอมองอย่างเป็นห่วง",
  "A slim young man stands on a bathroom scale looking relaxed and pleased, his body drawn slim and healthy, but a soft coral glow shows faintly at his liver area under the shirt. The mascot doctor stands nearby watching with a gently concerned expression. Home bathroom setting with mint tiles. Keep the upper-left area open and low-detail."),
 ([2], "ชายผอมคนเดิมใช้ชีวิตปกติ ทำงาน เดิน ยิ้ม ไม่มีอาการอะไร มีเครื่องหมายคำถามลอย", "ไม่มีมาสคอต",
  "The same slim young man goes about an ordinary day looking completely fine: walking to work, smiling, carrying a bag, no discomfort at all. Two or three small floating question mark shapes drift around him. A simple city street with trees and soft mint-blue sky. Keep the upper-right area open and low-detail."),
 ([3], "ห้องตรวจสุขภาพประจำปี หมอชี้ผลเลือดที่มีแถบสูงผิดปกติ คนไข้ผอมทำหน้าตกใจ", "ชี้ผลตรวจ อธิบายนุ่มนวล",
  "In a bright clinic, the mascot doctor gently points at a slim clipboard, where one horizontal coral bar rises clearly higher than the other plain neutral bars printed on it. A slim patient beside looks surprised, eyebrows raised. Clinic background with a window and plant. Keep the top area open and low-detail."),
 ([4], "หมอกางมือแนะนำหัวข้อ 3 เรื่องที่จะเล่า มีไอคอนลอยรอบตัว", "แนะนำหัวข้อ",
  "The mascot doctor stands with both arms open in a welcoming presenting pose. Three simple floating icons arc above: a small cartoon liver, a sugar cube, and a running shoe. Clean mint clinic background with soft rounded shapes. Keep the top area open and low-detail."),
 ([5], "โคลสอัพมือถือแก้วชานมไข่มุกเย็น หยดน้ำเกาะแก้ว ฉากร้านเครื่องดื่ม", "ไม่มีมาสคอต",
  "Close-up of a hand holding a tall clear plastic cup of iced milk tea with dark tapioca pearls at the bottom and condensation on the cup. Warm, appetizing, everyday. Behind is a softly blurred drink shop counter in mint and cream tones. Keep the upper-left area open and low-detail."),

 # ── ACT 1: ตับสะสมไขมันได้ยังไง ──
 ([6], "ตับการ์ตูนหน้ายิ้มสุขภาพดี สีน้ำตาลแดงสด มีหยดไขมันเล็ก ๆ แค่ไม่กี่หยด", "ไม่มีมาสคอต",
  "A friendly cartoon liver character with a cheerful smiling face, healthy reddish-brown color, rounded and plump, with only two or three tiny pale yellow fat droplets inside it. It floats in a clean soft mint space with a simple rounded medical shelf and plant behind. Keep the upper-right area open and low-detail."),
 ([7], "ตับการ์ตูนตัวเดิม แต่มีหยดไขมันเหลืองเต็มไปหมด หน้าเริ่มอึดอัด มีมาตรวัดชี้โซนสูง", "หมอชี้มาตรวัด",
  "The same cartoon liver character now crowded with many pale yellow fat droplets inside, its face looking uncomfortable and strained. Beside it a simple round dial gauge with a needle swung into a coral zone, no numerals or markings on the dial. The mascot doctor points at the gauge. Soft mint clinic background. Keep the top area open and low-detail."),
 ([8], "ลำดับ 3 ขั้นของตับ: อักเสบแดง → มีเส้นพังผืด → ตับแข็งขรุขระเล็กลง", "ไม่มีมาสคอต",
  "Three cartoon livers in a row, connected by simple arrows, showing progression left to right: first inflamed with a coral flush and a pained face, second with pale fibrous streaks across it, third shrunken with a bumpy hardened surface and a sad face. Soft mint background with plenty of clean space. Keep the top area open and low-detail."),
 ([9], "หมอชูสามนิ้ว ทำหน้าสงสัย ข้าง ๆ มีชายผอมยืนกอดอก", "ชูสามนิ้ว ตั้งคำถาม",
  "The mascot doctor holds up three fingers with a thoughtful questioning expression, while a slim young man stands beside with arms folded, also puzzled. Clean mint clinic room with a chair and plant. Keep the upper-right area open and low-detail."),
 ([10], "ชายผอมยืนบนเครื่องชั่ง เข็มชี้ปกติ แต่มีเครื่องหมายคำถามเหนือหัว", "ไม่มีมาสคอต",
  "A slim man stands on a bathroom scale, the dial needle resting in a calm neutral position, but a floating question mark hovers above his head. Simple home setting with mint tiles and a towel rack. Keep the upper-left area open and low-detail."),
 ([11, 12], "ภาพตัดขวางลำตัวคนผอม เห็นไขมันสีเหลืองห่อหุ้มอวัยวะในช่องท้อง แขนขายังเล็ก", "หมอชี้ไขมันในช่องท้อง",
  "A simple cross-section illustration of a slim person's torso, arms and legs clearly thin, but inside the abdomen soft yellow fat cushions wrap around the rounded organs. The mascot doctor stands beside pointing into the cross-section with a calm teaching gesture. Clean mint clinic background. Keep the upper-right area open and low-detail."),
 ([13], "หมอชี้ที่กล้ามเนื้อต้นแขนของชายหนุ่ม กล้ามเนื้อวาดเป็นมัดสีชมพูอมส้ม", "ชี้กล้ามเนื้อ",
  "The mascot doctor points at the upper arm of a young man, where the muscle is drawn as a simple rounded pink-coral bundle just under the skin. Bright clinic or gym corner background with mint walls. Keep the top area open and low-detail."),
 ([14], "ก้อนน้ำตาลสีขาวลอยเข้าไปในมัดกล้ามเนื้อ กล้ามเนื้อยิ้มรับ มีประกาย", "ไม่มีมาสคอต",
  "Several small white sugar cubes float along a curved arrow into a friendly smiling cartoon muscle bundle, which glows with small sparkle marks as it accepts them. Soft mint background with simple rounded shapes. Keep the upper-left area open and low-detail."),
 ([15], "กล้ามเนื้อเล็กลีบ รับน้ำตาลไม่ไหว ก้อนน้ำตาลล้นไหลไปทางตับที่ทำหน้าหนักใจ", "ไม่มีมาสคอต",
  "A small shrunken cartoon muscle bundle looks tired and can only take one sugar cube, while the remaining sugar cubes overflow along a curved arrow toward a cartoon liver character that looks burdened and overwhelmed. Soft mint background. Keep the top area open and low-detail."),
 ([16, 17], "คนผอมสองคนหน้าตาคล้ายกัน มีเกลียวดีเอ็นเอลอยระหว่าง ตับของคนขวามีไขมันมากกว่า", "หมอเปรียบเทียบสองคน",
  "Two slim young men of similar build stand side by side, a simple mint-blue double helix shape floating between them. A small cartoon liver is drawn beside each: the left one clean and healthy, the right one dotted with many yellow fat droplets. The mascot doctor stands to one side gesturing between them. Clean clinic background. Keep the top area open and low-detail."),

 # ── ACT 2: ตัวการคือน้ำตาล ──
 ([18], "หมอชูนิ้วชี้ขึ้น ทำหน้าเน้นย้ำ ในห้องตรวจ", "ชูนิ้ว เน้นย้ำ",
  "The mascot doctor raises one index finger upward in an emphatic wait-a-moment gesture, eyebrows raised, engaging the viewer. Clean mint clinic room with a shelf and plant behind. Keep the upper-right area open and low-detail."),
 ([19], "จานของทอด หมูสามชั้น ไก่ทอด บนโต๊ะครัว มีคนคิดถึงมัน", "ไม่มีมาสคอต",
  "A plate of fried food on a kitchen table: crispy fried chicken pieces and slices of fatty pork belly, drawn appetizing and warm. A hand reaches in with chopsticks to pick up a piece. Home kitchen background in cream and mint tones. Keep the upper-left area open and low-detail."),
 ([20], "จานของทอดถูกกากบาทจาง ๆ แล้วสปอตไลต์ฉายไปที่ก้อนน้ำตาลแทน", "หมอชี้ก้อนน้ำตาล",
  "The plate of fried food sits dimmed to one side with a soft grey cross mark over it, while a bright warm spotlight falls on a small pile of white sugar cubes on the other side. The mascot doctor points at the sugar with a serious but kind expression. Kitchen counter background. Keep the top area open and low-detail."),
 ([21, 22], "แผนผังร่างกาย: น้ำตาลฟรุกโตสไหลผ่านกล้ามเนื้อกับสมองไปไม่ได้ ลูกศรพุ่งตรงเข้าตับ", "หมอชี้เส้นทาง",
  "A simple friendly body outline seen from the front. Small sugar cube shapes travel along a bold coral arrow that curves past the arms and head, which are marked with faint grey cross marks, and plunges straight down into a cartoon liver glowing in the abdomen. The mascot doctor points along the arrow path. Clean mint background. Keep the upper-right area open and low-detail."),
 ([23], "ตับการ์ตูนกำลังปั้นก้อนน้ำตาลให้กลายเป็นหยดไขมันเหลือง แล้วเก็บไว้ในตัว", "ไม่มีมาสคอต",
  "A cartoon liver character with small rounded hands is busy squeezing white sugar cubes and turning them into soft yellow fat droplets, tucking them inside its own body, looking increasingly stuffed. Soft mint background with simple shapes. Keep the upper-left area open and low-detail."),
 ([24], "หมอยกมือแนะนำงานวิจัย ท่าตื่นเต้นอยากเล่า", "แนะนำงานวิจัย",
  "The mascot doctor leans forward slightly with both hands open in an eager, I-have-something-to-show-you gesture, bright interested expression. Clean mint clinic background with a plant. Keep the upper-right area open and low-detail."),
 ([25], "ผู้ชายหลายสิบคนยืนเรียงกัน แบ่งเป็นสามกลุ่ม แต่ละกลุ่มถือแก้วเครื่องดื่มคนละสี", "ไม่มีมาสคอต",
  "Rows of many small simplified male figures stand arranged into three distinct groups, each group holding drinking glasses of a different color: coral, soft yellow, and mint. Clean light research-room background with soft mint walls. Keep the top area open and low-detail."),
 ([26], "แก้วสามใบมีน้ำตาลเท่ากัน ตาชั่งสมดุลอยู่ข้าง ๆ เข็มนิ่ง", "หมอชี้ว่าเท่ากันหมด",
  "Three identical glasses side by side, each with the same small heap of sugar beside it, and a simple balance scale nearby resting perfectly level. The mascot doctor gestures to show they are all equal. Clean mint background. Keep the upper-left area open and low-detail."),
 ([27], "เทียบสองตับ: ตับกลุ่มฟรุกโตสมีหยดไขมันมากเป็นสองเท่าของอีกตับ มีแท่งเปรียบเทียบสูงต่ำ", "ไม่มีมาสคอต",
  "Two cartoon livers side by side for comparison. The left one has a modest scattering of yellow fat droplets; the right one is packed with about twice as many and looks strained. Behind them two plain vertical coral bars, the right one clearly twice the height of the left, with no markings. Soft mint background. Keep the top area open and low-detail."),
 ([28], "ตับของกลุ่มกลูโคส ดูเหมือนเดิม หน้ายิ้มสบาย มีเครื่องหมายถูก", "ไม่มีมาสคอต",
  "A cartoon liver looking calm and unchanged with a relaxed smile, only a couple of tiny fat droplets inside, and a simple mint-green check mark floating beside it. Clean soft mint background. Keep the upper-right area open and low-detail."),
 ([29, 30], "ตาชั่งนิ่งกับจานอาหารเท่าเดิม แต่ตับสองแบบต่างกันชัด ชายผอมยืนงง", "หมอเน้นย้ำจุดสำคัญ",
  "On one side a balance scale resting level and a plate of food, showing nothing has changed. On the other side two cartoon livers looking clearly different from each other. A slim young man stands between them looking puzzled while the mascot doctor gestures to emphasize the contrast. Clean mint background. Keep the top area open and low-detail."),
 ([31], "ถ้วยน้ำตาลทราย ครึ่งหนึ่งของเม็ดถูกไฮไลต์เป็นสีคอรัล", "หมอชี้ถ้วยน้ำตาล",
  "A small bowl of white granulated sugar where roughly half of the grains are tinted a soft coral color, clearly showing a half-and-half split. The mascot doctor points at the coral half. Kitchen counter background in cream and mint. Keep the upper-left area open and low-detail."),
 ([32], "แก้วชานมไข่มุก ข้าง ๆ มีกองน้ำตาลก้อนสูงเท่าโควตาทั้งวัน", "หมอทำหน้าตกใจเบา ๆ",
  "A tall cup of iced milk tea with tapioca pearls stands next to a surprisingly tall stack of white sugar cubes of similar height. The mascot doctor stands beside with a gently startled expression, one hand to cheek. Drink shop background in mint and cream. Keep the upper-right area open and low-detail."),
 ([33, 34], "เครื่องดื่มไทยเรียงกัน: กาแฟเย็น น้ำอัดลม น้ำผลไม้กล่อง ชาเขียวขวด มีครีมเทียมกับหยดไขมันลอย", "ไม่มีมาสคอต",
  "A row of everyday Thai drinks lined up on a counter: an iced coffee in a plastic cup, a soda bottle, a boxed fruit juice with a straw, and a bottled green tea. Small soft yellow fat droplets and a swirl of creamy liquid float above them. Convenience store shelf background in mint and cream tones. Keep the top area open and low-detail."),

 # ── ACT 3: รู้ตัวยังไง แก้ยังไง ──
 ([35], "หมอพลิกมือทำท่าเปลี่ยนเรื่อง สู่ภาคปฏิบัติ ในคลินิกสว่าง", "เปลี่ยนเรื่อง ชวนลงมือ",
  "The mascot doctor turns with an open-palmed lets-get-practical gesture and an encouraging smile, stepping forward slightly. Bright clean clinic room with a window and plant. Keep the upper-right area open and low-detail."),
 ([36], "หลอดเลือดตัวอย่างกับหัวตรวจอัลตราซาวด์วางบนหน้าท้อง เห็นภาพตับบนจอ", "หมอถือหัวตรวจ",
  "The mascot doctor holds an ultrasound probe against a patient's abdomen while a small rounded screen beside shows only a soft grey silhouette of a liver and nothing else. A small rack of blood sample tubes with coral caps sits on the table nearby. Clean clinic examination room. Keep the top area open and low-detail."),
 ([37, 38], "คนผอมแต่มีพุงเล็ก ยืนคุยกับหมอ มีไอคอนแก้วน้ำหวานกับครอบครัวลอยข้าง ๆ", "หมอรับฟัง จดบันทึก",
  "A slim man with a slightly rounded belly talks with the mascot doctor, who listens warmly while holding a clipboard. Two small icons float nearby: a sweet drink cup and a simple trio of family figures. Clinic consultation room with mint walls and a plant. Keep the upper-left area open and low-detail."),
 ([39], "ตับการ์ตูนกำลังฟื้นตัว หยดไขมันหายไป กลับมายิ้มสดใส มีประกายรอบตัว", "ไม่มีมาสคอต",
  "A cartoon liver character brightening back to a healthy reddish-brown, the yellow fat droplets inside shrinking and fading away, a happy relieved smile on its face, with small sparkle marks around it. Soft mint background. Keep the upper-right area open and low-detail."),
 ([40], "หมอชูสี่นิ้ว ยิ้มให้กำลังใจ", "ชูสี่นิ้ว",
  "The mascot doctor holds up four fingers with a bright encouraging smile and a confident posture. Clean mint clinic background with rounded shapes. Keep the top area open and low-detail."),
 ([41], "มือดันแก้วน้ำหวานออกไป แล้วเลือกแก้วน้ำเปล่าแทน บนโต๊ะร้าน", "หมอทำท่าปฏิเสธอย่างสุภาพ",
  "A hand gently pushes away a tall cup of sweet iced milk tea and reaches instead for a clear glass of plain water. The mascot doctor stands behind with an approving nod and a small thumbs up. Cafe table background in mint and cream. Keep the upper-left area open and low-detail."),
 ([42, 43], "จานข้าวไทยยังอยู่ครบ มีเครื่องหมายถูกสีเขียว ส่วนแก้วน้ำหวานมีลูกศรพุ่งเข้าตับเร็วกว่า", "หมอเปรียบเทียบ",
  "On the left a normal plate of Thai rice with vegetables and a mint-green check mark above it. On the right a sweet drink cup with a bold coral arrow rushing quickly down into a small cartoon liver. The mascot doctor gestures between them explaining the difference. Home dining table background. Keep the top area open and low-detail."),
 ([44], "แก้วชาเย็นหวานน้อยกับแก้วน้ำเปล่า วางคู่กัน มือกำลังเลือก", "ไม่มีมาสคอต",
  "Two drinks side by side on a counter: a lightly sweetened iced tea in a clear cup and a glass of plain water with ice. A hand hovers, about to pick one. Soft mint drink shop background. Keep the upper-right area open and low-detail."),
 ([45], "ผลไม้สดหั่นชิ้น มะละกอ ฝรั่ง ส้ม ในจาน มีเครื่องหมายถูก", "หมอยกนิ้วโป้ง",
  "A plate of fresh cut Thai fruit: papaya slices, guava wedges and orange segments, looking bright and fresh, with a mint-green check mark floating beside. The mascot doctor gives a friendly thumbs up. Home kitchen table background. Keep the upper-left area open and low-detail."),
 ([46], "หมอสวมรองเท้าผ้าใบ ทำท่าเตรียมออกกำลังกาย ในสวนสาธารณะ", "เตรียมออกกำลัง",
  "The mascot doctor stands in a park wearing sneakers under the white coat, stretching one arm across the chest in a warm-up pose, cheerful and energetic. Park background with trees, a path and soft mint-blue sky. Keep the upper-right area open and low-detail."),
 ([47, 48], "คนผอมเดินออกกำลังกาย เครื่องชั่งข้าง ๆ เข็มนิ่งไม่ขยับ แต่ตับมีไขมันลดลง", "ไม่มีมาสคอต",
  "A slim person walks briskly along a park path. Beside them a bathroom scale with its needle resting completely still and unchanged, while a small cartoon liver above shows its yellow fat droplets clearly reduced and a relieved smile. Park background with trees. Keep the top area open and low-detail."),
 ([49], "คนธรรมดารูปร่างเท่าเดิม เริ่มก้าวเดินออกไป มีลูกศรให้กำลังใจ", "หมอโบกมือเชียร์",
  "An ordinary person of unchanged build takes a confident first step forward onto a path, with a soft mint arrow curving ahead of them. The mascot doctor waves encouragingly from the side. Park background with trees and benches. Keep the upper-left area open and low-detail."),
 ([50], "คนเดินเร็วในสวน กับอีกคนยกดัมเบล มีนาฬิกาแสดงครึ่งชั่วโมง", "ไม่มีมาสคอต",
  "Split composition: on the left a person walking briskly along a park path, on the right the same person lifting a small dumbbell. Between them a simple round clock face with the hand sweeping across half its circle, no numerals on the dial. Park and home corner backgrounds blended softly. Keep the top area open and low-detail."),
 ([51], "คนที่มีพุงเล็กน้อย ยืนมองพุงตัวเองในกระจก หมอยืนข้าง ๆ ให้กำลังใจ", "ให้กำลังใจ ไม่ตัดสิน",
  "A person with a slightly rounded belly stands looking at themselves in a mirror without shame, while the mascot doctor stands beside with a warm supportive hand gesture and a kind smile. Home bedroom with mint walls and a plant. Keep the upper-right area open and low-detail."),
 ([52, 53], "เครื่องชั่งแสดงน้ำหนักลดลงนิดเดียว ข้าง ๆ มีถุงข้าวสารเล็ก ๆ สองถุงเทียบขนาดที่ลด", "หมอชี้ว่าลดนิดเดียวพอ",
  "A bathroom scale with its needle shifted only a small step to the left, and beside it two small rice sacks stacked to show how little weight that is. The mascot doctor points at the small sacks with a reassuring expression, as if to say this is all it takes. Home setting with mint tiles. Keep the top area open and low-detail."),
 ([54], "แก้วกาแฟดำร้อนวางบนโต๊ะไม้ มีไอลอย บรรยากาศร้านกาแฟ", "หมอถือแก้วกาแฟ ยิ้ม",
  "The mascot doctor holds a warm cup of black coffee with soft steam curling up, smiling contentedly. A wooden cafe table and a window with plants behind, mint and cream tones. Keep the upper-left area open and low-detail."),
 ([55], "แก้วกาแฟดำสองแก้ววางเรียง ข้าง ๆ มีตับการ์ตูนยิ้มแข็งแรง", "ไม่มีมาสคอต",
  "Two cups of black coffee stand side by side on a cafe table, and beside them a small cartoon liver character looking healthy and cheerful with a strong confident pose. Cafe background with a window and plants. Keep the upper-right area open and low-detail."),
 ([56], "แก้วกาแฟที่มีน้ำตาลกับครีมเทียมเทลงไป ถูกกากบาทแดง ข้าง ๆ กาแฟดำมีเครื่องหมายถูก", "หมอเตือน",
  "Two coffee cups compared: the left one has sugar and creamy white liquid pouring into it and carries a coral cross mark, the right one is plain black coffee with a mint-green check mark. The mascot doctor gestures toward the black coffee. Cafe counter background. Keep the top area open and low-detail."),

 # ── ACT 4: ความเข้าใจผิด ──
 ([57], "หมอชูสามนิ้ว ทำท่าจะเคลียร์ความเข้าใจผิด", "ชูสามนิ้ว จะเคลียร์",
  "The mascot doctor holds up three fingers with a friendly lets-clear-this-up expression, leaning in slightly. Clean mint clinic background with soft shapes. Keep the upper-right area open and low-detail."),
 ([58, 59], "ขวดเหล้าถูกกากบาท แต่ตับยังมีไขมัน มีลูกศรชี้ไปที่ก้อนน้ำตาลกับพุงแทน", "หมอชี้ต้นเหตุจริง",
  "A liquor bottle on the left with a grey cross mark over it, while beside it a cartoon liver still shows yellow fat droplets inside. A bold coral arrow points away from the bottle toward a sugar cube and a rounded belly shape instead. The mascot doctor points along the arrow. Clean mint background. Keep the top area open and low-detail."),
 ([60], "จานสลัดผักกับอาหารมังสวิรัติ ดูสะอาดสุขภาพดี บนโต๊ะครัว", "ไม่มีมาสคอต",
  "A fresh vegetarian meal on a kitchen table: a bowl of green salad, steamed vegetables and brown rice, looking clean and healthy. Bright home kitchen background in cream and mint. Keep the upper-left area open and low-detail."),
 ([61], "แก้วสมูทตี้ผลไม้ปั่นใส่น้ำผึ้ง ข้าง ๆ มีน้ำผึ้งไหลลง มีตับทำหน้าเหนื่อย", "หมอเตือนเบา ๆ",
  "A tall glass of blended fruit smoothie with honey drizzling into it from a dipper. Beside it a small cartoon liver looking tired and overloaded. The mascot doctor raises a gentle cautioning hand. Kitchen counter background in mint and cream. Keep the upper-right area open and low-detail."),
 ([62], "คนผอมยิ้มสบายใจ ทำท่าว่าไม่เป็นไร แต่ข้างในตับเริ่มมีไขมัน", "ไม่มีมาสคอต",
  "A slim person shrugs cheerfully as if everything is fine, feeling no discomfort, while a soft translucent view of the abdomen shows a cartoon liver already dotted with yellow fat droplets. Home living room background in mint tones. Keep the upper-left area open and low-detail."),
 ([63], "ไทม์ไลน์ตับ 4 ระยะ ค่อย ๆ แย่ลง โดยที่คนยังยิ้มอยู่ตลอด จนถึงระยะท้าย", "หมอชี้ไทม์ไลน์",
  "Four small cartoon livers in a row along a simple horizontal line, gradually getting more damaged from left to right, while above each one a small figure of the same person keeps smiling until the very last stage where they finally look unwell. The mascot doctor points at the timeline. Clean mint background. Keep the top area open and low-detail."),
 ([64, 65], "เทียบคนผอมกับคนอ้วนที่เป็นโรคเดียวกัน ตาชั่งความเสี่ยงเอียงมาทางคนผอม", "หมอเปรียบเทียบอย่างจริงจัง",
  "A slim person and a heavier person stand on either side of a simple balance scale, each with a cartoon liver dotted with fat droplets beside them. The scale tips slightly toward the slim person's side. The mascot doctor stands between them with a serious caring expression. Clean mint clinic background. Keep the top area open and low-detail."),

 # ── OUTRO ──
 ([66, 67], "หมอสรุป ชี้ไปที่คนผอมกับแก้วน้ำหวาน สองสิ่งคู่กัน", "สรุปประเด็นหลัก",
  "The mascot doctor stands in the center gesturing to two things beside them: on one side a slim person, on the other a sweet iced drink cup. A small cartoon liver floats between the two. Clean bright clinic background with a plant. Keep the top area open and low-detail."),
 ([68, 69], "มือกำลังสั่งเครื่องดื่มที่เคาน์เตอร์ เลือกแบบหวานน้อย มีตับยิ้มลอยข้าง ๆ", "หมอยิ้มให้กำลังใจ",
  "A hand orders a drink at a shop counter, receiving a lightly colored iced tea instead of a heavily sweetened one, while a small cheerful cartoon liver floats nearby giving a tiny thumbs up. The mascot doctor smiles encouragingly behind the counter area. Drink shop background in mint and cream. Keep the upper-left area open and low-detail."),
 ([70], "หมอยื่นมือชวนคุย ในห้องตรวจ มีคนไข้นั่งปรึกษาอย่างสบายใจ", "ชวนปรึกษาแพทย์",
  "The mascot doctor sits across a small desk from a relaxed patient, leaning forward with an open inviting hand gesture in a warm consultation moment. Bright clinic room with a window, plant and soft mint walls. Keep the upper-right area open and low-detail."),
 ([71], "หมอยกมือทำท่าอธิบายอย่างระมัดระวัง โทนภาพสงบ เรียบง่าย", "ย้ำว่าเป็นความรู้ทั่วไป",
  "The mascot doctor stands with both hands raised in a calm, careful, honest explaining gesture, expression sincere and measured. Very clean simple mint clinic background with lots of open space. Keep the top area open and low-detail."),
 ([72, 73], "หมอโบกมือลา ยิ้มอบอุ่น มีไอคอนหัวใจกับกระดิ่งลอย และคนสองคนส่งคลิปให้กัน", "โบกมือลา",
  "The mascot doctor waves goodbye with a warm friendly smile. A small heart shape and a small bell shape float nearby, and behind, two simple figures share a phone screen with each other. Bright clinic background with a plant and window. Keep the upper-left area open and low-detail."),
]

MASCOT = (
 "The mascot is a friendly approachable doctor character with a round soft face, warm gentle smile, "
 "small dark dot eyes, wearing a clean white coat over a mint-teal shirt, with a mint-teal stethoscope "
 "around the neck and small rounded hands. Keep the round face, white coat and mint stethoscope "
 "identical in every shot.")

STYLE = (
 "STYLE: clean modern flat vector illustration, smooth rounded friendly shapes, soft bold outlines, "
 "simple flat fills with gentle soft shading, calm health palette (mint teal #2BB6A3, deep teal #17998A, "
 "soft sky blue #6FC9E8, coral #FF6F61, soft yellow #FFCB47, mint white #F4FBF9, teal ink #1E3A38). "
 "Always include a simple soft background setting, never a plain empty background, but keep it clean "
 "and uncluttered with generous open low-detail areas. Reassuring, caring and trustworthy mood, never "
 "scary or clinical. Not photorealistic, no gradient mesh, no realistic texture, no 3D. 16:9.")

# ข้อห้ามอยู่ "ต้น prompt" ตามบทเรียนจาก agri (negative อย่างเดียวกันไม่อยู่)
NO_TEXT = (
 "Absolutely no text, no letters, no words, no numbers and no lettering of any kind anywhere in this "
 "image. Every surface, object and garment stays completely free of writing.")

NEGATIVE = ("text, letters, words, numbers, captions, labels, signage, signboard, banner, speech bubble, "
            "blank text box, empty frame, watermark, signature, gibberish writing, "
            "photorealistic, 3d render, realistic texture, gradient mesh, photograph, "
            "scary, gore, blood, distressing medical imagery, deformed face, blurry, cluttered")


def main():
    scenes, prompts = [], []
    for i, (lines, visual, mascot, body) in enumerate(SCENES, 1):
        sid = f"img{i:02d}"
        scenes.append({"id": sid, "lines": lines, "visual": visual, "mascot": mascot})
        has_mascot = mascot != "ไม่มีมาสคอต"
        parts = [NO_TEXT, body]
        if has_mascot:
            parts.append(MASCOT)
        parts.append(STYLE)
        prompts.append({"id": sid, "prompt": "\n\n".join(parts), "negative": NEGATIVE})

    json.dump(scenes, open(os.path.join(HERE, "scenes.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    json.dump(prompts, open(os.path.join(HERE, "PROMPTS.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    nl = len(open(os.path.join(HERE, "clips/narration.txt"), encoding="utf-8")
             .read().strip().splitlines())
    covered = sorted(l for s in SCENES for l in s[0])
    missing = [i for i in range(nl) if i not in covered]
    dupes = [i for i in set(covered) if covered.count(i) > 1]
    print(f"ฉาก {len(SCENES)} ภาพ · ครอบคลุมบรรทัด {len(set(covered))}/{nl}")
    print(f"มีมาสคอต {sum(1 for s in SCENES if s[2] != 'ไม่มีมาสคอต')} ภาพ")
    if missing:
        print(f"  ⚠️ บรรทัดที่ยังไม่มีฉาก: {missing}")
    if dupes:
        print(f"  ⚠️ บรรทัดซ้ำ: {sorted(dupes)}")
    if not missing and not dupes:
        print("✅ ครบทุกบรรทัด ไม่ซ้ำ ไม่ขาด")


if __name__ == "__main__":
    main()
