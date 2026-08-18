#!/usr/bin/env node
// Assemble a printable quotation from quotes/<slug>.json + quotes/_template.html.
//
// A quotation is a document a company's accounting department files, so it has
// to survive being printed, forwarded and read six weeks later. That means A4,
// black text on white, and no external requests — the fonts are inlined the
// same way a site's are, because a PDF made on a machine without Thai webfonts
// is a PDF full of boxes.
//
// Output is quotes/<slug>.html, which is gitignored: it is build output, and
// the JSON beside it is the source of truth. Open it and print to PDF.
//
// Usage: node tools/build-quote.mjs quotes/<slug>.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';

const src = process.argv[2];
if (!src || !existsSync(src)) {
  console.error('usage: build-quote.mjs quotes/<slug>.json');
  process.exit(1);
}
const q = JSON.parse(readFileSync(src, 'utf8'));
const dir = dirname(src);
const tpl = readFileSync(join(dir, '_template.html'), 'utf8');
const fonts = readFileSync(q.fontsFrom ?? 'sites/spm-pest/src/fonts.css', 'utf8');

const baht = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
/** A blank the operator still has to fill shows as a rule, not as empty space —
 *  an invisible blank is how a quotation goes out with no tax ID on it. */
const field = v => (v ? esc(v) : '<span class="blank"></span>');

const rows = q.items.map((it, i) => `
      <tr>
        <td class="n">${i + 1}</td>
        <td><b>${esc(it.name)}</b>${it.note ? `<span>${esc(it.note)}</span>` : ''}</td>
        <td class="c">${esc(it.qty)}</td>
        <td class="r">${it.amount === 0 ? '<i>รวมในราคา</i>' : baht(it.amount)}</td>
      </tr>`).join('');

const total = q.items.reduce((sum, it) => sum + it.amount, 0);
const wht = total * (q.whtPercent ?? 0) / 100;

const list = (arr, cls = '') => `<ul class="${cls}">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
const olist = arr => `<ol>${arr.map(x => `<li>${x.replace(/\*\*(.+?)\*\*/g, (_, b) => `<b>${esc(b)}</b>`).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>')}</li>`).join('')}</ol>`;

const out = tpl
  .replaceAll('{{FONTS}}', fonts)
  .replaceAll('{{DOC_NO}}', esc(q.docNo))
  .replaceAll('{{DATE}}', esc(q.date))
  .replaceAll('{{VALID}}', esc(q.validUntil))
  .replaceAll('{{SUBJECT}}', esc(q.subject))
  .replaceAll('{{SELLER_NAME}}', esc(q.seller.name))
  .replaceAll('{{SELLER_LEGAL}}', field(q.seller.legalName))
  .replaceAll('{{SELLER_TAXID}}', field(q.seller.taxId))
  .replaceAll('{{SELLER_TEL}}', esc(q.seller.tel))
  .replaceAll('{{SELLER_LINE}}', esc(q.seller.line))
  .replaceAll('{{SELLER_EMAIL}}', field(q.seller.email))
  .replaceAll('{{SELLER_SITE}}', esc(q.seller.site))
  .replaceAll('{{BANK}}', field(q.seller.bank))
  .replaceAll('{{BANK_NAME}}', field(q.seller.bankName))
  .replaceAll('{{BANK_NO}}', field(q.seller.bankNo))
  .replaceAll('{{PROMPTPAY}}', field(q.seller.promptpay))
  .replaceAll('{{BUYER_NAME}}', esc(q.buyer.name))
  .replaceAll('{{BUYER_ATTN}}', field(q.buyer.attn))
  .replaceAll('{{BUYER_ADDR}}', field(q.buyer.address))
  .replaceAll('{{BUYER_TEL}}', field(q.buyer.tel))
  .replaceAll('{{ROWS}}', rows)
  .replaceAll('{{TOTAL}}', baht(total))
  .replaceAll('{{TOTAL_WORDS}}', esc(q.totalInWords))
  .replaceAll('{{WHT_PCT}}', String(q.whtPercent ?? 0))
  .replaceAll('{{WHT_AMOUNT}}', baht(wht))
  .replaceAll('{{NET}}', baht(total - wht))
  .replaceAll('{{INCLUDED}}', list(q.included, 'tick'))
  .replaceAll('{{EXCLUDED}}', list(q.excluded, 'cross'))
  .replaceAll('{{NEEDED}}', olist(q.clientProvides))
  .replaceAll('{{WARNING}}', esc(q.warning))
  .replaceAll('{{TERMS}}', olist(q.terms))
  .replaceAll('{{DEMO_LABEL}}', esc(q.demo.label))
  .replaceAll('{{DEMO_URL}}', esc(q.demo.url));

const dest = join(dir, basename(src).replace(/\.json$/, '.html'));
writeFileSync(dest, out);
const blanks = (out.match(/class="blank"/g) ?? []).length;
console.log(`wrote ${dest}  (${Math.round(out.length / 1024)} KB)`);
console.log(`  total ${baht(total)} THB` + (wht ? `  ·  net after ${q.whtPercent}% WHT ${baht(total - wht)}` : ''));
if (blanks) console.log(`  ${blanks} field(s) still blank — fill them in ${basename(src)} before sending`);
console.log('  open it in a browser and print to PDF (A4)');
