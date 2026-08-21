import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createTestApp, extractCsrf, extractHiddenFields } from '../helpers/testApp.js';
import { contentPath } from '../../src/config/paths.js';

const SEED_SQL = `
  CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL);
  INSERT INTO items (name, price) VALUES ('Cheap', 5), ('Pricey', 50);
`;

const WAREHOUSE_SEED = `
  CREATE TABLE stock_levels (sku TEXT PRIMARY KEY, quantity INTEGER NOT NULL);
  INSERT INTO stock_levels (sku, quantity) VALUES ('SKU-1', 7), ('SKU-2', 42);
`;

/** Creates an isolated second SQLite database file for a multi-source page test, alongside the primary test-sqlite db that createTestApp manages. */
function createWarehouseSource() {
  const dbFileName = `test-warehouse-${crypto.randomUUID()}.db`;
  const dbPath = contentPath('data', dbFileName);
  const db = new DatabaseSync(dbPath);
  db.exec(WAREHOUSE_SEED);
  db.close();
  return {
    dbPath,
    source: { id: 'warehouse', name: 'Warehouse', provider: 'sqlite', connectionString: `Data Source=data/${dbFileName}`, allowWrites: true },
  };
}

function pagesFixture() {
  return {
    ops: {
      'page.json': {
        id: 'ops',
        title: 'Ops',
        parameters: [{ name: 'MinPrice', label: 'Min price', type: 'decimal', required: false, default: 0 }],
        blocks: [
          { id: 'items-table', title: 'Items', sourceId: 'test-sqlite', query: 'queries/items.sql', presentation: 'table', pageSize: 5 },
          {
            id: 'warehouse-stock',
            title: 'Warehouse stock',
            sourceId: 'warehouse',
            query: 'queries/stock.sql',
            presentation: 'table',
            pageSize: 5,
            writeActions: [
              {
                id: 'restock',
                label: 'Restock',
                query: 'actions/restock.sql',
                confirm: true,
                parameters: [{ name: 'RestockAmount', label: 'Restock amount', type: 'integer', required: true, default: 20 }],
                successMessage: 'Restocked.',
                refreshBlockIds: ['warehouse-stock'],
              },
            ],
          },
        ],
      },
      'queries/items.sql': 'SELECT id, name, price FROM items WHERE price >= @MinPrice',
      'queries/stock.sql': 'SELECT sku, quantity FROM stock_levels',
      'actions/restock.sql': "UPDATE stock_levels SET quantity = quantity + @RestockAmount WHERE sku = 'SKU-1'",
    },
  };
}

async function withApp(fn) {
  const { source: warehouse, dbPath } = createWarehouseSource();
  const app = await createTestApp({ seedSql: SEED_SQL, extraSources: [warehouse], pages: pagesFixture() });
  try {
    await fn(app);
  } finally {
    await app.cleanup();
    const fs = await import('node:fs');
    fs.rmSync(dbPath, { force: true });
    fs.rmSync(`${dbPath}-journal`, { force: true });
  }
}

test('a page renders blocks from two independent sources together', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/ops');
    assert.equal(r.status, 200);
    assert.match(r.text, /Cheap/);
    assert.match(r.text, /Pricey/);
    assert.match(r.text, /SKU-1/);
    assert.match(r.text, /SKU-2/);
  }));

test('the write-action review page pre-fills defaults and carries page params as hidden fields', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/ops/actions/restock?p_MinPrice=10');
    assert.equal(r.status, 200);
    assert.match(r.text, /value="20"/); // RestockAmount default
    const hidden = extractHiddenFields(r.text, 'p_');
    assert.equal(hidden.p_MinPrice, '10');
  }));

test('executing a write action updates the target source, redirects with a flash, and preserves page params', () =>
  withApp(async ({ request }) => {
    const review = await request('GET', '/pages/ops/actions/restock?p_MinPrice=10');
    const csrf = extractCsrf(review.text);

    const body = new URLSearchParams({ _csrf: csrf, p_MinPrice: '10', p_RestockAmount: '5' });
    const exec = await request('POST', '/pages/ops/actions/restock?p_MinPrice=10', body.toString());
    assert.equal(exec.status, 303);
    const location = exec.headers.get('location');
    assert.match(location, /^\/pages\/ops\?/);
    assert.match(location, /p_MinPrice=10/);
    assert.match(location, /flash=action-success/);

    const after = await request('GET', location);
    assert.equal(after.status, 200);
    assert.match(after.text, /Action completed/i);
    // SKU-1 started at 7, +5 = 12
    assert.match(after.text, /12/);
  }));

test('a blank required action parameter is rejected with 400 and never reaches the database (not silently defaulted)', () =>
  withApp(async ({ request }) => {
    const review = await request('GET', '/pages/ops/actions/restock?p_MinPrice=10');
    const csrf = extractCsrf(review.text);

    const body = new URLSearchParams({ _csrf: csrf, p_MinPrice: '10', p_RestockAmount: '' });
    const exec = await request('POST', '/pages/ops/actions/restock?p_MinPrice=10', body.toString());
    assert.equal(exec.status, 400);
    assert.match(exec.text, /required/i);

    // Confirm the DB was not touched (still 7, not 27 which the default would produce).
    const page = await request('GET', '/pages/ops');
    assert.match(page.text, /7</);
    assert.doesNotMatch(page.text, /27/);
  }));

test('executing a write action with a missing/invalid CSRF token is rejected with 403', () =>
  withApp(async ({ request }) => {
    const body = new URLSearchParams({ _csrf: 'a'.repeat(64), p_MinPrice: '10', p_RestockAmount: '5' });
    const exec = await request('POST', '/pages/ops/actions/restock?p_MinPrice=10', body.toString());
    assert.equal(exec.status, 403);
  }));

test('an unknown action id on a real page is a plain 404, not a 403/500', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/ops/actions/does-not-exist');
    assert.equal(r.status, 404);
  }));
