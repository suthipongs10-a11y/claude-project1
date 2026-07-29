/**
 * Root.tsx — calculateMetadata อ่าน cues.json แล้ว set durationInFrames/fps
 * แล้วส่ง cues เข้า Scene เป็น props
 *
 * ความยาวคลิปมาจาก cues.frames เท่านั้น เปลี่ยนพากย์ใหม่ = ความยาวขยับเอง
 */
import React from "react";
import { Composition } from "remotion";
import { Scene, type Cues } from "./Scene";
import cues from "../out/cues.json";

const CUES = cues as unknown as Cues;

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Scene"
    component={Scene as React.FC<Record<string, unknown>>}
    durationInFrames={CUES.frames}
    fps={CUES.fps}
    width={1920}
    height={1080}
    defaultProps={{ cues: CUES } as unknown as Record<string, unknown>}
    calculateMetadata={({ props }) => {
      const c = (props as { cues: Cues }).cues;
      return { durationInFrames: c.frames, fps: c.fps };
    }}
  />
);

export default RemotionRoot;
