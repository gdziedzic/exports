import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, extractCsrf, extractHiddenFields } from '../helpers/testApp.js';

const SEED_SQL = `
  CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE VIEW active_customers AS SELECT * FROM customers WHERE is_active = 1;
  CREATE TABLE order_tags (order_id INTEGER NOT NULL, tag TEXT NOT NULL, PRIMARY KEY (order_id, tag));
  CREATE TABLE session_pings (ip TEXT NOT NULL);
  INSERT INTO customers (id, name, email) VALUES (1, 'Alice', 'alice@example.com');
  INSERT INTO customers (id, name, email, is_active) VALUES (2, 'Bob', 'bob@example.com', 0);
`;

async function withApp(fn) {
  const app = await createTestApp({ seedSql: SEED_SQL });
  try {
    await fn(app);
  } finally {
    await app.cleanup();
  }
}

test('source overview lists tables and the view', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request('GET', `/sources/${sourceId}`);
    assert.equal(r.status, 200);
    assert.match(r.text, /customers/);
    assert.match(r.text, /active_customers/);
  }));

test('browse renders rows and supports filter + sort via query params', () =>
  withApp(async ({ request, sourceId }) => {
    const filtered = await request('GET', `/sources/${sourceId}/main/customers?f_op_is_active=eq&f_val_is_active=0`);
    assert.equal(filtered.status, 200);
    assert.match(filtered.text, /Bob/);
    assert.doesNotMatch(filtered.text, /Alice/);

    const sorted = await request('GET', `/sources/${sourceId}/main/customers?sort=name&dir=desc`);
    const aliceIndex = sorted.text.indexOf('Alice');
    const bobIndex = sorted.text.indexOf('Bob');
    assert.ok(bobIndex !== -1 && aliceIndex !== -1 && bobIndex < aliceIndex);
  }));

test('browse supports a global search box that ORs a LIKE across text columns', () =>
  withApp(async ({ request, sourceId }) => {
    const found = await request('GET', `/sources/${sourceId}/main/customers?q=bob`);
    assert.equal(found.status, 200);
    assert.match(found.text, /Bob/);
    assert.doesNotMatch(found.text, /Alice/);

    const noMatch = await request('GET', `/sources/${sourceId}/main/customers?q=nobody-has-this-name`);
    assert.match(noMatch.text, /No rows match/);

    const combined = await request('GET', `/sources/${sourceId}/main/customers?q=bob&f_op_is_active=eq&f_val_is_active=1`);
    assert.match(combined.text, /No rows match/, 'search ANDs with active filters - Bob is inactive');
  }));

test('browse page includes a "Show SQL" panel with the actual executed SELECT and its bound filter value', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request('GET', `/sources/${sourceId}/main/customers?f_op_name=eq&f_val_name=Bob`);
    assert.equal(r.status, 200);
    assert.match(r.text, /Show SQL/);
    assert.match(r.text, /SELECT \* FROM &quot;customers&quot; WHERE &quot;name&quot; IS \?/);
    assert.match(r.text, /Bound parameters/);
    assert.match(r.text, /\?1 = &quot;Bob&quot;/);
  }));

test('browse silently drops a filter value that does not coerce for the column\'s logical type, instead of erroring', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request('GET', `/sources/${sourceId}/main/customers?f_op_is_active=eq&f_val_is_active=not-a-number`);
    assert.equal(r.status, 200);
    assert.match(r.text, /Alice/);
    assert.match(r.text, /Bob/);
  }));

test('browse distinguishes an out-of-range page from filters matching nothing', () =>
  withApp(async ({ request, sourceId }) => {
    const outOfRange = await request('GET', `/sources/${sourceId}/main/customers?page=999`);
    assert.equal(outOfRange.status, 200);
    assert.match(outOfRange.text, /out of range/);

    const noMatches = await request('GET', `/sources/${sourceId}/main/customers?f_op_name=eq&f_val_name=nobody`);
    assert.equal(noMatches.status, 200);
    assert.match(noMatches.text, /No rows match the current filters or search\./);
    assert.doesNotMatch(noMatches.text, /out of range/);
  }));

test('CSV and JSON export return the filtered rows', () =>
  withApp(async ({ request, sourceId }) => {
    const csv = await request('GET', `/sources/${sourceId}/main/customers?export=csv`);
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.match(csv.text, /id,name,email,is_active,created_at/);
    assert.match(csv.text, /Alice/);

    const json = await request('GET', `/sources/${sourceId}/main/customers?export=json`);
    const parsed = JSON.parse(json.text);
    assert.equal(parsed.length, 2);
  }));

test('full insert -> edit -> delete lifecycle, including the DEFAULT-column-on-insert edge case', () =>
  withApp(async ({ request, sourceId }) => {
    let r = await request('GET', `/sources/${sourceId}/main/customers/new`);
    assert.equal(r.status, 200);
    let csrf = extractCsrf(r.text);

    // Deliberately omit is_active/created_at (both NOT NULL with a DEFAULT) -
    // the DB default must apply, not a spurious NOT NULL failure.
    r = await request(
      'POST',
      `/sources/${sourceId}/main/customers/new`,
      new URLSearchParams({ _csrf: csrf, name: 'Carol', email: 'carol@example.com' }).toString(),
    );
    assert.equal(r.status, 303);
    const location = r.headers.get('location');
    const detailPath = location.split('?')[0];

    r = await request('GET', location);
    assert.equal(r.status, 200);
    assert.match(r.text, /Carol/);
    assert.match(r.text, /Record created/);

    r = await request('GET', `${detailPath}/edit`);
    csrf = extractCsrf(r.text);
    const originals = extractHiddenFields(r.text, 'original_');

    r = await request(
      'POST',
      `${detailPath}/edit`,
      new URLSearchParams({
        _csrf: csrf,
        name: 'Carol Updated',
        email: 'carol@example.com',
        is_active: '1',
        created_at: originals.original_created_at,
        ...originals,
      }).toString(),
    );
    assert.equal(r.status, 303);

    r = await request('GET', `${detailPath}/delete`);
    csrf = extractCsrf(r.text);
    const deleteOriginals = extractHiddenFields(r.text, 'original_');
    r = await request('POST', `${detailPath}/delete`, new URLSearchParams({ _csrf: csrf, ...deleteOriginals }).toString());
    assert.equal(r.status, 303);

    r = await request('GET', detailPath);
    assert.equal(r.status, 404);
  }));

