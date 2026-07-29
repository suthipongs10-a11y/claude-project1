/**
 * Scene.tsx — ฉากหลัก อ่าน beats จาก cues ไม่มีเลขเวลาใน component แม้แต่ตัวเดียว
 *
 * beats ที่ใช้ (ชื่อมาจาก script.json):
 *   bedroom_night · swat_panic · reveal_answer · lab_zoom · resting_spot
 *   shift_board · day_shift · night_shift · wrap_up
 *
 * ฟ้าเปลี่ยนสีตามว่าตอนนี้อยู่ beat ไหน = "กะกลางวัน" หรือ "กะกลางคืน"
 * ดาว/ฝุ่นใช้ mulberry32 ตอน init (กฎข้อ 3) ไม่ใช้ Math.random ตอนวาด
 */
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { prog, easeIO, easeOut, lerp, mulberry32, within } from "./timing";
import { TextLayer, type Line } from "./TextLayer";
import { MouthRig, type MouthSpan } from "./MouthRig";

export type Cues = {
  fps: number;
  duration: number;
  frames: number;
  source: string;
  audio?: string;
  beats: Record<string, [number, number]>;
  mouth: MouthSpan[];
  lines: Line[];
};

const NIGHT_TOP = "#121A33", NIGHT_BOT = "#2A3358";
const DAY_TOP = "#7EC8F0", DAY_BOT = "#CFEBFF";

const mix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const c = (x: number, y: number) => Math.round(lerp(x, y, t)).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
};

export const Scene: React.FC<{ cues: Cues }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const B = cues.beats;

  // ── กลางวัน/กลางคืน: ไล่จากกะกลางคืน → กะกลางวัน → กลับเป็นกลางคืน ──
  const day = B.day_shift
    ? easeIO(prog(t, B.day_shift[0] - 0.6, B.day_shift[0] + 0.9))
    : 0;
  const backToNight = B.night_shift
    ? easeIO(prog(t, B.night_shift[0] - 0.4, B.night_shift[0] + 0.9))
    : 0;
  const dayness = Math.max(0, day - backToNight);

  const skyTop = mix(NIGHT_TOP, DAY_TOP, dayness);
  const skyBot = mix(NIGHT_BOT, DAY_BOT, dayness);

  // ── ดาว: ตำแหน่งคงที่จาก seed เดียว ──
  const stars = useMemo(() => {
    const rnd = mulberry32(20260729);
    return Array.from({ length: 60 }, () => ({
      x: rnd() * 100, y: rnd() * 55, r: 1 + rnd() * 2, ph: rnd() * 6.28,
    }));
  }, []);

  // ── ยุงกี่ตัว: beat ไหนอยู่ในกะไหน ──
  const inShiftBoard = B.shift_board && within(t, B.shift_board[0], B.shift_board[1]);
  const inDay = B.day_shift && within(t, B.day_shift[0], B.day_shift[1]);
  const inNight = B.night_shift && within(t, B.night_shift[0], B.night_shift[1]);

  // ── กล้องซูมตอนเข้าห้องแล็บ ──
  const zoom = B.lab_zoom ? 1 + 0.08 * easeOut(prog(t, B.lab_zoom[0], B.lab_zoom[1])) : 1;

  // ── ยุงหลักลอยอยู่กลางจอ ค่อย ๆ เลื่อนเมื่อเปลี่ยนกะ ──
  const mainX = width * lerp(0.30, 0.52, dayness);

  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${skyTop} 0%, ${skyBot} 100%)` }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "50% 45%" }}>
        {/* ดาว — จางลงเมื่อสว่าง */}
        <svg width={width} height={height} style={{ position: "absolute", opacity: 1 - dayness }}>
          {stars.map((s, i) => (
            <circle key={i} cx={(s.x / 100) * width} cy={(s.y / 100) * height}
              r={s.r} fill="#FFFFFF"
              opacity={0.35 + 0.35 * (Math.sin(frame * 0.06 + s.ph) + 1) / 2} />
          ))}
        </svg>

        {/* ดวงอาทิตย์โผล่ตอนกะกลางวัน */}
        <svg width={width} height={height} style={{ position: "absolute", opacity: dayness }}>
          <circle cx={width * 0.82} cy={lerp(height * 0.42, height * 0.2, dayness)}
            r={64} fill="#FFD86B" />
        </svg>

        {/* พื้น/เตียง */}
        <div style={{
          position: "absolute", bottom: 0, width: "100%", height: "26%",
          background: mix("#1B2140", "#7FB77E", dayness),
        }} />

        {/* ยุงตัวเล่าเรื่อง — ปากขยับตาม cues.mouth */}
        <MouthRig mouth={cues.mouth} x={mainX} y={height * 0.30} scale={1.25} />

        {/* ช่วง "ผลัดกะ" โชว์ยุงสามตัวพร้อมกัน */}
        {inShiftBoard && (
          <>
            <MouthRig mouth={[]} x={width * 0.62} y={height * 0.24} scale={0.7} tint="#5A7A4E" />
            <MouthRig mouth={[]} x={width * 0.74} y={height * 0.40} scale={0.7} tint="#7A5A4E" />
          </>
        )}
        {inDay && <MouthRig mouth={[]} x={width * 0.14} y={height * 0.44} scale={0.8} tint="#5A7A4E" />}
        {inNight && <MouthRig mouth={[]} x={width * 0.72} y={height * 0.42} scale={0.8} tint="#7A5A4E" />}
      </AbsoluteFill>

      {/* ข้อความ — อยู่นอก scale จะได้ไม่เบลอตามกล้อง */}
      <TextLayer lines={cues.lines} fps={fps} />

      {cues.audio ? <Audio src={staticFile(cues.audio)} /> : null}
    </AbsoluteFill>
  );
};

export default Scene;
