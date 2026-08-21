import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp } from '../helpers/testApp.js';

const EXTRA_SOURCES = [
  { id: 'csv-src', name: 'CSV Feed', provider: 'csv', path: 'data/products.csv' },
  { id: 'json-src', name: 'JSON Catalog', provider: 'json', path: 'data/products.json', rootProperty: 'products' },
  { id: 'jsonl-src', name: 'JSONL Events', provider: 'jsonl', path: 'data/events.jsonl' },
  { id: 'xml-src', name: 'XML Catalog', provider: 'xml', path: 'data/catalog.xml', recordPath: 'Catalog/Products/Product' },
];

async function withApp(fn) {
  const app = await createTestApp({ extraSources: EXTRA_SOURCES });
  try {
    await fn(app);
  } finally {
    await app.cleanup();
  }
}

test('browses a CSV source, shows headers and rows, and is marked read-only', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/files/csv-src');
    assert.equal(r.status, 200);
    assert.match(r.text, /read-only/);
    assert.match(r.text, /Trail Runner 200/);
    assert.doesNotMatch(r.text, /Insert new/);
  }));

test('browses a JSON source via rootProperty', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/files/json-src');
    assert.equal(r.status, 200);
    assert.match(r.text, /Desk Lamp/);
  }));

test('browses a JSONL source', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/files/jsonl-src');
    assert.equal(r.status, 200);
    assert.match(r.text, /order\.created/);
  }));

test('browses an XML source with attribute and child-element columns', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/files/xml-src');
    assert.equal(r.status, 200);
    assert.match(r.text, /Bike Helmet/);
  }));

test('free-text search filters across all columns', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/files/csv-src?q=Headlamp');
    assert.match(r.text, /Alpine Headlamp/);
    assert.doesNotMatch(r.text, /Trail Runner/);
  }));

test('per-column filter narrows to matching rows only', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/files/csv-src?f_category=Bags');
    assert.match(r.text, /Summit Pack/);
    assert.doesNotMatch(r.text, /Trail Runner/);
  }));

test('record detail renders a single record by index', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/files/csv-src/records/0');
    assert.equal(r.status, 200);
    assert.match(r.text, /Trail Runner 200/);
  }));

test('an out-of-range record index is a 404', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/files/csv-src/records/9999');
    assert.equal(r.status, 404);
  }));

test('CSV export returns the filtered rows as text/csv', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/files/csv-src?f_category=Bags&export=csv');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/csv/);
    assert.match(r.text, /Summit Pack/);
    assert.doesNotMatch(r.text, /Trail Runner/);
  }));

test('JSON export returns the filtered rows as JSON, and every value is JSON-safe', () =>
  withApp(async ({ request }) => {
    const r = await request('GET', '/files/jsonl-src?export=json');
    const parsed = JSON.parse(r.text);
    assert.equal(parsed.length, 5);
    assert.ok(!('__index' in parsed[0]), 'internal row index must not leak into exports');
  }));

test('a file source has no write routes at all - POST to a record is rejected, not silently accepted', () =>
  withApp(async ({ request }) => {
    const r = await request('POST', '/files/csv-src/records/0', '');
    assert.equal(r.status, 405);
    assert.ok(r.headers.get('allow')?.includes('GET'));
  }));
