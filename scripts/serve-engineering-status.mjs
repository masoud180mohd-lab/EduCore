/**
 * Serves the engineering status HTML without Nest (Nest+tsx DI metadata issue).
 * Platform demo only — not product UI.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = path.join(root, 'apps/api/src/common/health/engineering-status.page.ts');

const raw = readFileSync(pagePath, 'utf8');
const match = raw.match(/export const ENGINEERING_STATUS_HTML = `([\s\S]*?)`;\s*$/m);
if (match === null || match[1] === undefined) {
  throw new Error('Could not extract ENGINEERING_STATUS_HTML');
}
const html = match[1];

const port = Number(process.env.PORT ?? 3000);

createServer((req, res) => {
  const url = req.url?.split('?')[0] ?? '/';

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', service: 'educore-api', mode: 'status-demo' }));
    return;
  }

  if (url === '/ready') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        status: 'ready',
        checks: { configuration: 'ok', note: 'engineering-status demo server' },
      }),
    );
    return;
  }

  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }));
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`EduCore engineering status → http://127.0.0.1:${port}/\n`);
});
