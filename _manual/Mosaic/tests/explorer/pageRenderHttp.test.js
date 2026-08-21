import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/testApp.js';

const SEED_SQL = `
  CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL);
  INSERT INTO items (name, price) VALUES ('Cheap', 5), ('Mid', 15), ('Pricey', 50);
`;

const PAGES = {
  demo: {
    'page.json': {
      id: 'demo',
      title: 'Demo page',
      parameters: [{ name: 'MinPrice', label: 'Min price', type: 'decimal', default: 0 }],
      blocks: [
        {
          id: 'items-table',
          title: 'Items',
          sourceId: 'test-sqlite',
          query: 'queries/items.sql',
          presentation: 'table',
          pageSize: 2,
          allowCsvExport: true,
          allowJsonExport: true,
        },
        { id: 'items-count', title: 'Count', sourceId: 'test-sqlite', query: 'queries/count.sql', presentation: 'scalar' },
        { id: 'first-item', title: 'First', sourceId: 'test-sqlite', query: 'queries/first.sql', presentation: 'single-record' },
      ],
    },
    'queries/items.sql': 'SELECT id, name, price FROM items WHERE price >= @MinPrice',
    'queries/count.sql': 'SELECT COUNT(*) AS c FROM items',
    'queries/first.sql': 'SELECT * FROM items ORDER BY id LIMIT 1',
  },
  'required-param': {
    'page.json': {
      id: 'required-param',
      title: 'Requires a param',
      parameters: [{ name: 'Region', label: 'Region', type: 'text', required: true }],
      blocks: [{ id: 'b1', title: 'B1', sourceId: 'test-sqlite', query: 'queries/q.sql', presentation: 'scalar' }],
    },
    'queries/q.sql': 'SELECT @Region AS region',
  },
  broken: {
    'page.json': { id: 'broken', title: 'Broken', blocks: [{ id: 'b1', title: 'B1', sourceId: 'does-not-exist', query: 'q.sql', presentation: 'table' }] },
  },
};

async function withApp(fn) {
  const app = await createTestApp({ seedSql: SEED_SQL, pages: PAGES });
  try {
    await fn(app);
  } finally {
    await app.cleanup();
  }
}

test('pages list shows the valid page and flags the invalid one, without crashing', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages');
    assert.equal(r.status, 200);
    assert.match(r.text, /Demo page/);
    assert.match(r.text, /broken/);
  }));

test('a misconfigured page is isolated (503) without affecting other pages or sources', () =>
  withApp(async ({ request, sourceId }) => {
    const brokenPage = await request('GET', '/pages/broken');
    assert.equal(brokenPage.status, 503);

    const goodPage = await request('GET', '/pages/demo');
    assert.equal(goodPage.status, 200);

    const browse = await request('GET', `/sources/${sourceId}/main/items`);
    assert.equal(browse.status, 200);
  }));

test('an unknown page id is a plain 404', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/does-not-exist');
    assert.equal(r.status, 404);
  }));

test('renders table/scalar/single-record blocks with default parameter values', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/demo');
    assert.equal(r.status, 200);
    assert.match(r.text, /Cheap/);
    assert.match(r.text, />3</); // scalar count of 3 items
    assert.match(r.text, /<dt>name<\/dt><dd[^>]*>Cheap/); // first-item single-record
  }));

test('a page-level parameter filters a block that binds it, while a block that ignores it is unaffected', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/demo?p_MinPrice=20');
    const tableSection = r.text.match(/block-items-table-title">([\s\S]*?)<\/section>/)[1];
    assert.doesNotMatch(tableSection, /Cheap/);
    assert.doesNotMatch(tableSection, /Mid/);
    assert.match(tableSection, /Pricey/);

    // first-item's query never references @MinPrice - per spec, a block may
    // ignore a page-level parameter used by another block.
    assert.match(r.text, /<dt>name<\/dt><dd[^>]*>Cheap/);
  }));

