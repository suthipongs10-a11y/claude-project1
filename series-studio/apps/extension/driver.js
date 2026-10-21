/**
 * Flow driver: the pure job logic shared by the content script and the tests.
 * A classic script (no imports/exports) so it can be injected with chrome.scripting; it exposes
 * globalThis.SeriesStudioDriver. The `page` adapter abstracts the DOM so the sequencing can be
 * unit-tested with a fake page.
 *
 * Safety rules (CLAUDE.md 9 / SPEC §10): one job at a time, a random human-like delay before
 * every action, and the moment a required selector is missing the driver throws BlockedError —
 * it never guesses.
 */
const SeriesStudioDriver = (() => {
  class BlockedError extends Error {
    constructor(selector, message) {
      super(message || `selector not found: ${selector}`);
      this.name = 'BlockedError';
      this.selector = selector;
    }
  }

  function rand(min, max, random = Math.random) {
    const lo = Math.max(0, Math.min(min, max));
    const hi = Math.max(min, max);
    return Math.floor(lo + random() * (hi - lo + 1));
  }

  /** Resolve a selector list "a, b:has-text('x')" against a root; supports the :has-text('…') pseudo. */
  function resolve(root, selectorList) {
    const parts = splitTopLevel(selectorList);
    for (const part of parts) {
      const m = /^(.*?):has-text\((['"])(.*?)\2\)\s*$/.exec(part.trim());
      try {
        if (m) {
          const base = m[1].trim() || '*';
          const text = m[3].toLowerCase();
          const els = Array.from(root.querySelectorAll(base)).filter((el) => (el.textContent || '').toLowerCase().includes(text));
          if (els.length) return els[0];
        } else {
          const el = root.querySelector(part.trim());
          if (el) return el;
        }
      } catch {
        // invalid selector in config -> treat as not found (reported as blocked, not a crash)
      }
    }
    return null;
  }

  function splitTopLevel(s) {
    const out = [];
    let depth = 0;
    let quote = null;
    let cur = '';
    for (const ch of s) {
      if (quote) {
        cur += ch;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        cur += ch;
        continue;
      }
      if (ch === '(' || ch === '[') depth++;
      if (ch === ')' || ch === ']') depth--;
      if (ch === ',' && depth === 0) {
        out.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }

  function isFlowPage(url, selectors) {
    return (selectors.flow_url_prefixes || []).some((p) => url.startsWith(p));
  }

  /** Extract the character id from a Flow character card link. */
  function extractCharacterId(href) {
    const m = /character[s]?\/([A-Za-z0-9_-]+)/.exec(href || '');
    return m ? m[1] : null;
  }

  async function pause(page, job) {
    const { min, max } = job.delays_ms || { min: 0, max: 0 };
    await page.sleep(rand(min, max, page.random));
  }

  async function need(page, selectors, key, waitMs) {
    const sel = selectors.selectors[key];
    if (!sel) throw new BlockedError(key, `selector "${key}" is not defined in flow-selectors.json`);
    const el = await page.waitFor((root) => resolve(root, sel), waitMs);
    if (!el) throw new BlockedError(key);
    return el;
  }

  async function attachRefs(page, job, selectors, report) {
    if (!job.ref_urls || job.ref_urls.length === 0) return;
    report('attach_refs', `${job.ref_urls.length} refs`);
    const files = [];
    for (const url of job.ref_urls) files.push(await page.fetchFile(url));
    await pause(page, job);
    const addBtn = resolve(page.root(), selectors.selectors.add_ingredient_button || '');
    if (addBtn) await page.click(addBtn);
    const input = await need(page, selectors, 'file_input', selectors.wait_sec * 1000);
    await page.setFiles(input, files);
  }

  async function runClipOrRef(page, job, selectors, report) {
    const waitMs = (selectors.wait_sec || 30) * 1000;
    report('check_page', page.url());
    if (!isFlowPage(page.url(), selectors)) throw new BlockedError('flow_url_prefixes', `not a Flow page: ${page.url()}`);
    await need(page, selectors, 'prompt_textarea', waitMs);

    // settings: aspect + quality (optional selectors: skip silently when the config leaves them empty)
    const aspectKey = job.aspect === '16:9' ? 'aspect_16_9' : 'aspect_9_16';
    const qualityKey = job.quality === 'final' ? 'quality_final' : 'quality_draft';
    if (selectors.selectors.settings_button) {
      await pause(page, job);
      report('settings', `${job.aspect} ${job.quality}`);
      const settings = resolve(page.root(), selectors.selectors.settings_button);
      if (settings) await page.click(settings);
      if (selectors.selectors[aspectKey]) await page.click(await need(page, selectors, aspectKey, waitMs));
      if (selectors.selectors[qualityKey]) await page.click(await need(page, selectors, qualityKey, waitMs));
    }

    await attachRefs(page, job, selectors, report);

    await pause(page, job);
    report('prompt', `${job.prompt.length} chars`);
    const textarea = await need(page, selectors, 'prompt_textarea', waitMs);
    await page.type(textarea, job.prompt);

    const before = page.resultSignature(resolve(page.root(), selectors.selectors.result_video || ''));
    await pause(page, job);
    report('generate');
    await page.click(await need(page, selectors, 'generate_button', waitMs));

    report('wait_result', `${job.timeout_sec}s`);
    const deadline = page.now() + job.timeout_sec * 1000;
    let video = null;
    while (page.now() < deadline) {
      const err = resolve(page.root(), selectors.selectors.error_banner || '');
      if (err && (err.textContent || '').trim()) throw new Error(`Flow error: ${(err.textContent || '').trim().slice(0, 200)}`);
      const candidate = resolve(page.root(), selectors.selectors.result_video || '');
      if (candidate && page.resultSignature(candidate) !== before && page.resultSignature(candidate)) {
        video = candidate;
        break;
      }
      await page.sleep(1000);
    }
    if (!video) throw new Error(`Flow did not finish within ${job.timeout_sec}s`);

    await pause(page, job);
    report('download');
    const result = await page.downloadResult(video, selectors);
    return result; // { bytes, contentType }
  }

  async function runCharacter(page, job, selectors, report) {
    const waitMs = (selectors.wait_sec || 30) * 1000;
    report('check_page', page.url());
    if (!isFlowPage(page.url(), selectors)) throw new BlockedError('flow_url_prefixes', `not a Flow page: ${page.url()}`);
    await pause(page, job);
    await page.click(await need(page, selectors, 'characters_tab', waitMs));
    await pause(page, job);
    await page.click(await need(page, selectors, 'character_new_button', waitMs));
    await pause(page, job);
    const name = await need(page, selectors, 'character_name_input', waitMs);
    await page.type(name, job.entity_id);
    await attachRefs(page, job, selectors, report);
    await pause(page, job);
    report('save_character');
    await page.click(await need(page, selectors, 'character_save_button', waitMs));
    const deadline = page.now() + job.timeout_sec * 1000;
    while (page.now() < deadline) {
      const link = resolve(page.root(), selectors.selectors.character_card_link || '');
      const id = link ? extractCharacterId(page.href(link)) : null;
      if (id) return { flow_character_id: id };
      await page.sleep(1000);
    }
    throw new Error('character card did not appear');
  }

  /**
   * Run one job. `report(step, detail)` is called before each step. Returns
   * { bytes, contentType } for clip/ref jobs or { flow_character_id } for character jobs.
   * Throws BlockedError when the page is unknown (caller must stop and alert, never retry blindly).
   */
  async function runJob(page, job, selectors, report = () => {}) {
    if (job.kind === 'character') return runCharacter(page, job, selectors, report);
    return runClipOrRef(page, job, selectors, report);
  }

  return { runJob, BlockedError, rand, resolve, isFlowPage, extractCharacterId, splitTopLevel };
})();
globalThis.SeriesStudioDriver = SeriesStudioDriver;
