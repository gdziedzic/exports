import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, extractCsrf } from '../helpers/testApp.js';

const SEED_SQL = `
  CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  );
  CREATE VIEW active_customers AS SELECT * FROM customers;
  INSERT INTO customers (id, name, email) VALUES (1, 'Alice', 'alice@example.com');
  INSERT INTO customers (id, name, email) VALUES (2, 'Bob', 'bob@example.com');
  INSERT INTO customers (id, name, email) VALUES (3, 'Carol', 'carol@example.com');
`;

async function withApp(fn) {
  const app = await createTestApp({ seedSql: SEED_SQL });
  try {
    await fn(app);
  } finally {
    await app.cleanup();
  }
}

/** Unlike extractHiddenFields, keeps every repeated `name="rowKey"` value rather than collapsing to one. */
function extractAllRowKeys(html) {
  return [...html.matchAll(/name="rowKey" value="([^"]*)"/g)].map((m) =>
    m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'),
  );
}

test('browse page renders a row checkbox and select-all control for a writable table', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request('GET', `/sources/${sourceId}/main/customers`);
    assert.equal(r.status, 200);
    assert.match(r.text, /data-select-all-rows/);
    assert.match(r.text, /name="rowKey" value="\[1\]"/);
    assert.match(r.text, /Delete selected/);
  }));

test('browse page omits bulk-delete controls for a read-only view', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request('GET', `/sources/${sourceId}/main/active_customers`);
    assert.equal(r.status, 200);
    assert.doesNotMatch(r.text, /data-select-all-rows/);
    assert.doesNotMatch(r.text, /Delete selected/);
  }));

test('full bulk-delete flow: select two rows, review, confirm, both gone', () =>
  withApp(async ({ request, sourceId }) => {
    let r = await request('GET', `/sources/${sourceId}/main/customers`);
    const csrf = extractCsrf(r.text);
    const rowKeys = extractAllRowKeys(r.text);
    assert.equal(rowKeys.length, 3);

    r = await request(
      'POST',
      `/sources/${sourceId}/main/customers/bulk-delete/review`,
      new URLSearchParams([
        ['_csrf', csrf],
        ['rowKey', rowKeys[0]],
        ['rowKey', rowKeys[1]],
      ]).toString(),
    );
    assert.equal(r.status, 200);
    assert.match(r.text, /Delete 2 customers records\?/);
    // The review table shows key-column values only (same as the single-row
    // delete confirm), not the full row.
    assert.match(r.text, /<td class="">1<\/td>/);
    assert.match(r.text, /<td class="">2<\/td>/);

    const reviewCsrf = extractCsrf(r.text);
    const reviewRowKeys = extractAllRowKeys(r.text);
    assert.equal(reviewRowKeys.length, 2);

    r = await request(
      'POST',
      `/sources/${sourceId}/main/customers/bulk-delete`,
      new URLSearchParams([
        ['_csrf', reviewCsrf],
        ['rowKey', reviewRowKeys[0]],
        ['rowKey', reviewRowKeys[1]],
      ]).toString(),
    );
    assert.equal(r.status, 303);
    const location = r.headers.get('location');
    assert.match(location, /flash=bulk-deleted&n=2/);

    r = await request('GET', location);
    assert.equal(r.status, 200);
    assert.match(r.text, /Deleted 2 records\./);
    assert.doesNotMatch(r.text, /Alice/);
    assert.doesNotMatch(r.text, /Bob/);
    assert.match(r.text, /Carol/);
  }));

test('review step drops a stale row key (already deleted) rather than failing the batch', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request('GET', `/sources/${sourceId}/main/customers`);
    const csrf = extractCsrf(r.text);

    const review = await request(
      'POST',
      `/sources/${sourceId}/main/customers/bulk-delete/review`,
      new URLSearchParams([
        ['_csrf', csrf],
        ['rowKey', '[1]'],
        ['rowKey', '[999]'],
      ]).toString(),
    );
    assert.equal(review.status, 200);
    assert.match(review.text, /Delete 1 customers record\?/);
  }));

test('selecting zero rows on review is rejected with 400', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request('GET', `/sources/${sourceId}/main/customers`);
    const csrf = extractCsrf(r.text);
    const review = await request(
      'POST',
      `/sources/${sourceId}/main/customers/bulk-delete/review`,
      new URLSearchParams({ _csrf: csrf }).toString(),
    );
    assert.equal(review.status, 400);
  }));

test('bulk-delete execute without a valid CSRF token is rejected with 403', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request(
      'POST',
      `/sources/${sourceId}/main/customers/bulk-delete`,
      new URLSearchParams([
        ['_csrf', 'f'.repeat(64)],
        ['rowKey', '[1]'],
      ]).toString(),
    );
    assert.equal(r.status, 403);
  }));

test('bulk-delete is rejected with 403 on a read-only view, even with a valid CSRF token', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request('GET', `/sources/${sourceId}/main/active_customers`);
    const csrf = extractCsrf(r.text);
    const review = await request(
      'POST',
      `/sources/${sourceId}/main/active_customers/bulk-delete/review`,
      new URLSearchParams([
        ['_csrf', csrf],
        ['rowKey', '[1]'],
      ]).toString(),
    );
    assert.equal(review.status, 403);
  }));

test('a source with allowWrites: false rejects bulk-delete even for an otherwise-writable table', async () => {
  const app = await createTestApp({ seedSql: SEED_SQL, allowWrites: false });
  try {
    const r = await app.request('GET', `/sources/${app.sourceId}/main/customers`);
    const csrf = extractCsrf(r.text) ?? 'f'.repeat(64);
    const review = await app.request(
      'POST',
      `/sources/${app.sourceId}/main/customers/bulk-delete/review`,
      new URLSearchParams([
        ['_csrf', csrf],
        ['rowKey', '[1]'],
      ]).toString(),
    );
    assert.equal(review.status, 403);
  } finally {
    await app.cleanup();
  }
});
