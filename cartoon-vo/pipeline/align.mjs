/**
 * align.mjs — ตัดคำไทยด้วย Intl.Segmenter แล้ว map ตัวอักษร → คำ
 *
 * from/to = index ตัวอักษรของข้อความ "ดิบ"
 * เวลาคำ = character_start_times_seconds[from] → character_end_times_seconds[to-1]
 *
 * ยุบเครื่องหมายวรรคตอนเข้าคำหน้า ("ผึ้ง" + "!!!" → "ผึ้ง!!!")
 * ไม่งั้นขึ้นจอแล้วมีช่องว่างแปลก ๆ
 */

const seg = new Intl.Segmenter("th", { granularity: "word" });

const isSpace = (s) => /^\s+$/u.test(s);

/**
 * ตัดข้อความเป็น token พร้อมช่วง index ตัวอักษรดิบ
 * คืน [{ w, from, to }] — to เป็นแบบ exclusive
 */
export function segmentThai(text) {
  const toks = [];
  for (const s of seg.segment(text)) {
    const from = s.index;
    const to = s.index + s.segment.length;
    if (s.isWordLike) {
      toks.push({ w: s.segment, from, to });
    } else if (!isSpace(s.segment) && toks.length) {
      // เครื่องหมายวรรคตอน — ยุบเข้าคำหน้า
      const prev = toks[toks.length - 1];
      prev.w += s.segment;
      prev.to = to;
    }
    // ช่องว่าง: ข้าม แต่ index ยังเดินต่อเอง
  }
  return toks;
}

/**
 * map token → เวลา จาก alignment ของ ElevenLabs (หรือของโหมด estimate)
 * คืน [{ w, s, e, speak }] — เวลานับจากต้นบรรทัด (ยังไม่เลื่อนเข้าไทม์ไลน์รวม)
 */
export function mapCharsToWords(text, alignment) {
  const chars = alignment.characters || [];
  const cs = alignment.character_start_times_seconds || [];
  const ce = alignment.character_end_times_seconds || [];
  const raw = Array.from(text);
  const toks = segmentThai(text);

  // ปกติ characters ต้องยาวเท่าข้อความดิบ ถ้าโมเดล normalize มาจนไม่เท่า ใช้สัดส่วนแทน
  const scale = chars.length && chars.length !== raw.length ? chars.length / raw.length : 1;
  const at = (i, arr, fallback) => {
    if (!arr.length) return fallback;
    const j = Math.min(arr.length - 1, Math.max(0, Math.round(i * scale)));
    return arr[j];
  };

  const words = [];
  for (const t of toks) {
    let s = at(t.from, cs, 0);
    let e = at(t.to - 1, ce, s + 0.05);
    const prev = words[words.length - 1];
    if (prev && s < prev.e) s = prev.e;   // กันทับคำก่อนหน้า
    if (!(e > s)) e = s + 0.05;           // กันคำที่เวลาชนกันเป๊ะ
    words.push({ w: t.w, s: +s.toFixed(4), e: +e.toFixed(4), speak: true });
  }
  return words;
}

/** เลื่อนเวลาทุกคำไปตามจุดเริ่มบรรทัดบนไทม์ไลน์รวม */
export function shiftWords(words, startAt) {
  return words.map((w) => ({
    ...w,
    s: +(w.s + startAt).toFixed(4),
    e: +(w.e + startAt).toFixed(4),
  }));
}
