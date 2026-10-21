import { describe, expect, it } from 'vitest';
import { countSyllables, estimateSpeechSeconds } from '../src/text/thai.js';

describe('Thai syllable counter (approximate)', () => {
  const cases: Array<[string, number, number]> = [
    // text, min, max (tolerance band around the true count)
    ['สวัสดี', 3, 3],
    ['คุณมาทำอะไรที่นี่', 6, 8],
    ['ฉันไม่รู้', 3, 3],
    ['เราจะไปไหนกันดี', 6, 6],
    ['ถนนหนทาง', 4, 5],
    ['มีนาวางแก้ว เงยหน้าช้าๆ', 8, 8],
    ['ประเทศไทย', 3, 4],
    ['OK ค่ะ', 2, 3],
    ['เขาเรียกชื่อเดิมของเธอ', 6, 6],
    ['เรียก', 1, 1], ['เรื่อง', 1, 1], ['ขนมหวาน', 3, 3], ['โรงเรียน', 2, 2], ['อะไร', 2, 2],
  ];
  for (const [text, min, max] of cases) {
    it(`${text} ≈ ${min}-${max}`, () => {
      const n = countSyllables(text);
      expect(n).toBeGreaterThanOrEqual(min);
      expect(n).toBeLessThanOrEqual(max);
    });
  }
  it('estimates speech seconds', () => {
    expect(estimateSpeechSeconds('สวัสดี', 5.5)).toBeCloseTo(3 / 5.5, 5);
    expect(() => estimateSpeechSeconds('x', 0)).toThrow();
  });
});
