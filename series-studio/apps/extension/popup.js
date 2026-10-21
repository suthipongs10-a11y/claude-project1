const $ = (id) => document.getElementById(id);

async function refresh() {
  const st = await chrome.runtime.sendMessage({ type: 'get_status' });
  const box = $('status');
  if (!st) return;
  $('port').value = st.port || 8787;
  const lines = [st.connected ? '🟢 เชื่อมต่อ studio-server แล้ว' : st.paired ? '⚪ ยังไม่เชื่อมต่อ' : '⚪ ยังไม่จับคู่'];
  if (st.active_job) lines.push(`กำลังทำงาน ${st.active_job}${st.step ? ` (${st.step})` : ''}`);
  if (st.last_job) lines.push(`งานล่าสุด: ${st.last_job}`);
  if (st.error) lines.push(`⚠️ ${st.error}`);
  if (st.message && !st.connected) lines.push(st.message);
  box.textContent = lines.join('\n');
  box.className = `status ${st.connected ? 'ok' : st.error ? 'bad' : ''}`;
}

$('pair').addEventListener('click', async () => {
  const token = $('token').value.trim();
  const port = Number($('port').value) || 8787;
  if (!token) {
    $('status').textContent = 'ใส่ token ก่อน (ขอจาก Claude ด้วย dashboard_info)';
    return;
  }
  await chrome.runtime.sendMessage({ type: 'pair', token, port });
  $('token').value = '';
  setTimeout(refresh, 800);
});
$('disconnect').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'disconnect' });
  setTimeout(refresh, 300);
});
refresh();
setInterval(refresh, 2000);
