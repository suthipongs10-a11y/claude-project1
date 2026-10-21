import type { SubtitleCue } from '@series-studio/core';

function ts(sec: number): string {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(r).padStart(3, '0')}`;
}

/** SRT text from cues (already positioned on the final timeline). */
export function toSrt(cues: readonly SubtitleCue[]): string {
  return cues.map((c) => `${c.index}\n${ts(c.start_sec)} --> ${ts(c.end_sec)}\n${c.text}\n`).join('\n');
}

/** Parse an SRT back into (start, end, text) triples; used by tests and the dashboard. */
export function parseSrt(srt: string): Array<{ start_sec: number; end_sec: number; text: string }> {
  const out: Array<{ start_sec: number; end_sec: number; text: string }> = [];
  const toSec = (t: string) => {
    const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(t);
    if (!m) return NaN;
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
  };
  for (const block of srt.trim().split(/\n\s*\n/)) {
    const lines = block.split('\n');
    const timing = lines.find((l) => l.includes('-->'));
    if (!timing) continue;
    const [a, b] = timing.split('-->').map((x) => x.trim());
    out.push({ start_sec: toSec(a ?? ''), end_sec: toSec(b ?? ''), text: lines.slice(lines.indexOf(timing) + 1).join('\n') });
  }
  return out;
}

/**
 * Map a preset subtitle_style name to a libass force_style string. Colours are ASS &HAABBGGRR.
 * Unknown names fall back to white bold with outline at the bottom.
 */
export function assStyle(name: string, font: string, aspect: '9:16' | '16:9', scale = 1): string {
  const base = aspect === '9:16' ? { size: 58, marginV: 260 } : { size: 48, marginV: 90 };
  const size = Math.round(base.size * scale);
  const marginV = Math.round(base.marginV * scale);
  const common = `FontName=${font},FontSize=${size},Alignment=2,MarginV=${marginV},MarginL=60,MarginR=60,Spacing=0`;
  switch (name) {
    case 'yellow_bold_bottom':
      return `${common},Bold=1,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1`;
    case 'white_outline_bottom':
      return `${common},Bold=0,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=0`;
    case 'white_serif_bottom':
      return `${common},Bold=0,Italic=0,PrimaryColour=&H00FFFFFF,OutlineColour=&H00202020,BorderStyle=1,Outline=2,Shadow=1`;
    case 'rounded_bold_bottom':
      return `${common},Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00333333,BorderStyle=1,Outline=4,Shadow=0`;
    case 'speech_bubble_style_bottom':
      return `${common},Bold=1,PrimaryColour=&H00202020,BackColour=&H20FFFFFF,OutlineColour=&H20FFFFFF,BorderStyle=3,Outline=12,Shadow=0`;
    case 'handwritten_black_bottom':
      return `${common},Bold=0,PrimaryColour=&H00000000,BackColour=&H00FFFFFF,OutlineColour=&H00FFFFFF,BorderStyle=3,Outline=10,Shadow=0`;
    case 'white_bold_bottom':
    default:
      return `${common},Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1`;
  }
}
