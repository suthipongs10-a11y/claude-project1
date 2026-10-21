/**
 * Content script injected into the Flow tab by sw.js (after driver.js). Implements the DOM
 * `page` adapter and executes exactly one job per message, reporting back to the service worker.
 */
(() => {
  if (globalThis.__seriesStudioContentLoaded) return;
  globalThis.__seriesStudioContentLoaded = true;
  const D = globalThis.SeriesStudioDriver;
  const videoIds = new WeakMap();
  let videoSeq = 0;

  const page = {
    root: () => document,
    url: () => location.href,
    now: () => Date.now(),
    random: Math.random,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    href: (el) => el.getAttribute('href') || el.href || '',
    async waitFor(find, ms) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        const el = find(document);
        if (el) return el;
        await page.sleep(250);
      }
      return null;
    },
    async click(el) {
      el.scrollIntoView({ block: 'center' });
      el.focus?.();
      el.click();
    },
    async type(el, text) {
      el.focus();
      if (el.isContentEditable) {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
      } else {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
        setter ? setter.call(el, text) : (el.value = text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    async setFiles(input, files) {
      const dt = new DataTransfer();
      for (const f of files) dt.items.add(f);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    /** Reference images are fetched by the service worker (it holds the 127.0.0.1 host permission). */
    async fetchFile(url) {
      const res = await chrome.runtime.sendMessage({ type: 'fetch_ref', url });
      if (!res || !res.ok) throw new Error(`fetch ref failed: ${res && res.error}`);
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      return new File([bytes], res.name || 'ref.png', { type: res.contentType || 'image/png' });
    },
    // identity + src: a freshly inserted <video> counts as a new result even when the src repeats
    resultSignature: (video) => {
      if (!video) return '';
      let id = videoIds.get(video);
      if (!id) {
        id = ++videoSeq;
        videoIds.set(video, id);
      }
      return `${id}:${video.currentSrc || video.src || ''}`;
    },
    async downloadResult(video) {
      const src = video.currentSrc || video.src;
      const res = await fetch(src);
      if (!res.ok) throw new Error(`cannot fetch result video (${res.status})`);
      const blob = await res.blob();
      return { bytes: new Uint8Array(await blob.arrayBuffer()), contentType: blob.type || 'video/mp4' };
    },
  };

  function toBase64(bytes) {
    let s = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'run_job') return false;
    (async () => {
      const { job, selectors } = msg;
      const report = (step, detail) => chrome.runtime.sendMessage({ type: 'job_progress', job_id: job.id, step, detail, url: location.href }).catch(() => {});
      try {
        const result = await D.runJob(page, job, selectors, report);
        if (result.flow_character_id) {
          sendResponse({ ok: true, flow_character_id: result.flow_character_id });
        } else {
          sendResponse({ ok: true, base64: toBase64(result.bytes), contentType: result.contentType });
        }
      } catch (e) {
        sendResponse({ ok: false, blocked: e && e.name === 'BlockedError', selector: e && e.selector, error: (e && e.message) || String(e), url: location.href });
      }
    })();
    return true;
  });
})();
