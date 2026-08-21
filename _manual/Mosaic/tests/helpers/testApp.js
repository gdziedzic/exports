import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';
import { contentPath } from '../../src/config/paths.js';

/**
 * Spins up a real Mosaic app against an isolated, throwaway SQLite database
 * (created under the real data/ directory, since source paths always
 * resolve beneath the content root - never the committed data/reference.db)
 * plus a temp sources.json. Returns { port, sourceId, request(), cleanup() }.
 */
/**
 * Materializes a `{ pageDirName: { 'page.json': obj, 'queries/x.sql': text } }`
 * structure into a real directory tree, for isolated page-engine tests.
 */
function writePagesFixture(pagesDir, pages) {
  for (const [dirName, files] of Object.entries(pages)) {
    for (const [relPath, content] of Object.entries(files)) {
      const filePath = path.join(pagesDir, dirName, relPath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
  }
}

export async function createTestApp({ seedSql, allowWrites = true, extraSources = [], pages } = {}) {
  const dbFileName = `test-${crypto.randomUUID()}.db`;
  const dbPath = contentPath('data', dbFileName);
  const seedDb = new DatabaseSync(dbPath);
  if (seedSql) seedDb.exec(seedSql);
  seedDb.close();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-test-'));
  const sourcesPath = path.join(tmpDir, 'sources.json');
  fs.writeFileSync(
    sourcesPath,
    JSON.stringify({
      sources: [
        {
          id: 'test-sqlite',
          name: 'Test SQLite',
          provider: 'sqlite',
          connectionString: `Data Source=data/${dbFileName}`,
          allowWrites,
        },
        ...extraSources,
      ],
    }),
  );

  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-logs-'));
  const pagesDir = path.join(tmpDir, 'pages');
  fs.mkdirSync(pagesDir, { recursive: true });
  if (pages) writePagesFixture(pagesDir, pages);

  const app = await createApp({
    sourcesOptions: { filePath: sourcesPath, env: {} },
    appSettingsOptions: {
      filePath: path.join(tmpDir, 'appsettings-does-not-exist.json'),
      env: { MOSAIC_LOG_DIRECTORY: logDir },
    },
    pagesOptions: { pagesDir },
    tableActionsOptions: { filePath: path.join(tmpDir, 'table-actions.json') },
  });

  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const port = app.server.address().port;
  const base = `http://127.0.0.1:${port}`;

  let cookie = '';
  async function request(method, requestPath, body) {
    const headers = { Origin: base };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const res = await fetch(base + requestPath, { method, headers, body, redirect: 'manual' });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    return { status: res.status, headers: res.headers, text };
  }

  async function cleanup() {
    await app.shutdown();
    fs.rmSync(dbPath, { force: true });
    fs.rmSync(`${dbPath}-journal`, { force: true });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(logDir, { recursive: true, force: true });
  }

  return { port, base, sourceId: 'test-sqlite', request, cleanup };
}

export function extractCsrf(html) {
  const m = html.match(/name="_csrf" value="([0-9a-f]{64})"/);
  return m ? m[1] : null;
}

export function extractHiddenFields(html, prefix) {
  const out = {};
  const re = new RegExp(`name="(${prefix}[a-zA-Z0-9_]+)" value="([^"]*)"`, 'g');
  for (const m of html.matchAll(re)) {
    out[m[1]] = m[2]
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }
  return out;
}
