import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { listTablesAndViews, getTableMetadata } from '../../../src/providers/sqlite/metadata.js';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE);
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      qty INTEGER NOT NULL,
      price REAL NOT NULL,
      total REAL GENERATED ALWAYS AS (qty * price) STORED
    );
    CREATE TABLE composite (a INTEGER, b INTEGER, c TEXT, PRIMARY KEY (a, b));
    CREATE UNIQUE INDEX idx_composite_c ON composite(c);
    CREATE TABLE keyless (x INTEGER, y TEXT);
    CREATE VIEW customer_view AS SELECT * FROM customers;
  `);
  return db;
}

test('listTablesAndViews returns tables and views, excluding sqlite internals', () => {
  const db = makeDb();
  const names = listTablesAndViews(db).map((t) => t.name).sort();
  assert.deepEqual(names, ['composite', 'customer_view', 'customers', 'keyless', 'orders']);
  const view = listTablesAndViews(db).find((t) => t.name === 'customer_view');
  assert.equal(view.kind, 'view');
});

test('getTableMetadata detects a single-column INTEGER PRIMARY KEY as identity', () => {
  const db = makeDb();
  const meta = getTableMetadata('s1', db, 'customers', 'table', 0);
  assert.deepEqual(meta.keyColumns, ['id']);
  const idCol = meta.columns.find((c) => c.name === 'id');
  assert.equal(idCol.isIdentity, true);
  assert.equal(meta.writable, true);
});

test('getTableMetadata detects a generated/computed column as non-writable', () => {
  const db = makeDb();
  const meta = getTableMetadata('s1', db, 'orders', 'table', 0);
  const total = meta.columns.find((c) => c.name === 'total');
  assert.equal(total.isGenerated, true);
  assert.equal(total.writable, false);
  assert.equal(total.generatedKind, 'stored');
});

test('getTableMetadata detects a foreign key', () => {
  const db = makeDb();
  const meta = getTableMetadata('s1', db, 'orders', 'table', 0);
  assert.equal(meta.foreignKeys.length, 1);
  assert.equal(meta.foreignKeys[0].table, 'customers');
  assert.deepEqual(meta.foreignKeys[0].columns, [{ from: 'customer_id', to: 'id' }]);
});

test('getTableMetadata supports composite primary keys in declared order', () => {
  const db = makeDb();
  const meta = getTableMetadata('s1', db, 'composite', 'table', 0);
  assert.deepEqual(meta.keyColumns, ['a', 'b']);
  assert.equal(meta.writable, true);
  const aCol = meta.columns.find((c) => c.name === 'a');
  assert.equal(aCol.isIdentity, false, 'composite keys are never treated as a single auto-identity');
});

test('getTableMetadata reports a unique constraint separate from the primary key', () => {
  const db = makeDb();
  const meta = getTableMetadata('s1', db, 'composite', 'table', 0);
  assert.equal(meta.uniqueConstraints.length, 1);
  assert.deepEqual(meta.uniqueConstraints[0].columns, ['c']);
});

test('getTableMetadata falls back to rowid for a keyless table', () => {
  const db = makeDb();
  const meta = getTableMetadata('s1', db, 'keyless', 'table', 0);
  assert.deepEqual(meta.keyColumns, ['rowid']);
  assert.equal(meta.writable, true);
});

test('getTableMetadata marks a view read-only regardless of an addressable key', () => {
  const db = makeDb();
  const meta = getTableMetadata('s1', db, 'customer_view', 'view', 0);
  assert.equal(meta.writable, false);
  assert.match(meta.readOnlyReason, /read-only/i);
});

test('getTableMetadata caches per source ID and never mixes two sources', () => {
  const dbA = makeDb();
  const dbB = makeDb();
  dbB.exec('ALTER TABLE customers RENAME TO customers_b');
  const metaA = getTableMetadata('source-a', dbA, 'customers', 'table', 60_000);
  // Different source ID with a differently-shaped table of the same original name
  // must not see source A's cached metadata.
  const namesB = listTablesAndViews(dbB).map((t) => t.name);
  assert.ok(!namesB.includes('customers'));
  assert.equal(metaA.name, 'customers');
});

test('getTableMetadata respects ttlMs=0 by never returning stale cached data', () => {
  const db = makeDb();
  const before = getTableMetadata('s2', db, 'customers', 'table', 0);
  db.exec('ALTER TABLE customers ADD COLUMN nickname TEXT');
  const after = getTableMetadata('s2', db, 'customers', 'table', 0);
  assert.equal(before.columns.length, 3);
  assert.equal(after.columns.length, 4);
});
