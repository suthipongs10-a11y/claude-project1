import type { Bible, Series } from '../schemas/index.js';
import { NARRATOR_ID } from '../schemas/bible.js';
import { findForbiddenTerms } from '../presets/forbidden.js';
import { error, makeReport, warning, type Issue, type ValidationReport } from '../util/result.js';

export interface BibleValidationOptions {
  /** Extra forbidden terms for this series (e.g. real actor names the user wants excluded). */
  extraForbidden?: readonly string[];
  /** When true, warn about entities without reference images (pre-G2 check). */
  requireRefs?: boolean;
}

/**
 * Code-only checks on a Series Bible (CLAUDE.md rule 3). Semantic quality is Claude's job;
 * this guards structure, cross-references and forbidden terms.
 */
export function validateBible(bible: Bible, series: Pick<Series, 'product'> | undefined, opts: BibleValidationOptions = {}): ValidationReport {
  const issues: Issue[] = [];

  if (bible.characters.length === 0) issues.push(error('bible.no_characters', 'ต้องมีตัวละครอย่างน้อย 1 ตัว'));
  if (bible.locations.length === 0) issues.push(error('bible.no_locations', 'ต้องมีฉาก (location) อย่างน้อย 1 แห่ง'));

  const dup = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) issues.push(error('bible.duplicate_id', `id "${id}" ซ้ำกันใน ${kind}`, `${kind}/${id}`));
      seen.add(id);
    }
  };
  dup('characters', bible.characters.map((c) => c.id));
  dup('locations', bible.locations.map((l) => l.id));
  dup('props', bible.props.map((p) => p.id));

  // ids must be unique across all entity kinds too (they share the prompt namespace)
  const all = new Map<string, string>();
  for (const [kind, list] of [
    ['characters', bible.characters],
    ['locations', bible.locations],
    ['props', bible.props],
  ] as const) {
    for (const e of list) {
      const prev = all.get(e.id);
      if (prev && prev !== kind) issues.push(error('bible.id_clash', `id "${e.id}" ใช้ทั้งใน ${prev} และ ${kind}`, e.id));
      all.set(e.id, kind);
    }
  }
  if (all.has(NARRATOR_ID.toLowerCase()))
    issues.push(error('bible.reserved_id', `"${NARRATOR_ID}" เป็น id สงวนสำหรับผู้บรรยาย`, NARRATOR_ID));

  // voices must point to known characters (or NARRATOR)
  const charIds = new Set(bible.characters.map((c) => c.id));
  for (const key of Object.keys(bible.voices)) {
    if (key !== NARRATOR_ID && !charIds.has(key))
      issues.push(error('bible.voice_unknown_char', `voices.json อ้างถึงตัวละคร "${key}" ที่ไม่มีใน bible`, `voices/${key}`));
  }

  // product mode: the product prop must exist and be flagged
  if (series?.product) {
    const prop = bible.props.find((p) => p.id === series.product?.prop_id);
    if (!prop) issues.push(error('bible.product_prop_missing', `product.prop_id "${series.product.prop_id}" ไม่มีใน props`, 'product'));
    else if (!prop.is_product) issues.push(warning('bible.product_flag', `prop "${prop.id}" เป็นสินค้า ควรตั้ง is_product = true`, `props/${prop.id}`));
  }

  // forbidden terms in text that reaches prompts
  const check = (text: string, at: string) => {
    for (const hit of findForbiddenTerms(text, opts.extraForbidden ?? [])) {
      issues.push(error('bible.forbidden_term', `พบคำที่ห้ามใช้ "${hit.term}" (…${hit.context}…)`, at));
    }
  };
  for (const c of bible.characters) {
    check(`${c.name}\n${c.look}\n${c.wardrobe_default}\n${Object.values(c.wardrobe_variants).join('\n')}`, `characters/${c.id}`);
    if (opts.requireRefs && c.refs.length === 0) issues.push(warning('bible.no_refs', `ตัวละคร "${c.id}" ยังไม่มีภาพอ้างอิง`, `characters/${c.id}`));
  }
  for (const l of bible.locations) {
    check(`${l.name}\n${l.look ?? ''}`, `locations/${l.id}`);
    if (opts.requireRefs && l.refs.length === 0) issues.push(warning('bible.no_refs', `ฉาก "${l.id}" ยังไม่มีภาพอ้างอิง`, `locations/${l.id}`));
  }
  for (const p of bible.props) {
    check(`${p.name}\n${p.look}`, `props/${p.id}`);
    if (opts.requireRefs && p.refs.length === 0) issues.push(warning('bible.no_refs', `ของ "${p.id}" ยังไม่มีภาพอ้างอิง`, `props/${p.id}`));
  }
  check(bible.story_md, 'story.md');

  return makeReport(issues);
}
