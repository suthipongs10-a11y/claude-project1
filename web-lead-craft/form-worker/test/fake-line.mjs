// A stand-in for api.line.me, so the Worker can be exercised end to end
// without a real channel access token and without messaging a real person.
//
// It speaks the one endpoint we use — POST /v2/bot/message/push — and checks
// the same things LINE checks: a bearer token, a `to`, and a messages array.
// Every accepted push is written to a log file the test then reads, which is
// how "the message arrived" gets proved rather than assumed.
//
//   node form-worker/test/fake-line.mjs <port> <log-file>
import { createServer } from 'node:http';
import { appendFileSync, writeFileSync } from 'node:fs';

const port = Number(process.argv[2] ?? 8788);
const logFile = process.argv[3] ?? 'line-log.jsonl';
writeFileSync(logFile, '');

createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    const send = (status, payload) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    if (req.url !== '/v2/bot/message/push' || req.method !== 'POST') {
      return send(404, { message: 'Not found' });
    }
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Bearer ') || auth.length < 12) {
      return send(401, { message: 'Invalid access token' });
    }
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return send(400, { message: 'Invalid JSON' });
    }
    if (!parsed.to || !Array.isArray(parsed.messages) || !parsed.messages.length) {
      return send(400, { message: 'Invalid request body' });
    }
    appendFileSync(logFile, JSON.stringify({ auth, ...parsed }) + '\n');
    send(200, {});
  });
}).listen(port, '127.0.0.1', () => console.log(`fake-line on ${port}`));
