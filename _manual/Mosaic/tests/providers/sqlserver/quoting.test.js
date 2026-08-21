import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteIdentifier, qualifiedTable, qualifiedColumn } from '../../../src/providers/sqlserver/quoting.js';

test('quoteIdentifier wraps in brackets', () => {
  assert.equal(quoteIdentifier('Orders'), '[Orders]');
});

test('quoteIdentifier doubles an embedded closing bracket', () => {
  assert.equal(quoteIdentifier('weird]name'), '[weird]]name]');
});

test('quoteIdentifier does not need to escape an embedded opening bracket', () => {
  assert.equal(quoteIdentifier('weird[name'), '[weird[name]');
});

test('qualifiedTable quotes schema and table independently', () => {
  assert.equal(qualifiedTable('dbo', 'Orders'), '[dbo].[Orders]');
});

test('qualifiedColumn quotes schema, table, and column independently', () => {
  assert.equal(qualifiedColumn('dbo', 'Orders', 'Total'), '[dbo].[Orders].[Total]');
});
