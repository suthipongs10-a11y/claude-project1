/**
 * Terms that must never appear in presets or compiled prompts (CLAUDE.md rule 10):
 * real studios, franchises and well-known copyrighted characters. The list is a
 * safety net, not a complete IP database; the human gate (G2) remains the final check.
 * Matching is case-insensitive on word boundaries.
 */
export const FORBIDDEN_TERMS: readonly string[] = [
  // studios / platforms
  'disney',
  'pixar',
  'dreamworks',
  'ghibli',
  'studio ghibli',
  'marvel',
  'dc comics',
  'warner bros',
  'nickelodeon',
  'cartoon network',
  'netflix',
  'toei',
  'madhouse',
  'kyoto animation',
  'mappa',
  'ufotable',
  'laika',
  'aardman',
  'illumination',
  'blue sky studios',
  'sony pictures animation',
  'gmm',
  'gmmtv',
  'one31',
  'ch3',
  'workpoint',
  // franchises / characters
  'mickey mouse',
  'spider-man',
  'spiderman',
  'batman',
  'superman',
  'naruto',
  'one piece',
  'dragon ball',
  'pokemon',
  'pikachu',
  'doraemon',
  'shin-chan',
  'hello kitty',
  'minions',
  'frozen elsa',
  'elsa',
  'shrek',
  'totoro',
  'spirited away',
  'demon slayer',
  'attack on titan',
  'wallace and gromit',
  'peppa pig',
  'spongebob',
];

export interface ForbiddenHit {
  term: string;
  /** Short excerpt around the hit. */
  context: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PATTERNS: ReadonlyArray<{ term: string; re: RegExp }> = FORBIDDEN_TERMS.map((term) => ({
  term,
  re: new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}])`, 'iu'),
}));

/** Return all forbidden terms found in `text` (deterministic order = list order). */
export function findForbiddenTerms(text: string, extra: readonly string[] = []): ForbiddenHit[] {
  const hits: ForbiddenHit[] = [];
  const all = extra.length
    ? [...PATTERNS, ...extra.map((term) => ({ term, re: new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}])`, 'iu') }))]
    : PATTERNS;
  for (const { term, re } of all) {
    const m = re.exec(text);
    if (m) {
      const start = Math.max(0, m.index - 20);
      const end = Math.min(text.length, m.index + m[0].length + 20);
      hits.push({ term, context: text.slice(start, end).replace(/\s+/g, ' ').trim() });
    }
  }
  return hits;
}
