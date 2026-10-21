/**
 * Service worker: keeps one WebSocket to studio-server (ws://127.0.0.1:<port>/ws?role=extension),
 * runs exactly one job at a time in a Flow tab, relays progress, uploads results.
 * State lives in chrome.storage (service workers are ephemeral); the WS is re-opened by an alarm.
 */
const VERSION = '0.1.0';
let socket = null; // transient; reconnect logic re-creates it

async function getConfig() {
  const { port = 8787, token = '', enabled = false } = await chrome.storage.local.get(['port', 'token', 'enabled']);
  return { port, token, enabled };
}

async function setStatus(patch) {
  const { status = {} } = await chrome.storage.session.get('status');
  const next = { ...status, ...patch, at: new Date().toISOString() };
  await chrome.storage.session.set({ status: next });
  return next;
}

function send(obj) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(obj));
}

async function connect() {
  const { port, token, enabled } = await getConfig();
  if (!enabled || !token) {
    await setStatus({ connected: false, message: 'ยังไม่ได้จับคู่ (ใส่ token ใน popup)' });
    return;
  }
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  try {
    socket = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}&role=extension`);
  } catch (e) {
    await setStatus({ connected: false, message: `เปิด WebSocket ไม่ได้: ${e.message}` });
    return;
  }
  socket.onopen = async () => {
    const { busy = false } = await chrome.storage.session.get('busy');
    send({ kind: 'ext_hello', version: VERSION, busy });
    await setStatus({ connected: true, message: 'เชื่อมต่อ studio-server แล้ว' });
  };
  socket.onclose = async () => {
    socket = null;
    await setStatus({ connected: false, message: 'หลุดการเชื่อมต่อ จะลองใหม่' });
  };
  socket.onerror = () => {
    try {
      socket && socket.close();
    } catch {
      /* ignore */
    }
  };
  socket.onmessage = async (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg.kind === 'job') await handleJob(msg.job);
    if (msg.kind === 'cancel') await chrome.storage.session.set({ cancel: msg.job_id });
  };
}

async function findFlowTab(selectors) {
  const tabs = await chrome.tabs.query({});
  const hit = tabs.find((t) => t.url && selectors.flow_url_prefixes.some((p) => t.url.startsWith(p)));
  if (hit) return hit;
  const created = await chrome.tabs.create({ url: selectors.flow_home_url, active: false });
  await new Promise((resolve) => {
    const onUpdated = (tabId, info) => {
      if (tabId === created.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }, 30000);
  });
  return created;
}

async function handleJob(job) {
  const { busy = false } = await chrome.storage.session.get('busy');
  if (busy) {
    send({ kind: 'job_status', job_id: job.id, status: 'failed', message: 'extension กำลังทำงานอื่นอยู่ (ทำทีละงาน)' });
    return;
  }
  await chrome.storage.session.set({ busy: true, cancel: null });
  await setStatus({ active_job: job.id, step: 'start', error: null });
  try {
    const selRes = await fetch(job.selectors_url);
    if (!selRes.ok) throw new Error(`โหลด selectors ไม่ได้ (${selRes.status})`);
    const selectors = await selRes.json();
    const tab = await findFlowTab(selectors);
    send({ kind: 'job_status', job_id: job.id, status: 'running', step: 'tab_ready', url: tab.url });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['driver.js', 'content.js'] });
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'run_job', job, selectors });
    if (!res) throw new Error('content script ไม่ตอบกลับ');
    if (!res.ok) {
      if (res.blocked) {
        send({ kind: 'job_status', job_id: job.id, status: 'blocked', selector: res.selector, message: res.error, url: res.url });
        await setStatus({ error: `หยุด: ${res.error}` });
        return;
      }
      throw new Error(res.error);
    }
    if (res.flow_character_id) {
      send({ kind: 'character_created', job_id: job.id, entity_id: job.entity_id, flow_character_id: res.flow_character_id });
    } else {
      send({ kind: 'job_status', job_id: job.id, status: 'running', step: 'upload' });
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const up = await fetch(job.result_url, { method: 'POST', headers: { 'content-type': res.contentType || 'video/mp4' }, body: bytes });
      if (!up.ok) throw new Error(`อัปโหลดผลลัพธ์ไม่สำเร็จ (${up.status}): ${(await up.text()).slice(0, 200)}`);
    }
    await setStatus({ last_job: job.id, error: null });
  } catch (e) {
    send({ kind: 'job_status', job_id: job.id, status: 'failed', message: e.message || String(e) });
    await setStatus({ error: e.message || String(e) });
  } finally {
    await chrome.storage.session.set({ busy: false });
    await setStatus({ active_job: null, step: null });
  }
}

// ---- messages from content script / popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'fetch_ref') {
      try {
        const res = await fetch(msg.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        const name = decodeURIComponent(new URL(msg.url).pathname.split('/').pop() || 'ref.png');
        sendResponse({ ok: true, base64: btoa(s), contentType: res.headers.get('content-type') || 'image/png', name });
      } catch (e) {
        sendResponse({ ok: false, error: e.message || String(e) });
      }
    } else if (msg.type === 'job_progress') {
      send({ kind: 'job_status', job_id: msg.job_id, status: 'running', step: msg.step, message: msg.detail, url: msg.url });
      await setStatus({ step: msg.step });
      sendResponse({ ok: true });
    } else if (msg.type === 'pair') {
      await chrome.storage.local.set({ port: msg.port, token: msg.token, enabled: true });
      if (socket) {
        try {
          socket.close();
        } catch {
          /* ignore */
        }
        socket = null;
      }
      await connect();
      sendResponse({ ok: true });
    } else if (msg.type === 'disconnect') {
      await chrome.storage.local.set({ enabled: false });
      if (socket) socket.close();
      sendResponse({ ok: true });
    } else if (msg.type === 'get_status') {
      const { status = {} } = await chrome.storage.session.get('status');
      const cfg = await getConfig();
      sendResponse({ ...status, port: cfg.port, enabled: cfg.enabled, paired: Boolean(cfg.token), version: VERSION });
    } else {
      sendResponse({ ok: false, error: 'unknown message' });
    }
  })();
  return true;
});

// keep the socket alive / reconnect (alarms survive service worker restarts)
chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'keepalive') return;
  if (socket && socket.readyState === WebSocket.OPEN) send({ kind: 'ping' });
  else await connect();
});
chrome.runtime.onInstalled.addListener(() => void connect());
chrome.runtime.onStartup.addListener(() => void connect());
void connect();
