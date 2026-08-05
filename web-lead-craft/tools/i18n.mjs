// Two languages, one page. `{{t|ไทย|English}}` in the source becomes both
// phrases in the built HTML, and a switch in the page decides which is shown —
// no navigation, so it also works from a double-clicked file with no server.
//
// Three shapes come out, because one mechanism cannot cover all three places a
// phrase appears:
//   text        → <span data-t lang="th">…</span><span data-t lang="en">…</span>
//                 hidden by CSS, so the inactive language never reaches the
//                 accessibility tree
//   attributes  → the default language stays in the attribute; every language
//                 goes into the JSON block for the switch to apply
//   <option>    → markup inside an option is not rendered, so its text is
//                 swapped from the JSON block too
//
// Pipes inside a phrase must be written &#124;.

const TOKEN = /\{\{t\|([^|{}]*)\|([^|{}]*)\}\}/g;
const hasToken = s => { TOKEN.lastIndex = 0; return TOKEN.test(s); };

/** Pick one language's phrases out of a string. */
export function localize(text, code, langs) {
  const index = langs.findIndex(l => l.code === code);
  if (index < 0) throw new Error(`unknown language "${code}"`);
  return text.replace(TOKEN, (_m, ...parts) => parts[index].replaceAll('&#124;', '|'));
}

/** Every token must offer exactly one phrase per configured language. */
export function checkTokens(text, langs, where) {
  const problems = [];
  for (const m of text.matchAll(/\{\{t\|[^{}]*\}\}/g)) {
    if (m[0].split('|').length - 1 !== langs.length) {
      problems.push(`${where}: "${m[0].slice(0, 60)}" needs ${langs.length} phrases`);
    }
  }
  return problems;
}

const phrasesFor = (value, langs) =>
  Object.fromEntries(langs.map(l => [l.code, localize(value, l.code, langs)]));

/**
 * Expand every token in a body for all languages at once.
 * Returns { html, data } where data keys are the indices in data-ti.
 */
export function expandAll(html, langs, defaultCode) {
  const data = {};
  let next = 0;
  const claim = () => next++;

  // 1. Attributes. Walk whole tags so the index can be stamped on the element.
  html = html.replace(/<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (tag, name, attrs) => {
    if (!hasToken(attrs)) return tag;
    const translated = {};
    const rewritten = attrs.replace(/([a-zA-Z][\w:-]*)="([^"]*)"/g, (whole, attr, value) => {
      if (!hasToken(value)) return whole;
      translated[attr] = phrasesFor(value, langs);
      return `${attr}="${translated[attr][defaultCode]}"`;
    });
    if (Object.keys(translated).length === 0) return `<${name}${rewritten}>`;
    const i = claim();
    data[i] = { attr: translated };
    return `<${name}${rewritten} data-ti="${i}">`;
  });

  // 2. <option> text — a browser renders no markup inside one.
  html = html.replace(/<option([^>]*)>([^<]*)<\/option>/g, (whole, attrs, text) => {
    if (!hasToken(text)) return whole;
    const i = claim();
    data[i] = { text: phrasesFor(text, langs) };
    return `<option${attrs} data-ti="${i}">${data[i].text[defaultCode]}</option>`;
  });

  // 3. Everything left is body text: emit one span per language, no whitespace
  //    between them or the hidden one would leave a stray space behind.
  html = html.replace(TOKEN, (_m, ...parts) =>
    langs.map((l, n) => `<span data-t lang="${l.code}">${parts[n].replaceAll('&#124;', '|')}</span>`).join('')
  );

  return { html, data };
}

/** Language-switch buttons, with the active one marked for assistive tech. */
export function switcherFor(langs, defaultCode, className = 'lang') {
  const buttons = langs
    .map(l => `<button type="button" data-set-lang="${l.code}" lang="${l.code}"` +
      `${l.code === defaultCode ? ' aria-current="true"' : ''}>${l.label}</button>`)
    .join('');
  return `<div class="${className}" role="group">${buttons}</div>`;
}
