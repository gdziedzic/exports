import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, extractCsrf } from '../helpers/testApp.js';

const SEED_SQL = `
  CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0 UNIQUE
  );
  CREATE VIEW product_view AS SELECT * FROM products;
  INSERT INTO products (id, name, stock) VALUES (1, 'Widget', 5);
  INSERT INTO products (id, name, stock) VALUES (2, 'Gadget', 2);
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

async function createAction(request, sourceId, { label, sql }) {
  let r = await request('GET', `/sources/${sourceId}/main/products/actions/new`);
  const csrf = extractCsrf(r.text);
  r = await request(
    'POST',
    `/sources/${sourceId}/main/products/actions`,
    new URLSearchParams({ _csrf: csrf, label, sql }).toString(),
  );
  return r;
}

test('new-action form and creation require the table to be writable', async () => {
  const app = await createTestApp({ seedSql: SEED_SQL, allowWrites: false });
  try {
    const form = await app.request('GET', `/sources/${app.sourceId}/main/products/actions/new`);
    assert.equal(form.status, 403);

    const create = await createAction(app.request, app.sourceId, { label: 'X', sql: 'SELECT 1' });
    assert.equal(create.status, 403);
  } finally {
    await app.cleanup();
  }
});

test('new-action form is unavailable on a read-only view', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request('GET', `/sources/${sourceId}/main/product_view/actions/new`);
    assert.equal(r.status, 403);
  }));

test('creating an action rejects a blank label or SQL', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await createAction(request, sourceId, { label: '', sql: '' });
    assert.equal(r.status, 400);
    assert.match(r.text, /Label is required/);
    assert.match(r.text, /SQL is required/);
  }));

test('creating an action rejects a reference to a column that does not exist on the table', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await createAction(request, sourceId, { label: 'Bad', sql: 'UPDATE products SET stock = stock + 1 WHERE nope = @nope' });
    assert.equal(r.status, 400);
    assert.match(r.text, /not on this table/);
  }));

test('creating a well-formed action redirects with a flash and the button appears on the browse page', () =>
  withApp(async ({ request, sourceId }) => {
    const create = await createAction(request, sourceId, { label: 'Increment stock', sql: 'UPDATE products SET stock = stock + 1 WHERE id = @id' });
    assert.equal(create.status, 303);
    assert.match(create.headers.get('location'), /flash=action-created/);

    const browse = await request('GET', create.headers.get('location'));
    assert.equal(browse.status, 200);
    assert.match(browse.text, /Custom action created\./);
    assert.match(browse.text, /Increment stock/);
  }));

test('full custom-action flow: create, select rows, review, confirm - runs the SQL once per selected row', () =>
  withApp(async ({ request, sourceId }) => {
    await createAction(request, sourceId, { label: 'Increment stock', sql: 'UPDATE products SET stock = stock + 1 WHERE id = @id' });

    let r = await request('GET', `/sources/${sourceId}/main/products`);
    const actionId = r.text.match(/actions\/([a-f0-9-]+)\/review/)?.[1];
    assert.ok(actionId);
    const csrf = extractCsrf(r.text);
    const rowKeys = allRowKeys(r.text);

    r = await request(
      'POST',
      `/sources/${sourceId}/main/products/actions/${actionId}/review`,
      new URLSearchParams([
        ['_csrf', csrf],
        ['rowKey', rowKeys[0]],
        ['rowKey', rowKeys[1]],
      ]).toString(),
    );
    assert.equal(r.status, 200);
    assert.match(r.text, /Increment stock on 2 products records\?/);
    const reviewCsrf = extractCsrf(r.text);
    const reviewRowKeys = allRowKeys(r.text);

    r = await request(
      'POST',
      `/sources/${sourceId}/main/products/actions/${actionId}/execute`,
      new URLSearchParams([
        ['_csrf', reviewCsrf],
        ['rowKey', reviewRowKeys[0]],
        ['rowKey', reviewRowKeys[1]],
      ]).toString(),
    );
    assert.equal(r.status, 303);
    assert.match(r.headers.get('location'), /flash=action-ran&n=2/);

    r = await request('GET', r.headers.get('location'));
    assert.equal(r.status, 200);
    assert.match(r.text, /Action ran on 2 records\./);
    // Widget 5 -> 6, Gadget 2 -> 3
    assert.match(r.text, />6</);
    assert.match(r.text, />3</);
  }));

test('action execute without a valid CSRF token is rejected with 403', () =>
  withApp(async ({ request, sourceId }) => {
    await createAction(request, sourceId, { label: 'Increment stock', sql: 'UPDATE products SET stock = stock + 1 WHERE id = @id' });
    const r = await request('GET', `/sources/${sourceId}/main/products`);
    const actionId = r.text.match(/actions\/([a-f0-9-]+)\/review/)?.[1];

    const noCsrf = await request(
      'POST',
      `/sources/${sourceId}/main/products/actions/${actionId}/execute`,
      new URLSearchParams([
        ['_csrf', 'f'.repeat(64)],
        ['rowKey', '[1]'],
      ]).toString(),
    );
    assert.equal(noCsrf.status, 403);
  }));

test('reviewing or executing an unknown action id returns 404', () =>
  withApp(async ({ request, sourceId }) => {
    const review = await request(
      'POST',
      `/sources/${sourceId}/main/products/actions/does-not-exist/review`,
      new URLSearchParams([['rowKey', '[1]']]).toString(),
    );
    assert.equal(review.status, 404);
  }));

test('deleting an action removes its button from the browse page', () =>
  withApp(async ({ request, sourceId }) => {
    await createAction(request, sourceId, { label: 'Increment stock', sql: 'UPDATE products SET stock = stock + 1 WHERE id = @id' });

    let r = await request('GET', `/sources/${sourceId}/main/products/actions/new`);
    const actionId = r.text.match(/actions\/([a-f0-9-]+)\/delete/)?.[1];
    assert.ok(actionId);
    const csrf = extractCsrf(r.text);

    r = await request(
      'POST',
      `/sources/${sourceId}/main/products/actions/${actionId}/delete`,
      new URLSearchParams({ _csrf: csrf }).toString(),
    );
    assert.equal(r.status, 303);
    assert.match(r.headers.get('location'), /flash=action-deleted/);

    r = await request('GET', r.headers.get('location'));
    assert.doesNotMatch(r.text, /Increment stock/);
  }));

test('an action that fails for one row does not abort the rest of the batch', () =>
  withApp(async ({ request, sourceId }) => {
    // stock has a UNIQUE constraint: setting both selected rows to the same value succeeds for
    // whichever row is processed first and fails with a constraint violation for the second.
    await createAction(request, sourceId, { label: 'Risky', sql: 'UPDATE products SET stock = 100 WHERE id = @id' });

    let r = await request('GET', `/sources/${sourceId}/main/products`);
    const actionId = r.text.match(/actions\/([a-f0-9-]+)\/review/)?.[1];
    const csrf = extractCsrf(r.text);
    const rowKeys = allRowKeys(r.text);

    r = await request(
      'POST',
      `/sources/${sourceId}/main/products/actions/${actionId}/review`,
      new URLSearchParams([
        ['_csrf', csrf],
        ['rowKey', rowKeys[0]],
        ['rowKey', rowKeys[1]],
      ]).toString(),
    );
    const reviewCsrf = extractCsrf(r.text);
    const reviewRowKeys = allRowKeys(r.text);

    r = await request(
      'POST',
      `/sources/${sourceId}/main/products/actions/${actionId}/execute`,
      new URLSearchParams([
        ['_csrf', reviewCsrf],
        ['rowKey', reviewRowKeys[0]],
        ['rowKey', reviewRowKeys[1]],
      ]).toString(),
    );
    assert.equal(r.status, 303);
    assert.match(r.headers.get('location'), /flash=action-ran&n=1&failed=1/);
  }));
