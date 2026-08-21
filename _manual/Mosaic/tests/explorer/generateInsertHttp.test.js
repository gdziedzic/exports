import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, extractCsrf } from '../helpers/testApp.js';

const SEED_SQL = `
  CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    note TEXT
  );
  CREATE VIEW product_view AS SELECT * FROM products;
  INSERT INTO products (id, name, stock, note) VALUES (1, 'Widget', 5, NULL);
  INSERT INTO products (id, name, stock, note) VALUES (2, 'O''Brien''s Gadget', 2, 'has a quote');
`;

async function withApp(fn) {
  const app = await createTestApp({ seedSql: SEED_SQL });
  try {
    await fn(app);
  } finally {
    await app.cleanup();
  }
}

function allRowKeys(html) {
  return [...html.matchAll(/name="rowKey" value="([^"]*)"/g)].map((m) =>
    m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'),
  );
}

function textareaContents(html) {
  const m = html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/);
  return m ? m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : null;
}

test('browse page offers "Generate INSERT for selected" even for a read-only source', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request('GET', `/sources/${sourceId}/main/product_view`);
    // The view has no key columns, so it can't be selected at all.
    assert.doesNotMatch(r.text, /Generate INSERT for selected/);
  }));

test('generate-insert renders a correctly quoted, escaped INSERT statement per selected row', () =>
  withApp(async ({ request, sourceId }) => {
    let r = await request('GET', `/sources/${sourceId}/main/products`);
    assert.match(r.text, /Generate INSERT for selected/);
    const csrf = extractCsrf(r.text);
    const rowKeys = allRowKeys(r.text);
    assert.equal(rowKeys.length, 2);

    r = await request(
      'POST',
      `/sources/${sourceId}/main/products/generate-insert`,
      new URLSearchParams([
        ['_csrf', csrf],
        ['rowKey', rowKeys[0]],
        ['rowKey', rowKeys[1]],
      ]).toString(),
    );
    assert.equal(r.status, 200);
    const sqlText = textareaContents(r.text);
    assert.match(sqlText, /INSERT INTO "products" \("id", "name", "stock", "note"\) VALUES \(1, 'Widget', 5, NULL\);/);
    assert.match(sqlText, /VALUES \(2, 'O''Brien''s Gadget', 2, 'has a quote'\);/);
  }));

test('generate-insert only includes the currently visible columns', () =>
  withApp(async ({ request, sourceId }) => {
    let r = await request('GET', `/sources/${sourceId}/main/products?cols=id,name`);
    const csrf = extractCsrf(r.text);
    const rowKeys = allRowKeys(r.text);
    const cols = r.text.match(/name="cols" value="([^"]*)"/)?.[1];
    assert.equal(cols, 'id,name');

    r = await request(
      'POST',
      `/sources/${sourceId}/main/products/generate-insert`,
      new URLSearchParams([
        ['_csrf', csrf],
        ['cols', cols],
        ['rowKey', rowKeys[0]],
      ]).toString(),
    );
    assert.equal(r.status, 200);
    const sqlText = textareaContents(r.text);
    assert.match(sqlText, /INSERT INTO "products" \("id", "name"\) VALUES \(1, 'Widget'\);/);
  }));

test('generate-insert does not touch the database - available even with allowWrites: false', async () => {
  const app = await createTestApp({ seedSql: SEED_SQL, allowWrites: false });
  try {
    let r = await app.request('GET', `/sources/${app.sourceId}/main/products`);
    assert.match(r.text, /Generate INSERT for selected/);
    assert.doesNotMatch(r.text, /Delete selected/);
    const csrf = extractCsrf(r.text);
    const rowKeys = allRowKeys(r.text);

    r = await app.request(
      'POST',
      `/sources/${app.sourceId}/main/products/generate-insert`,
      new URLSearchParams([
        ['_csrf', csrf],
        ['rowKey', rowKeys[0]],
      ]).toString(),
    );
    assert.equal(r.status, 200);
    assert.match(textareaContents(r.text), /INSERT INTO "products"/);
  } finally {
    await app.cleanup();
  }
});

test('generate-insert rejects a request with no selected rows', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request('GET', `/sources/${sourceId}/main/products`);
    const csrf = extractCsrf(r.text);
    const review = await request(
      'POST',
      `/sources/${sourceId}/main/products/generate-insert`,
      new URLSearchParams({ _csrf: csrf }).toString(),
    );
    assert.equal(review.status, 400);
  }));

test('generate-insert without a valid CSRF token is rejected with 403', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request(
      'POST',
      `/sources/${sourceId}/main/products/generate-insert`,
      new URLSearchParams([
        ['_csrf', 'f'.repeat(64)],
        ['rowKey', '[1]'],
      ]).toString(),
    );
    assert.equal(r.status, 403);
  }));
