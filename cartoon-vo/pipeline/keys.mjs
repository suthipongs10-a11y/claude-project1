/**
 * keys.mjs — จัดการคีย์หลายตัวในตัวแปรเดียว (คั่นด้วย , หรือ ;)
 *
 * ทำไม: โควตาฟรีของ Gemini คิดต่อโปรเจกต์ ใส่หลายคีย์แล้วสลับเมื่อโดน 429
 * ได้โควตารวมมากขึ้นโดยไม่ต้องแก้โค้ดที่เรียกใช้
 *
 * ห้าม log ค่าคีย์ (กฎข้อ 6) — มีแต่ mask() ให้ใช้เวลาต้องพูดถึงคีย์ในข้อความ
 */

/** อ่านคีย์จาก env หลายชื่อ แล้วแตกเป็นลิสต์ (ตัดซ้ำ ตัดค่าว่าง) */
export function readKeys(...envNames) {
  const out = [];
  for (const name of envNames) {
    for (const k of String(process.env[name] || "").split(/[,;]/)) {
      const v = k.trim();
      if (v && !out.includes(v)) out.push(v);
    }
  }
  return out;
}

/** แสดงคีย์แบบปิดบัง — ใช้ได้เฉพาะใน log */
export const mask = (k) => (k ? `${k.slice(0, 6)}…${k.slice(-4)}` : "(ว่าง)");

/** 429 / RESOURCE_EXHAUSTED / โควตาหมด → ควรสลับคีย์ ไม่ใช่ retry คีย์เดิม */
export function isQuotaError(err) {
  const s = String(err && err.message ? err.message : err);
  return /\b429\b|RESOURCE_EXHAUSTED|quota|rate limit/i.test(s);
}

/**
 * เรียก fn(key) ไล่ทีละคีย์ เจอ error โควตาก็ข้ามไปคีย์ถัดไป
 * error อื่น (400/403/500) โยนออกทันที เพราะสลับคีย์ก็ไม่ช่วย
 */
export async function withKeyRotation(keys, fn, log = () => {}) {
  if (!keys.length) throw new Error("ไม่มีคีย์ให้ใช้");
  let last;
  for (const [i, key] of keys.entries()) {
    try {
      return await fn(key, i);
    } catch (e) {
      if (!isQuotaError(e) || i === keys.length - 1) throw e;
      last = e;
      log(`  ⚠ คีย์ ${mask(key)} โควตาหมด — สลับไปคีย์ถัดไป`);
    }
  }
  throw last;
}
