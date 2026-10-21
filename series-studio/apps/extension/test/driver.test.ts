import { describe, expect, it, beforeAll } from 'vitest';

// driver.js is a classic script exposing globalThis.SeriesStudioDriver
let D: any;
beforeAll(async () => {
  await import('../driver.js');
  D = (globalThis as any).SeriesStudioDriver;
});

interface FakeEl {
  sel: string;
  text?: string;
  href?: string;
  src?: string;
  clicked?: number;
  typed?: string;
  files?: unknown[];
}

/** A tiny fake page: elements are matched by exact selector string or :has-text on text. */
function fakePage(elements: FakeEl[], opts: { random?: () => number; afterGenerate?: () => void } = {}) {
  const actions: string[] = [];
  let t = 0;
  for (const e of elements) (e as FakeEl & { textContent: string }).textContent = e.text ?? '';
  const root = {
    querySelector: (sel: string) => elements.find((e) => e.sel === sel) ?? null,
    querySelectorAll: (sel: string) => elements.filter((e) => e.sel === sel || sel === '*'),
  };
  const page = {
    root: () => root,
    url: () => 'https://labs.google/fx/tools/flow/project/1',
    now: () => t,
    random: opts.random ?? (() => 0.5),
    sleep: async (ms: number) => {
      actions.push(`sleep ${ms}`);
      t += ms;
    },
    href: (el: FakeEl) => el.href ?? '',
    waitFor: async (find: (r: typeof root) => FakeEl | null, ms: number) => {
      const el = find(root);
      if (!el) t += ms;
      return el;
    },
    click: async (el: FakeEl) => {
      el.clicked = (el.clicked ?? 0) + 1;
      actions.push(`click ${el.sel}`);
      if (el.sel === 'button.generate') opts.afterGenerate?.();
    },
    type: async (el: FakeEl, text: string) => {
      el.typed = text;
      actions.push(`type ${el.sel}`);
    },
    setFiles: async (el: FakeEl, files: unknown[]) => {
      el.files = files;
      actions.push(`files ${files.length}`);
    },
    fetchFile: async (url: string) => ({ name: url.split('/').pop() }),
    resultSignature: (video: FakeEl | null) => (video ? video.src ?? '' : ''),
    downloadResult: async (video: FakeEl) => {
      actions.push(`download ${video.src}`);
      return { bytes: new Uint8Array([1, 2, 3]), contentType: 'video/mp4' };
    },
  };
  return { page, actions, elements };
}

const selectors = {
  version: 1,
  flow_url_prefixes: ['https://labs.google/fx/tools/flow'],
  flow_home_url: 'https://labs.google/fx/tools/flow',
  wait_sec: 5,
  selectors: {
    prompt_textarea: 'textarea.prompt',
    generate_button: 'button.generate',
    settings_button: 'button.settings',
    aspect_9_16: "button:has-text('9:16')",
    aspect_16_9: "button:has-text('16:9')",
    quality_draft: "button:has-text('Fast')",
    quality_final: "button:has-text('Quality')",
    add_ingredient_button: 'button.add',
    file_input: 'input.file',
    result_video: 'video.result',
    error_banner: 'div.alert',
    characters_tab: 'a.characters',
    character_new_button: 'button.new-char',
    character_name_input: 'input.char-name',
    character_save_button: 'button.save-char',
    character_card_link: 'a.card',
  },
};

const job = {
  id: 'job_1', kind: 'clip', series_id: 's', episode: 1, batch_id: 'b01', prompt: '[STYLE] x', aspect: '9:16', quality: 'draft',
  ref_urls: ['http://127.0.0.1:8787/files/s/a.png?token=t', 'http://127.0.0.1:8787/files/s/b.png?token=t'], flow_character_ids: [],
  timeout_sec: 60, delays_ms: { min: 1000, max: 3000 }, selectors_url: 'http://x/sel', result_url: 'http://x/res',
};

