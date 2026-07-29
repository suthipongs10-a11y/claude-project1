/**
 * MouthRig.tsx — ยุงตัวเล่าเรื่อง ปากเปิด/ปิดตาม cues.mouth
 *
 * กฎ: ช่วงไหนอยู่ในช่วงคำ = อ้า · ไม่มีเลขเวลาในไฟล์นี้ ทุกอย่างมาจาก mouth ที่ส่งเข้ามา
 * ปีกกระพือด้วย Math.sin(frame * k) — deterministic ตามกฎข้อ 3 ไม่ใช้ Math.random()
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { within, lerp } from "./timing";

export type MouthSpan = [number, number];

export const MouthRig: React.FC<{
  mouth: MouthSpan[];
  x: number;
  y: number;
  scale?: number;
  tint?: string;
}> = ({ mouth, x, y, scale = 1, tint = "#3E4A63" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const open = mouth.some(([s, e]) => within(t, s, e));
  const mouthH = open ? 13 : 3;

  // ปีกกระพือ + ลอยขึ้นลง — ฟังก์ชันของ frame ล้วน เรนเดอร์ซ้ำได้ภาพเดิมเสมอ
  const flap = Math.sin(frame * 1.15);
  const bob = Math.sin(frame * 0.13) * 6;
  const wingY = lerp(-16, 4, (flap + 1) / 2);

  return (
    <svg
      width={260 * scale}
      height={220 * scale}
      viewBox="0 0 260 220"
      style={{ position: "absolute", left: x, top: y + bob, overflow: "visible" }}
    >
      {/* ปีก — วาดก่อนตัว จะได้อยู่ข้างหลัง */}
      <g opacity={0.75}>
        <ellipse cx={96} cy={72 + wingY} rx={42} ry={15} fill="#BFD9F2"
          transform={`rotate(-24 96 ${72 + wingY})`} />
        <ellipse cx={164} cy={72 + wingY} rx={42} ry={15} fill="#BFD9F2"
          transform={`rotate(24 164 ${72 + wingY})`} />
      </g>

      {/* ลำตัว */}
      <ellipse cx={130} cy={132} rx={40} ry={30} fill={tint} />
      {/* ขา */}
      {[[-1, 0], [-1, 12], [1, 0], [1, 12]].map(([dir, dy], i) => (
        <path key={i}
          d={`M ${130 + dir * 26} ${146 + dy} q ${dir * 22} 16 ${dir * 30} 34`}
          stroke={tint} strokeWidth={4} fill="none" strokeLinecap="round" />
      ))}
      {/* หัว */}
      <circle cx={130} cy={92} r={34} fill={tint} />
      {/* ตา */}
      <circle cx={117} cy={84} r={12} fill="#FFFFFF" />
      <circle cx={145} cy={84} r={12} fill="#FFFFFF" />
      <circle cx={119} cy={86} r={6} fill="#10131A" />
      <circle cx={147} cy={86} r={6} fill="#10131A" />
      {/* ปาก — ความสูงเปลี่ยนตาม mouth เท่านั้น */}
      <ellipse cx={131} cy={110} rx={11} ry={mouthH} fill="#10131A" />
      {/* งวงดูดเลือด */}
      <path d="M 131 120 q 4 22 2 40" stroke={tint} strokeWidth={5} fill="none" strokeLinecap="round" />
      {/* หนวด */}
      <path d="M 112 64 q -10 -20 -26 -26" stroke={tint} strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M 150 64 q 10 -20 26 -26" stroke={tint} strokeWidth={4} fill="none" strokeLinecap="round" />
    </svg>
  );
};

export default MouthRig;
