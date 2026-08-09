/**
 * font.ts — ฟอนต์ไทยฝังมากับ bundle เลย (data URI) ไม่ fetch ตอนเรนเดอร์
 *
 * ทำไมไม่โหลดจาก staticFile: ตอนเรนเดอร์ยาว ๆ Remotion เปิดแท็บใหม่ระหว่างทาง
 * ถ้าคำขอไฟล์ค้างแม้แท็บเดียว delayRender จะ timeout แล้วล้มทั้งงาน (เจอจริงที่เฟรม 689)
 * data URI ตัดปัญหานี้ทิ้ง เพราะไม่มี network เข้ามาเกี่ยว
 *
 * ทำไมเลิกใช้ delayRender ด้วย: แท็บที่ Remotion เปิดใหม่อยู่เบื้องหลัง
 * Chrome หน่วง `setTimeout` ในแท็บพื้นหลังได้ถึงระดับนาที ตัวกันเหนียวเลยไม่ทันงาน
 * แล้ว delayRender ก็ค้างจนล้มอีกรอบ (เจอจริงที่เฟรม 1306)
 *
 * ทางที่นิ่งกว่า: ฉีด @font-face เป็น CSS ตรง ๆ ตอนโหลดโมดูล — เป็นงาน DOM ล้วน
 * ไม่มี timer ไม่มี promise ให้ค้าง · `font-display: block` สั่งให้ Chrome
 * ซ่อนตัวอักษรไว้จนกว่าฟอนต์จะพร้อม จึงไม่มีเฟรมไหนได้ฟอนต์ fallback ที่สระไทยหาย
 */
import { KANIT_BOLD_B64 } from "./font-data";

export const THAI_FONT = "KanitCartoon";

const CSS = `@font-face{
  font-family:"${THAI_FONT}";
  font-style:normal;
  font-weight:700;
  font-display:block;
  src:url(data:font/ttf;base64,${KANIT_BOLD_B64}) format("truetype");
}`;

if (typeof document !== "undefined" && !document.getElementById("thai-font-face")) {
  const el = document.createElement("style");
  el.id = "thai-font-face";
  el.textContent = CSS;
  document.head.appendChild(el);
  // สั่งให้เริ่มโหลดทันที ไม่ต้องรอให้มีข้อความมาใช้ก่อน — ไม่ gate อะไรทั้งสิ้น
  document.fonts?.load(`700 100px "${THAI_FONT}"`).catch(() => {});
}
