import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteIdentifier, qualifiedColumn } from '../../../src/providers/sqlite/quoting.js';

test('quoteIdentifier wraps in double quotes', () => {
  assert.equal(quoteIdentifier('orders'), '"orders"');
});

test('quoteIdentifier doubles embedded double quotes', () => {
  assert.equal(quoteIdentifier('weird"name'), '"weird""name"');
});

test('qualifiedColumn quotes both parts', () => {
  assert.equal(qualifiedColumn('orders', 'total'), '"orders"."total"');
});