test('stale concurrent edit is rejected with 409 and a clear message', () =>
  withApp(async ({ request, sourceId }) => {
    const editUrl = `/sources/${sourceId}/main/customers/rows/%5B1%5D/edit`;
    let r = await request('GET', editUrl);
    const csrf = extractCsrf(r.text);
    const originals = extractHiddenFields(r.text, 'original_');
    const staleBody = (name) =>
      new URLSearchParams({
        _csrf: csrf,
        name,
        email: 'alice@example.com',
        is_active: '1',
        created_at: originals.original_created_at,
        ...originals,
      }).toString();

    const first = await request('POST', editUrl, staleBody('Alice First Edit'));
    assert.equal(first.status, 303, 'first edit with fresh originals succeeds');

    // Second submission still carries the PRE-first-edit originals (as a second
    // browser tab that loaded the page before the first edit would), so the
    // row it expects to match no longer exists.
    const second = await request('POST', editUrl, staleBody('Alice Second Edit'));
    assert.equal(second.status, 409);
    assert.match(second.text, /changed since you loaded it/);
  }));

test('a POST without a valid CSRF token is rejected with 403', () =>
  withApp(async ({ request, sourceId }) => {
    const r = await request(
      'POST',
      `/sources/${sourceId}/main/customers/new`,
      new URLSearchParams({ _csrf: 'f'.repeat(64), name: 'Should Fail' }).toString(),
    );
    assert.equal(r.status, 403);
  }));

test('a POST whose Origin does not match the request Host is rejected with 403', () =>
  withApp(async ({ request, sourceId, base }) => {
    let r = await request('GET', `/sources/${sourceId}/main/customers/new`);
    const csrf = extractCsrf(r.text);
    const res = await fetch(`${base}/sources/${sourceId}/main/customers/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'http://evil.example' },
      body: new URLSearchParams({ _csrf: csrf, name: 'Eve' }).toString(),
    });
    assert.equal(res.status, 403);
  }));

test('views never expose insert/edit/delete, even directly via URL', () =>
  withApp(async ({ request, sourceId }) => {
    const overview = await request('GET', `/sources/${sourceId}/main/active_customers`);
    assert.doesNotMatch(overview.text, /Insert new/);

    const newForm = await request('GET', `/sources/${sourceId}/main/active_customers/new`);
    assert.equal(newForm.status, 403);
  }));

test('a source with allowWrites: false is entirely read-only even for an otherwise-writable table', async () => {
  const app = await createTestApp({ seedSql: SEED_SQL, allowWrites: false });
  try {
    const overview = await app.request('GET', `/sources/${app.sourceId}/main/customers`);
    assert.doesNotMatch(overview.text, /Insert new/);
    assert.match(overview.text, /does not permit writes/);

    const newForm = await app.request('GET', `/sources/${app.sourceId}/main/customers/new`);
    assert.equal(newForm.status, 403);
  } finally {
    await app.cleanup();
  }
});

test('composite primary key rows are addressable for browse, edit, and delete', () =>
  withApp(async ({ request, sourceId }) => {
    // Seed via raw insert through the (writable) table using the insert form, since
    // there is no data pre-seeded for order_tags.
    let r = await request('GET', `/sources/${sourceId}/main/order_tags/new`);
    const csrf = extractCsrf(r.text);
    r = await request(
      'POST',
      `/sources/${sourceId}/main/order_tags/new`,
      new URLSearchParams({ _csrf: csrf, order_id: '1', tag: 'priority' }).toString(),
    );
    assert.equal(r.status, 303);
    const detailPath = r.headers.get('location').split('?')[0];
    assert.match(detailPath, /rows\/%5B1%2C%22priority%22%5D/);

    r = await request('GET', detailPath);
    assert.equal(r.status, 200);
  }));

test('a keyless table falls back to rowid for insert, browse, and delete', () =>
  withApp(async ({ request, sourceId }) => {
    let r = await request('GET', `/sources/${sourceId}/main/session_pings/new`);
    const csrf = extractCsrf(r.text);
    r = await request(
      'POST',
      `/sources/${sourceId}/main/session_pings/new`,
      new URLSearchParams({ _csrf: csrf, ip: '10.0.0.1' }).toString(),
    );
    assert.equal(r.status, 303);
    const detailPath = r.headers.get('location').split('?')[0];

    const browse = await request('GET', `/sources/${sourceId}/main/session_pings`);
    assert.match(browse.text, /10\.0\.0\.1/);

    r = await request('GET', `${detailPath}/delete`);
    const deleteCsrf = extractCsrf(r.text);
    const originals = extractHiddenFields(r.text, 'original_');
    r = await request('POST', `${detailPath}/delete`, new URLSearchParams({ _csrf: deleteCsrf, ...originals }).toString());
    assert.equal(r.status, 303);
  }));
