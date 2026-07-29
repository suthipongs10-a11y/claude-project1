/**
 * timing.ts — ฟังก์ชันคำนวณเวลา/การเคลื่อนไหว แบบ pure ล้วน
 *
 * กฎ (CLAUDE.md ข้อ 1 และ 3):
 *  - ห้าม import อะไรจาก Remotion ในไฟล์นี้ — ต้องเรียกใช้/เทสต์ได้ด้วย node เปล่า ๆ
 *  - ทุกฟังก์ชันต้อง deterministic: ใส่ input เดิม ได้ output เดิมเสมอ
 *  - ห้ามใช้ Math.random() / Date.now() — สุ่มต้องผ่าน mulberry32 ที่มี seed
 */

/** ผสมค่าเชิงเส้นระหว่าง a กับ b ตามสัดส่วน t (t=0 → a, t=1 → b) */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** คืนความคืบหน้า 0..1 ของ t ในช่วง [a, b] — บีบไม่ให้หลุดขอบ (clamp) */
export function prog(t: number, a: number, b: number): number {
  if (b === a) return t >= b ? 1 : 0;
  const p = (t - a) / (b - a);
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/** ออกตัวเร็ว ชะลอตอนจบ (cubic ease-out) */
export function easeOut(t: number): number {
  const p = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - Math.pow(1 - p, 3);
}

/** ค่อย ๆ เร่ง แล้วค่อย ๆ ผ่อน (cubic ease-in-out) */
export function easeIO(t: number): number {
  const p = t < 0 ? 0 : t > 1 ? 1 : t;
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

/**
 * เด้งเกินแล้วกลับเข้าที่ (overshoot) — ใช้ตอนคำโผล่ขึ้นจอ
 * คืนสเกล เริ่ม 0 → พุ่งเลย 1 เล็กน้อย → นิ่งที่ 1
 * s = ความแรงที่เด้งเกิน (ยิ่งมากยิ่งดีดแรง)
 */
export function pop(t: number, s = 1.7): number {
  const p = t < 0 ? 0 : t > 1 ? 1 : t;
  if (p >= 1) return 1;
  const c3 = s + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2);
}

/**
 * PRNG แบบมี seed — ใช้แทน Math.random() ในโค้ดที่วาดภาพ
 * เรียกด้วย seed เดิม ได้ลำดับตัวเลขเดิมทุกครั้ง เฟรมที่เรนเดอร์แยกกันจึงตรงกัน
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** แปลงวินาที → เฟรม (ปัดที่ขอบเท่านั้น ตาม CLAUDE.md: ในไฟล์เก็บเป็นวินาทีเสมอ) */
export function toFrame(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

/** t อยู่ในช่วง [s, e] ไหม (ใช้เช็คว่าเฟรมนี้อยู่ใน beat / ช่วงคำหรือเปล่า) */
export function within(t: number, s: number, e: number): boolean {
  return t >= s && t < e;
}
