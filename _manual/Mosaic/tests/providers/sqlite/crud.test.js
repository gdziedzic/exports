import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { getTableMetadata } from '../../../src/providers/sqlite/metadata.js';
import {
  queryRows,
  getRowByKey,
  insertRow,
  updateRow,
  deleteRow,
  buildSearchFragment,
  ConcurrencyConflictError,
  RecordNotFoundError,
} from '../../../src/providers/sqlite/crud.js';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE composite (a INTEGER NOT NULL, b TEXT NOT NULL, note TEXT, PRIMARY KEY (a, b));
    CREATE TABLE keyless (x INTEGER, y TEXT);
  `);
  db.prepare('INSERT INTO customers (id, name, email, is_active) VALUES (1, ?, ?, 1)').run('Alice', 'alice@example.com');
  db.prepare('INSERT INTO customers (id, name, email, is_active) VALUES (2, ?, ?, 0)').run('Bob', 'bob@example.com');
  return db;
}

let idCounter = 0;
function meta(db, table, kind = 'table') {
  return getTableMetadata(`test-${++idCounter}`, db, table, kind, 0);
}

test('queryRows applies eq/contains/gte filters with parameterized values', () => {
  const db = makeDb();
  const eq = queryRows(db, 'customers', { filters: [{ column: 'is_active', op: 'eq', value: '1' }], sort: null, offset: 0, limit: 10 });
  assert.equal(eq.total, 1);
  assert.equal(eq.rows[0].name, 'Alice');

  const contains = queryRows(db, 'customers', { filters: [{ column: 'email', op: 'contains', value: 'example' }], sort: null, offset: 0, limit: 10 });
  assert.equal(contains.total, 2);
});

test('queryRows LIKE filters escape %, _, and backslash in user input', () => {
  const db = makeDb();
  db.prepare("INSERT INTO customers (id, name, email) VALUES (3, 'Percent%Name', 'p@example.com')").run();
  const result = queryRows(db, 'customers', { filters: [{ column: 'name', op: 'contains', value: '%' }], sort: null, offset: 0, limit: 10 });
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].name, 'Percent%Name');
});

test('queryRows applies a search term as an OR across the given columns', () => {
  const db = makeDb();
  const result = queryRows(db, 'customers', {
    filters: [],
    sort: null,
    offset: 0,
    limit: 10,
    search: { term: 'bob', columns: ['name', 'email'] },
  });
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].name, 'Bob');
});

test('queryRows ANDs a search term with other active filters', () => {
  const db = makeDb();
  const result = queryRows(db, 'customers', {
    filters: [{ column: 'is_active', op: 'eq', value: 1 }],
    sort: null,
    offset: 0,
    limit: 10,
    search: { term: 'bob', columns: ['name', 'email'] },
  });
  assert.equal(result.total, 0, 'Bob is inactive, so ANDing with is_active=1 excludes him');
});

test('buildSearchFragment escapes LIKE metacharacters in the search term', () => {
  const fragment = buildSearchFragment({ term: '50%', columns: ['name'] });
  assert.equal(fragment.sql, '("name" LIKE ? ESCAPE \'\\\')');
  assert.deepEqual(fragment.params, ['%50\\%%']);
});

test('buildSearchFragment returns null for an empty/missing search', () => {
  assert.equal(buildSearchFragment(null), null);
  assert.equal(buildSearchFragment({ term: '', columns: ['name'] }), null);
  assert.equal(buildSearchFragment({ term: 'x', columns: [] }), null);
});

test('queryRows sorts by an allowlisted column and direction', () => {
  const db = makeDb();
  const desc = queryRows(db, 'customers', { filters: [], sort: { column: 'name', direction: 'DESC' }, offset: 0, limit: 10 });
  assert.deepEqual(desc.rows.map((r) => r.name), ['Bob', 'Alice']);
});

test('queryRows paginates with offset/limit and reports total independent of the page', () => {
  const db = makeDb();
  const page = queryRows(db, 'customers', { filters: [], sort: { column: 'id', direction: 'ASC' }, offset: 1, limit: 1 });
  assert.equal(page.total, 2);
  assert.equal(page.rows.length, 1);
  assert.equal(page.rows[0].name, 'Bob');
});

test('insertRow omits an identity column left unset and auto-assigns it', () => {
  const db = makeDb();
  const metadata = meta(db, 'customers');
  const row = insertRow(db, 'customers', metadata, { name: 'Carol', email: 'carol@example.com' });
  assert.equal(row.name, 'Carol');
  assert.ok(row.id > 2);
});

test('insertRow never writes a generated column even if present in values', () => {
  const db = makeDb();
  db.exec('CREATE TABLE gen_test (id INTEGER PRIMARY KEY, a INTEGER, b INTEGER GENERATED ALWAYS AS (a * 2) STORED)');
  const metadata = meta(db, 'gen_test');
  const row = insertRow(db, 'gen_test', metadata, { a: 5, b: 999 });
  assert.equal(row.b, 10, 'computed from a*2, not the smuggled 999');
});

test('insertRow requires the caller to supply a non-identity composite key', () => {
  const db = makeDb();
  const metadata = meta(db, 'composite');
  const row = insertRow(db, 'composite', metadata, { a: 1, b: 'x', note: 'hi' });
  assert.deepEqual({ a: row.a, b: row.b, note: row.note }, { a: 1, b: 'x', note: 'hi' });
});

test('getRowByKey returns null for a non-existent key', () => {
  const db = makeDb();
  assert.equal(getRowByKey(db, 'customers', ['id'], { id: 999 }), null);
});

test('updateRow succeeds when original values match (optimistic concurrency)', () => {
  const db = makeDb();
  const metadata = meta(db, 'customers');
  const original = getRowByKey(db, 'customers', ['id'], { id: 1 });
  const updated = updateRow(db, 'customers', metadata, { id: 1 }, { name: 'Alice Updated' }, original);
  assert.equal(updated.name, 'Alice Updated');
});

test('updateRow throws ConcurrencyConflictError when a value changed underneath it', () => {
  const db = makeDb();
  const metadata = meta(db, 'customers');
  const original = getRowByKey(db, 'customers', ['id'], { id: 1 });
  db.prepare('UPDATE customers SET name = ? WHERE id = 1').run('Changed Elsewhere');
  assert.throws(() => updateRow(db, 'customers', metadata, { id: 1 }, { name: 'My Edit' }, original), ConcurrencyConflictError);
});

test('updateRow throws RecordNotFoundError when the row was deleted underneath it', () => {
  const db = makeDb();
  const metadata = meta(db, 'customers');
  const original = getRowByKey(db, 'customers', ['id'], { id: 1 });
  db.prepare('DELETE FROM customers WHERE id = 1').run();
  assert.throws(() => updateRow(db, 'customers', metadata, { id: 1 }, { name: 'My Edit' }, original), RecordNotFoundError);
});

test('updateRow never allows writing key columns via the set list', () => {
  const db = makeDb();
  const metadata = meta(db, 'customers');
  const original = getRowByKey(db, 'customers', ['id'], { id: 1 });
  // Even if a caller smuggled "id" into newValues, the key columns are excluded from SET.
  const updated = updateRow(db, 'customers', metadata, { id: 1 }, { id: 999, name: 'Still Alice' }, original);
  assert.equal(updated.id, 1);
  assert.equal(updated.name, 'Still Alice');
});

test('deleteRow succeeds when original values match and fails a stale delete with ConcurrencyConflictError', () => {
  const db = makeDb();
  const metadata = meta(db, 'customers');
  const original = getRowByKey(db, 'customers', ['id'], { id: 2 });
  db.prepare('UPDATE customers SET name = ? WHERE id = 2').run('Changed');
  assert.throws(() => deleteRow(db, 'customers', metadata, { id: 2 }, original), ConcurrencyConflictError);
  assert.ok(getRowByKey(db, 'customers', ['id'], { id: 2 }), 'row must still exist after a rejected concurrent delete');
});

test('deleteRow removes the row when originals match', () => {
  const db = makeDb();
  const metadata = meta(db, 'customers');
  const original = getRowByKey(db, 'customers', ['id'], { id: 2 });
  deleteRow(db, 'customers', metadata, { id: 2 }, original);
  assert.equal(getRowByKey(db, 'customers', ['id'], { id: 2 }), null);
});

test('a rowid-keyed (keyless) table can be inserted, queried, and deleted via rowid', () => {
  const db = makeDb();
  const metadata = meta(db, 'keyless');
  assert.deepEqual(metadata.keyColumns, ['rowid']);

  const inserted = insertRow(db, 'keyless', metadata, { x: 1, y: 'hello' });
  assert.ok(inserted.rowid !== undefined, 'rowid must be selected, not just the declared columns');

  const { rows } = queryRows(db, 'keyless', { filters: [], sort: null, offset: 0, limit: 10, keyColumns: ['rowid'] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rowid, inserted.rowid);

  deleteRow(db, 'keyless', metadata, { rowid: inserted.rowid }, { x: 1, y: 'hello' });
  assert.equal(getRowByKey(db, 'keyless', ['rowid'], { rowid: inserted.rowid }), null);
});
