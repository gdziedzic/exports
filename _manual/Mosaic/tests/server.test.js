import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server.js';

function get(port, requestPath, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: requestPath, method: options.method ?? 'GET' },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

test('server end-to-end: health, home, static assets, 404, 405', async () => {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-logs-'));
  const savedLogDirectory = process.env.MOSAIC_LOG_DIRECTORY;
  process.env.MOSAIC_LOG_DIRECTORY = logDir;

  const app = await createApp();
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const port = app.server.address().port;

  try {
    const live = await get(port, '/health/live');
    assert.equal(live.status, 200);
    assert.deepEqual(JSON.parse(live.body), { status: 'live' });

    const ready = await get(port, '/health/ready');
    assert.equal(ready.status, 200);
    assert.equal(JSON.parse(ready.body).ready, true);

    const home = await get(port, '/');
    assert.equal(home.status, 200);
    assert.match(home.headers['content-type'], /text\/html/);
    assert.match(home.body, /Sources/);
    assert.match(home.body, /local-reference|Local reference data/);

    const asset = await get(port, '/assets/style.css');
    assert.equal(asset.status, 200);
    assert.match(asset.headers['content-type'], /text\/css/);

    const missingAsset = await get(port, '/assets/does-not-exist.css');
    assert.equal(missingAsset.status, 404);

    const traversal = await get(port, '/assets/..%2f..%2fsrc%2Frender%2Fescape.css');
    assert.equal(traversal.status, 404);

    const notFound = await get(port, '/this/route/does/not/exist');
    assert.equal(notFound.status, 404);

    const methodNotAllowed = await get(port, '/health/live', { method: 'DELETE' });
    assert.equal(methodNotAllowed.status, 405);
    assert.ok(methodNotAllowed.headers.allow.includes('GET'));

    // every response carries a request id and the mandatory security headers
    assert.ok(home.headers['x-request-id']);
    assert.equal(home.headers['x-content-type-options'], 'nosniff');
    assert.equal(home.headers['x-frame-options'], 'DENY');
    assert.ok(home.headers['content-security-policy'].includes("default-src 'self'"));
  } finally {
    await app.shutdown();
    process.env.MOSAIC_LOG_DIRECTORY = savedLogDirectory;
    fs.rmSync(logDir, { recursive: true, force: true });
  }
});
