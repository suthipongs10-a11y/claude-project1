/**
 * Approximate Thai syllable counter (no dictionary). Good enough for pacing estimates:
 * SPEC §8.3 assumes ~5-6 syllables per second of Thai speech.
 *
 * Model: scan left to right building syllables. A syllable gets its nucleus from a leading
 * vowel (เ แ โ ใ ไ), a vowel sign (ั ิ ี ึ ื ุ ู ะ า ำ), or "อ" acting as the vowel "o" after a
 * bare consonant. Consonants before a nucleus are the onset (one consonant or a known
 * cluster); extra consonants piled in front carry implicit vowels (~2 consonants per
 * syllable, e.g. ถนน = 2). A consonant after the nucleus is the final unless the next
 * character is a vowel sign (then it starts the next syllable).
 */
const LEADING = new Set(['เ', 'แ', 'โ', 'ใ', 'ไ']);
const SIGNS = new Set(['ั', 'ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'ะ', 'า', 'ำ', 'ๅ', 'ฤ', 'ฦ']);
const IGNORE = new Set(['่', '้', '๊', '๋', '็', '์', 'ฺ', '​']);
const CONSONANT = /^[ก-ฮ]$/u;
const CLUSTERS = new Set(['กร', 'กล', 'กว', 'ขร', 'ขล', 'ขว', 'คร', 'คล', 'คว', 'ปร', 'ปล', 'ผล', 'พร', 'พล', 'ตร', 'ทร', 'จร', 'ซร', 'ศร', 'สร', 'หง', 'หญ', 'หน', 'หม', 'หย', 'หร', 'หล', 'หว', 'อย']);

interface Syl {
  onset: string[];
  nucleus: boolean;
  fromLeading: boolean;
  absorbed: string; // vowel signs absorbed into a leading-vowel syllable (เ-ีย, เ-ือ)
  final: boolean;
}

function fresh(): Syl {
  return { onset: [], nucleus: false, fromLeading: false, absorbed: '', final: false };
}

function implicitSyllables(consonants: number): number {
  return consonants <= 0 ? 0 : Math.ceil(consonants / 2);
}

function countThaiRun(run: string): number {
  let count = 0;
  let cur = fresh();
  const close = () => {
    if (cur.nucleus) count += 1;
    else count += implicitSyllables(cur.onset.length);
    cur = fresh();
  };
  const takeOnset = () => {
    // decide which trailing consonants form the onset; the rest carry implicit vowels
    const n = cur.onset.length;
    if (n === 0) return;
    const last2 = cur.onset.slice(-2).join('');
    const onsetLen = n >= 2 && CLUSTERS.has(last2) ? 2 : 1;
    count += implicitSyllables(n - onsetLen);
    cur.onset = cur.onset.slice(-onsetLen);
  };
  const chars = [...run];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] as string;
    const next = chars[i + 1];
    if (IGNORE.has(ch)) continue;
    if (ch === 'ๆ') {
      count += 1;
      continue;
    }
    if (LEADING.has(ch)) {
      if (cur.nucleus || cur.onset.length) close();
      cur.nucleus = true;
      cur.fromLeading = true;
      continue;
    }
    if (SIGNS.has(ch)) {
      if (cur.nucleus && !cur.final) {
        // part of the same syllable (เ-ิ-น, เ-ี-ย, เ-า, แ-ะ, ั-ว handled below)
        cur.absorbed += ch;
        continue;
      }
      if (cur.nucleus && cur.final) close();
      takeOnset();
      cur.nucleus = true;
      continue;
    }
    if (CONSONANT.test(ch)) {
      if (!cur.nucleus) {
        // "อ" as vowel o after a bare consonant: รอ ของ คอย
        if (ch === 'อ' && cur.onset.length > 0 && !(next !== undefined && SIGNS.has(next))) {
          takeOnset();
          cur.nucleus = true;
          continue;
        }
        cur.onset.push(ch);
        continue;
      }
      // syllable already has a nucleus
      if (cur.fromLeading && cur.onset.length === 0) {
        // consonant (or cluster) right after a leading vowel is the onset
        if (next !== undefined && CLUSTERS.has(ch + next)) {
          cur.onset.push(ch, next);
          i++;
        } else cur.onset.push(ch);
        continue;
      }
      // diphthong tails: เ-ีย, เ-ือ, ั-ว, ื-อ are vowels, not finals
      const lastAbs = cur.absorbed.slice(-1);
      if ((ch === 'ย' && lastAbs === 'ี' && cur.fromLeading) || (ch === 'อ' && (lastAbs === 'ื' || (cur.fromLeading && lastAbs === ''))) || (ch === 'ว' && lastAbs === 'ั')) {
        if (!(ch === 'อ' && cur.fromLeading && lastAbs === '' && cur.onset.length === 0)) {
          cur.absorbed += ch;
          continue;
        }
      }
      if (cur.final) {
        close();
        cur.onset.push(ch);
        continue;
      }
      if (next !== undefined && SIGNS.has(next)) {
        // onset of the next syllable
        close();
        cur.onset.push(ch);
        continue;
      }
      if (next !== undefined && CONSONANT.test(next) && CLUSTERS.has(ch + next) && chars[i + 2] !== undefined && SIGNS.has(chars[i + 2] as string)) {
        close();
        cur.onset.push(ch);
        continue;
      }
      cur.final = true;
      continue;
    }
    // anything else (space, punctuation) ends the syllable
    if (cur.nucleus || cur.onset.length) close();
  }
  if (cur.nucleus || cur.onset.length) close();
  return count;
}

function countLatinSyllables(word: string): number {
  const groups = word.toLowerCase().match(/[aeiouy]+/g);
  return groups ? groups.length : 1;
}

/** Count approximate spoken syllables in mixed Thai/Latin/digit text. */
export function countSyllables(text: string): number {
  let total = 0;
  for (const run of text.match(/[฀-๿]+/gu) ?? []) total += countThaiRun(run);
  for (const w of text.match(/[A-Za-z]+/g) ?? []) total += countLatinSyllables(w);
  total += (text.match(/\d/g) ?? []).length;
  return total;
}

/** Estimated speaking time in seconds at `syllablesPerSec` (SPEC: 5-6 for Thai). */
export function estimateSpeechSeconds(text: string, syllablesPerSec: number): number {
  if (syllablesPerSec <= 0) throw new Error('syllablesPerSec ต้องมากกว่า 0');
  return countSyllables(text) / syllablesPerSec;
}
