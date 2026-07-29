/**
 * font.ts — ฟอนต์ไทยฝังมากับ bundle เลย (data URI) ไม่ fetch ตอนเรนเดอร์
 *
 * ทำไมไม่โหลดจาก staticFile: ตอนเรนเดอร์ยาว ๆ Remotion เปิดแท็บใหม่ระหว่างทาง
 * ถ้าคำขอไฟล์ค้างแม้แท็บเดียว delayRender จะ timeout แล้วล้มทั้งงาน (เจอจริงที่เฟรม 689)
 * data URI ตัดปัญหานี้ทิ้ง เพราะไม่มี network เข้ามาเกี่ยว
 *
 * ยังใช้ delayRender อยู่ เพื่อกันเฟรมแรก ๆ ได้ฟอนต์ fallback ที่ไม่มีสระไทย
 * แต่ประกันไว้ว่า continueRender ถูกเรียกเสมอ ไม่ว่าจะสำเร็จหรือพัง
 */
import { continueRender, delayRender } from "remotion";
import { KANIT_BOLD_B64 } from "./font-data";

export const THAI_FONT = "KanitCartoon";

const handle = delayRender("โหลดฟอนต์ไทย", { timeoutInMilliseconds: 60000 });

let settled = false;
const finish = () => {
  if (settled) return;
  settled = true;
  continueRender(handle);
};

try {
  const face = new FontFace(THAI_FONT, `url(data:font/ttf;base64,${KANIT_BOLD_B64}) format("truetype")`);
  face.load().then((f) => { document.fonts.add(f); finish(); }).catch(finish);
  // กันเหนียว: ถึงยังไงก็ต้องปล่อยให้เรนเดอร์เดินต่อ
  setTimeout(finish, 15000);
} catch {
  finish();
}
