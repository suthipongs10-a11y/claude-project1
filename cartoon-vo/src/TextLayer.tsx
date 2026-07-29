/**
 * TextLayer.tsx — หนึ่ง <Sequence> ต่อบรรทัด คำเด้งตาม word.s ของตัวเอง + ไฮไลต์คำที่กำลังพูด
 *
 * กฎ: ไม่มีเลขเวลาใน component เลย ทุกอย่างมาจาก cues ที่ส่งเข้ามา
 * ตัดบรรทัดที่ขอบ token จาก words[] เท่านั้น — ไทยไม่มีเว้นวรรค ปล่อยเบราว์เซอร์ตัดจะตัดกลางคำ
 */
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { prog, pop, easeOut } from "./timing";
import { THAI_FONT } from "./font";

export type Word = { w: string; s: number; e: number; speak?: boolean; sp?: boolean };
export type Line = { id: string; style: string; s: number; e: number; hold?: number; words: Word[] };

const STYLES: Record<string, { color: string; size: number; top: number }> = {
  calm: { color: "#FFFFFF", size: 60, top: 0.70 },
  alarm: { color: "#FF6A5E", size: 72, top: 0.64 },
  run: { color: "#FFD400", size: 64, top: 0.68 },
  caption: { color: "#8DE0FF", size: 68, top: 0.46 },
};

/** ขอบตัวอักษร 8 ทิศ — ห้ามใช้ -webkit-text-stroke เพราะกินเข้าไปในสระไทย */
const outline = (px: number, c = "#10131A") =>
  [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    .map(([x, y]) => `${x * px}px ${y * px}px 0 ${c}`)
    .join(", ");

const LineView: React.FC<{ line: Line }> = ({ line }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const t = line.s + frame / fps; // เวลาจริงบนไทม์ไลน์รวม (Sequence เริ่มนับ 0 ใหม่)
  const st = STYLES[line.style] ?? STYLES.calm;
  const stroke = Math.max(3, Math.round(st.size / 18));

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: height * st.top, left: "7%", right: "7%" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: 2,
          lineHeight: 1.55, // ต่ำกว่านี้วรรณยุกต์ซ้อนโดนตัดหัว
          fontFamily: THAI_FONT,
          fontWeight: 800,
          fontSize: st.size,
          textShadow: outline(stroke),
        }}
      >
        {line.words.map((w, i) => {
          const shown = t >= w.s;
          const scale = shown ? pop(prog(t, w.s, w.s + 0.22)) : 0.6;
          const alpha = shown ? easeOut(prog(t, w.s, w.s + 0.14)) : 0;
          const speaking = t >= w.s && t < w.e;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                transform: `scale(${scale})`,
                transformOrigin: "center bottom",
                opacity: alpha,
                color: speaking ? "#FFE873" : st.color,
                marginRight: w.sp ? st.size * 0.32 : 0,
              }}
            >
              {w.w}
            </span>
          );
        })}
      </div>
      </div>
    </AbsoluteFill>
  );
};

export const TextLayer: React.FC<{ lines: Line[]; fps: number }> = ({ lines, fps }) => (
  <>
    {lines.map((line) => {
      const from = Math.round(line.s * fps);
      const to = Math.round((line.e + (line.hold ?? 0)) * fps);
      return (
        <Sequence key={line.id} from={from} durationInFrames={Math.max(1, to - from)}>
          <LineView line={line} />
        </Sequence>
      );
    })}
  </>
);

export default TextLayer;
