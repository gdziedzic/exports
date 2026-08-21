import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describeColumns, runTableBlockQuery } from '../../../src/providers/sqlite/rawQuery.js';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE "items" (id INTEGER PRIMARY KEY, name TEXT NOT NULL, "unit price" REAL NOT NULL, active INTEGER NOT NULL);
    INSERT INTO "items" (id, name, "unit price", active) VALUES
      (1, 'Cheap', 5, 1),
      (2, 'Mid', 15, 1),
      (3, 'Pricey', 50, 0);
  `);
  return db;
}

const SQL = 'SELECT id, name, "unit price" AS price, active FROM "items"';

test('describeColumns reports column names and a value-inferred logical type per column', () => {
  const db = makeDb();
  const columns = describeColumns(db, SQL, {});
  assert.deepEqual(
    columns,
    [
      { name: 'id', logicalType: 'decimal' },
      { name: 'name', logicalType: 'text' },
      { name: 'price', logicalType: 'decimal' },
      { name: 'active', logicalType: 'decimal' }, // SQLite has no native boolean; stored/sampled as an integer
    ],
  );
});

test('describeColumns still reports column names when the query matches zero rows to sample', () => {
  const db = makeDb();
  const columns = describeColumns(db, 'SELECT id, name FROM "items" WHERE id = -1', {});
  assert.deepEqual(columns.map((c) => c.name), ['id', 'name']);
});

test('runTableBlockQuery with no filters/sort returns all rows, respecting offset/limit', () => {
  const db = makeDb();
  const rows = runTableBlockQuery(db, { sqlText: SQL, innerParams: {}, filters: [], sort: null, offset: 0, limit: 10 });
  assert.equal(rows.length, 3);
});

test('runTableBlockQuery sorts ascending and descending by a validated column, quoted safely (including a column name with a space)', () => {
  const db = makeDb();
  const asc = runTableBlockQuery(db, { sqlText: SQL, innerParams: {}, filters: [], sort: { column: 'price', direction: 'ASC' }, offset: 0, limit: 10 });
  assert.deepEqual(asc.map((r) => r.name), ['Cheap', 'Mid', 'Pricey']);

  const desc = runTableBlockQuery(db, { sqlText: SQL, innerParams: {}, filters: [], sort: { column: 'price', direction: 'DESC' }, offset: 0, limit: 10 });
  assert.deepEqual(desc.map((r) => r.name), ['Pricey', 'Mid', 'Cheap']);
});

test('runTableBlockQuery applies each filter operator correctly', () => {
  const db = makeDb();
  const run = (filters) => runTableBlockQuery(db, { sqlText: SQL, innerParams: {}, filters, sort: { column: 'id', direction: 'ASC' }, offset: 0, limit: 10 });

  assert.deepEqual(run([{ column: 'price', op: 'eq', value: 15 }]).map((r) => r.name), ['Mid']);
  assert.deepEqual(run([{ column: 'price', op: 'ne', value: 15 }]).map((r) => r.name), ['Cheap', 'Pricey']);
  assert.deepEqual(run([{ column: 'price', op: 'gt', value: 5 }]).map((r) => r.name), ['Mid', 'Pricey']);
  assert.deepEqual(run([{ column: 'price', op: 'gte', value: 15 }]).map((r) => r.name), ['Mid', 'Pricey']);
  assert.deepEqual(run([{ column: 'price', op: 'lt', value: 50 }]).map((r) => r.name), ['Cheap', 'Mid']);
  assert.deepEqual(run([{ column: 'price', op: 'lte', value: 15 }]).map((r) => r.name), ['Cheap', 'Mid']);
  assert.deepEqual(run([{ column: 'name', op: 'contains', value: 'i' }]).map((r) => r.name), ['Mid', 'Pricey']);
  assert.deepEqual(run([{ column: 'name', op: 'startswith', value: 'Pri' }]).map((r) => r.name), ['Pricey']);
  assert.deepEqual(run([{ column: 'name', op: 'endswith', value: 'ap' }]).map((r) => r.name), ['Cheap']);
  assert.deepEqual(run([{ column: 'active', op: 'true' }]).map((r) => r.name), ['Cheap', 'Mid']);
  assert.deepEqual(run([{ column: 'active', op: 'false' }]).map((r) => r.name), ['Pricey']);
});

test('runTableBlockQuery combines multiple filters with AND', () => {
  const db = makeDb();
  const rows = runTableBlockQuery(db, {
    sqlText: SQL,
    innerParams: {},
    filters: [{ column: 'active', op: 'true' }, { column: 'price', op: 'gt', value: 5 }],
    sort: { column: 'id', direction: 'ASC' },
    offset: 0,
    limit: 10,
  });
  assert.deepEqual(rows.map((r) => r.name), ['Mid']);
});

test('runTableBlockQuery paginates via offset/limit on top of sort/filter', () => {
  const db = makeDb();
  const state = { sqlText: SQL, innerParams: {}, filters: [], sort: { column: 'price', direction: 'ASC' } };
  const page1 = runTableBlockQuery(db, { ...state, offset: 0, limit: 2 });
  const page2 = runTableBlockQuery(db, { ...state, offset: 2, limit: 2 });
  assert.deepEqual(page1.map((r) => r.name), ['Cheap', 'Mid']);
  assert.deepEqual(page2.map((r) => r.name), ['Pricey']);
});

test('runTableBlockQuery merges the inner query\'s own named parameters with engine-generated ones', () => {
  const db = makeDb();
  const rows = runTableBlockQuery(db, {
    sqlText: 'SELECT id, name, "unit price" AS price FROM "items" WHERE "unit price" >= @MinPrice',
    innerParams: { MinPrice: 10 },
    filters: [{ column: 'price', op: 'lt', value: 50 }],
    sort: { column: 'id', direction: 'ASC' },
    offset: 0,
    limit: 10,
  });
  assert.deepEqual(rows.map((r) => r.name), ['Mid']);
});