test('table block pagination advances via the Next link params and reports no next page on the last page', () =>
  withApp(async ({ request }) => {
    // Sort explicitly (id asc) so page boundaries are deterministic - table blocks no longer
    // hand-write their own ORDER BY, so without an explicit sort the row order is unspecified.
    const page1 = await request('GET', '/pages/demo?b_items-table_sort=id&b_items-table_dir=asc');
    assert.match(page1.text, /Cheap/);
    assert.match(page1.text, /Mid/);
    assert.doesNotMatch(page1.text, /Pricey/);
    assert.match(page1.text, /Next/);

    const page2 = await request('GET', '/pages/demo?b_items-table_sort=id&b_items-table_dir=asc&b_items-table_page=2');
    assert.match(page2.text, /Pricey/);
    // "Cheap" (price 5) legitimately still appears in the unrelated
    // first-item single-record block regardless of the table's own page -
    // scope the negative assertion to the items-table block's own markup.
    const tableSection = page2.text.match(/block-items-table-title">([\s\S]*?)<\/section>/)[1];
    assert.doesNotMatch(tableSection, /Cheap/);
    assert.doesNotMatch(tableSection, /Next/);
  }));

test('a required missing parameter blocks only the block(s) that reference it, with a clear message, not a hard error', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/required-param');
    assert.equal(r.status, 200);
    assert.match(r.text, /required/i);
    assert.match(r.text, /Waiting for required parameters/);
  }));

test('supplying the required parameter lets the block execute', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/required-param?p_Region=West');
    assert.doesNotMatch(r.text, /Waiting for required parameters/);
    assert.match(r.text, /West/);
  }));

test('a table block renders sortable column headers and a filter form', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/demo');
    const tableSection = r.text.match(/block-items-table-title">([\s\S]*?)<\/section>/)[1];
    assert.match(tableSection, /<a href="[^"]*b_items-table_sort=price[^"]*">price<\/a>/);
    assert.match(tableSection, /<summary>Filters<\/summary>/);
  }));

test('clicking a table block\'s sort link reorders its rows, independent of other blocks/params', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/demo?b_items-table_sort=price&b_items-table_dir=desc');
    const tableSection = r.text.match(/block-items-table-title">([\s\S]*?)<\/section>/)[1];
    const pricey = tableSection.indexOf('Pricey');
    const mid = tableSection.indexOf('Mid');
    assert.ok(pricey !== -1 && mid !== -1 && pricey < mid, 'price desc should put Pricey before Mid');
  }));

test('a table block\'s filter form narrows its own rows without affecting other blocks', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/demo?b_items-table_f_op_name=eq&b_items-table_f_val_name=Mid');
    const tableSection = r.text.match(/block-items-table-title">([\s\S]*?)<\/section>/)[1];
    assert.match(tableSection, /Mid/);
    assert.doesNotMatch(tableSection, /Cheap/);
    assert.doesNotMatch(tableSection, /Pricey/);
    // The unrelated single-record block still sees the full, unfiltered data.
    assert.match(r.text, /<dt>name<\/dt><dd[^>]*>Cheap/);
  }));

test('a table block\'s filter form preserves other query params (page-level params, other blocks) as hidden fields', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/demo?p_MinPrice=10');
    const tableSection = r.text.match(/block-items-table-title">([\s\S]*?)<\/section>/)[1];
    assert.match(tableSection, /<input type="hidden" name="p_MinPrice" value="10">/);
  }));

test('block-level CSV export returns only that block\'s current filtered rows', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/demo?p_MinPrice=10&b_items-table_export=csv');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/csv/);
    assert.match(r.text, /Mid/);
    assert.match(r.text, /Pricey/);
    assert.doesNotMatch(r.text, /Cheap/);
  }));

test('block-level JSON export is rejected (falls through to normal render) when the block does not allow it', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/pages/demo?b_items-count_export=json');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
  }));
