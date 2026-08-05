// Multi-language expansion for the {{t|ไทย|English}} placeholder.
//
// Each language becomes its own real page — dist/index.html and
// dist/en/index.html — rather than one page that hides half its DOM. That
// costs a navigation on switch (prefetched, so it is not felt) and buys
// correct lang/hreflang, attributes that are never in the wrong language,
// and two URLs Google can rank separately. A hidden-DOM toggle gets none of
// that and ships both languages to every visitor.
//
// Source authoring is one string per phrase:
//   <h1>{{t|บ้านสะอาด|A spotless home}}</h1>
//   <img alt="{{t|ทีมงาน|Our team}}">
// Pipes inside a phrase must be written &#124;.

const TOKEN = /\{\{t\|([^|{}]*)\|([^|{}]*)\}\}/g;

/** Replace every {{t|...}} with the chosen language's side. */
export function localize(text, code, langs) {
  const index = langs.findIndex(l => l.code === code);
  if (index < 0) throw new Error(`unknown language "${code}"`);
  return text.replace(TOKEN, (_m, ...parts) => parts[index].replaceAll('&#124;', '|'));
}

/** Every token must offer exactly one phrase per configured language. */
export function checkTokens(text, langs, where) {
  const problems = [];
  // catch a token that opened but never matched the strict pattern above
  for (const m of text.matchAll(/\{\{t\|[^{}]*\}\}/g)) {
    if (m[0].split('|').length - 1 !== langs.length) {
      problems.push(`${where}: "${m[0].slice(0, 60)}" needs ${langs.length} phrases`);
    }
  }
  return problems;
}

/** <link rel="alternate" hreflang> for every language, plus x-default. */
export function hreflangTags(langs, siteUrl, defaultCode) {
  if (!siteUrl) return '';
  const href = l => `${siteUrl}/${l.path ? l.path + '/' : ''}`;
  const tags = langs.map(l => `<link rel="alternate" hreflang="${l.code}" href="${href(l)}">`);
  const fallback = langs.find(l => l.code === defaultCode) ?? langs[0];
  tags.push(`<link rel="alternate" hreflang="x-default" href="${href(fallback)}">`);
  return tags.join('\n');
}

/** Rewrite {{lang:code}} to the URL of that language's page. */
export function applyLangLinks(html, langs) {
  return html.replace(/\{\{lang:([a-z-]+)\}\}/g, (_m, code) => {
    const l = langs.find(x => x.code === code);
    if (!l) throw new Error(`{{lang:${code}}} names no configured language`);
    return `/${l.path ? l.path + '/' : ''}`;
  });
}