describe('Flow driver', () => {
  it('runs a clip job end to end with human-like random delays and reports steps', async () => {
    const video: FakeEl = { sel: 'video.result', src: '' };
    const f = fakePage(
      [
        { sel: 'textarea.prompt' }, { sel: 'button.generate' }, { sel: 'button.settings' },
        { sel: 'button', text: '9:16' }, { sel: 'button', text: 'Fast' }, { sel: 'button.add' }, { sel: 'input.file' }, video,
      ],
      { random: () => 0.25, afterGenerate: () => (video.src = 'blob:result-1') },
    );
    const steps: string[] = [];
    const res = await D.runJob(f.page, job, selectors, (s: string) => steps.push(s));
    expect(res.contentType).toBe('video/mp4');
    expect(steps).toEqual(['check_page', 'settings', 'attach_refs', 'prompt', 'generate', 'wait_result', 'download']);
    expect(f.elements.find((e) => e.sel === 'textarea.prompt')?.typed).toBe('[STYLE] x');
    expect(f.elements.find((e) => e.sel === 'input.file')?.files?.length).toBe(2);
    expect(f.actions.filter((a) => a.startsWith('click'))).toEqual(['click button.settings', 'click button', 'click button', 'click button.add', 'click button.generate']);
    const sleeps = f.actions.filter((a) => a.startsWith('sleep')).map((a) => Number(a.split(' ')[1]));
    // every pause is inside [min, max]; with random=0.25 -> 1000 + 0.25*2001 = 1500
    expect(sleeps.filter((s) => s !== 1000).every((s) => s >= 1000 && s <= 3000)).toBe(true);
    expect(sleeps).toContain(1500);
  });

  it('stops with BlockedError when a required selector is missing or the page is not Flow', async () => {
    const f = fakePage([{ sel: 'textarea.prompt' }, { sel: 'button.settings' }]); // no 9:16 option
    await expect(D.runJob(f.page, job, selectors)).rejects.toMatchObject({ name: 'BlockedError', selector: 'aspect_9_16' });
    const g = fakePage([]);
    g.page.url = () => 'https://accounts.google.com/signin';
    await expect(D.runJob(g.page, job, selectors)).rejects.toMatchObject({ name: 'BlockedError', selector: 'flow_url_prefixes' });
    const h = fakePage([]);
    await expect(D.runJob(h.page, job, selectors)).rejects.toMatchObject({ name: 'BlockedError', selector: 'prompt_textarea' });
  });

  it('fails (not blocked) when Flow shows an error or never finishes', async () => {
    const f = fakePage([{ sel: 'textarea.prompt' }, { sel: 'button.generate' }, { sel: 'div.alert', text: 'Quota exceeded' }]);
    const noSettings = { ...selectors, selectors: { ...selectors.selectors, settings_button: '' } };
    await expect(D.runJob(f.page, { ...job, ref_urls: [] }, noSettings)).rejects.toThrow(/Flow error: Quota exceeded/);
    const g = fakePage([{ sel: 'textarea.prompt' }, { sel: 'button.generate' }]);
    await expect(D.runJob(g.page, { ...job, ref_urls: [], timeout_sec: 10 }, noSettings)).rejects.toThrow(/did not finish/);
  });

  it('creates a Flow character and extracts its id from the card link', async () => {
    const card: FakeEl = { sel: 'a.card', href: '' };
    const f = fakePage([{ sel: 'a.characters' }, { sel: 'button.new-char' }, { sel: 'input.char-name' }, { sel: 'button.add' }, { sel: 'input.file' }, card]);
    f.page.click = async (el: FakeEl) => {
      f.actions.push(`click ${el.sel}`);
      if (el.sel === 'button.save-char') card.href = 'https://labs.google/fx/tools/flow/characters/abc123XYZ';
    };
    f.elements.push({ sel: 'button.save-char', textContent: '' } as FakeEl);
    const res = await D.runJob(f.page, { ...job, kind: 'character', entity_id: 'mina', ref_urls: ['http://x/a.png'] }, selectors);
    expect(res).toEqual({ flow_character_id: 'abc123XYZ' });
    expect(f.elements.find((e) => e.sel === 'input.char-name')?.typed).toBe('mina');
    expect(D.extractCharacterId('/characters/q-1_2')).toBe('q-1_2');
    expect(D.extractCharacterId('/nothing')).toBeNull();
  });

  it('selector helpers: top-level split, :has-text, rand bounds', () => {
    expect(D.splitTopLevel("a[title='x,y'], b:has-text('c, d'), e")).toEqual(["a[title='x,y']", " b:has-text('c, d')", ' e']);
    for (let i = 0; i < 50; i++) {
      const v = D.rand(100, 200);
      expect(v).toBeGreaterThanOrEqual(100);
      expect(v).toBeLessThanOrEqual(200);
    }
    expect(D.rand(5, 5)).toBe(5);
    expect(D.isFlowPage('https://labs.google/fx/tools/flow/x', selectors)).toBe(true);
    expect(D.isFlowPage('https://example.com', selectors)).toBe(false);
  });
});
