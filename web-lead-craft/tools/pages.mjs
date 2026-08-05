// Multi-page support (Premium package). A site opts in by having src/pages/;
// without it, build-site.mjs keeps its single-page behaviour.
//
// Pages and articles carry their metadata in comment front matter, so a source
// file stays valid HTML and needs no escaping for Thai text or {{t|…}} tokens:
//
//   <!-- slug: about -->
//   <!-- nav: {{t|เกี่ยวกับเรา|About}} -->
//   <!-- title: {{t|…|…}} -->
//   <!-- desc: {{t|…|…}} -->
//
// Output is flat .html files rather than folder/index.html. That is the one
// layout where the same links work both on a server and from a double-clicked
// file — a directory URL has no index to serve off disk. Articles live one
// level down, so every asset and link is written through {{BASE}}, which the
// build resolves per page depth.
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, parse } from 'node:path';

const FRONT = /^[ \t]*<!--\s*([a-z][\w-]*)\s*:\s*([\s\S]*?)\s*-->[ \t]*$/gm;

/** Split leading comment front matter off a source file. */
export function parseFront(text) {
  const meta = {};
  let end = 0;
  for (const m of text.matchAll(FRONT)) {
    if (m.index > end + 2) break; // front matter is the top block only
    meta[m[1]] = m[2];
    end = m.index + m[0].length;
  }
  return { meta, body: text.slice(end).trim() };
}

const read = f => readFileSync(f, 'utf8');
const listHtml = d => (existsSync(d) ? readdirSync(d).filter(f => f.endsWith('.html')).sort() : []);

export const hasPages = dir => existsSync(join(dir, 'src', 'pages'));

/** Pages in nav order — the filename prefix (10-, 20-…) sets it. */
export function collectPages(dir) {
  const d = join(dir, 'src', 'pages');
  return listHtml(d).map(file => {
    const { meta, body } = parseFront(read(join(d, file)));
    const slug = meta.slug ?? parse(file).name.replace(/^\d+-/, '');
    return {
      file,
      slug,
      out: slug === 'index' ? 'index.html' : `${slug}.html`,
      href: slug === 'index' ? 'index.html' : `${slug}.html`,
      nav: meta.nav ?? null, // pages with no nav: entry stay out of the menu
      title: meta.title ?? '',
      desc: meta.desc ?? '',
      body,
    };
  });
}

/** Articles, newest first. */
export function collectArticles(dir) {
  const d = join(dir, 'src', 'articles');
  return listHtml(d)
    .map(file => {
      const { meta, body } = parseFront(read(join(d, file)));
      const slug = meta.slug ?? parse(file).name.replace(/^\d+-/, '');
      return {
        file,
        slug,
        out: join('articles', `${slug}.html`),
        href: `articles/${slug}.html`,
        date: meta.date ?? '',
        cat: meta.cat ?? '',
        img: meta.img ?? '',
        read: meta.read ?? '',
        title: meta.title ?? '',
        desc: meta.desc ?? '',
        body,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Depth prefix so a page one level down still reaches /img and its siblings. */
export const baseFor = out => (out.includes('/') ? '../' : '');

/** The main menu, with the current page marked for CSS and assistive tech. */
export function renderNav(pages, current, base) {
  return pages
    .filter(p => p.nav)
    .map(p => {
      const here = p.slug === current;
      return `<a href="${base}${p.href}"${here ? ' aria-current="page"' : ''}>${p.nav}</a>`;
    })
    .join('\n      ');
}

/** Article teasers for the blog index and the home page. */
export function renderArticleCards(articles, base, limit) {
  return articles
    .slice(0, limit || articles.length)
    .map(
      a => `<article class="post">
          <a class="post-media" href="${base}${a.href}">
            <img {{img:${a.img}:(max-width:700px) 90vw, 23vw}} width="1536" height="1024" loading="lazy" decoding="async" alt="${a.title}">
          </a>
          <div class="post-body">
            <p class="post-meta"><span class="post-cat">${a.cat}</span><time datetime="${a.date}">${fmtDate(a.date)}</time></p>
            <h3><a class="stretch-link" href="${base}${a.href}">${a.title}</a></h3>
            <p class="post-lede">${a.desc}</p>
            <a class="post-more" href="${base}${a.href}">{{t|อ่านต่อ|Read more}} <span aria-hidden="true">→</span></a>
          </div>
        </article>`
    )
    .join('\n        ');
}

const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A date both languages can read, as a {{t|…}} token the expander handles. */
export function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y) return iso;
  const day = String(d);
  // Thai readers expect the Buddhist year
  return `{{t|${day} ${MONTH_TH[m - 1]} ${y + 543}|${MONTH_EN[m - 1]} ${day}, ${y}}}`;
}

/** Breadcrumb trail, plus the JSON-LD Google reads for the same thing. */
export function renderBreadcrumb(trail, base) {
  if (trail.length === 0) return '';
  const items = trail
    .map((t, i) =>
      i === trail.length - 1
        ? `<li aria-current="page">${t.label}</li>`
        : `<li><a href="${base}${t.href}">${t.label}</a></li>`
    )
    .join('');
  return `<nav class="crumb" aria-label="{{t|เส้นทางหน้า|Breadcrumb}}"><ol>${items}</ol></nav>`;
}
