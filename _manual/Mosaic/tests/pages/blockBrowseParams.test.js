import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBlockBrowseParams, blockBrowseStateToParams } from '../../src/pages/blockBrowseParams.js';

const columns = [
  { name: 'id', logicalType: 'decimal' },
  { name: 'name', logicalType: 'text' },
  { name: 'active', logicalType: 'boolean' },
];

function parse(url) {
  return parseBlockBrowseParams(new URL(url, 'http://x'), 'items', columns);
}

test('parses a valid sort column and direction, scoped to the block id', () => {
  const state = parse('/?b_items_sort=name&b_items_dir=desc');
  assert.deepEqual(state.sort, { column: 'name', direction: 'DESC' });
});

test('does not pick up another block\'s sort/filter params', () => {
  const state = parse('/?b_other_sort=name&b_other_dir=desc');
  assert.equal(state.sort, null);
  assert.deepEqual(state.filters, []);
});

test('silently drops sort on an unknown column or bad direction', () => {
  assert.equal(parse('/?b_items_sort=nope&b_items_dir=asc').sort, null);
  assert.equal(parse('/?b_items_sort=name&b_items_dir=sideways').sort, null);
});

test('parses and coerces a value-bearing filter for a valid column/operator pair', () => {
  const state = parse('/?b_items_f_op_id=gte&b_items_f_val_id=9.5');
  assert.deepEqual(state.filters, [{ column: 'id', op: 'gte', logicalType: 'decimal', value: 9.5 }]);
});

test('drops a filter value that does not coerce cleanly for the column\'s logical type', () => {
  const state = parse('/?b_items_f_op_id=gte&b_items_f_val_id=not-a-number');
  assert.deepEqual(state.filters, []);
});

test('parses a no-value operator (isnull/true/false) without requiring f_val', () => {
  assert.deepEqual(parse('/?b_items_f_op_name=isnull').filters, [{ column: 'name', op: 'isnull', logicalType: 'text' }]);
  assert.deepEqual(parse('/?b_items_f_op_active=true').filters, [{ column: 'active', op: 'true', logicalType: 'boolean' }]);
});

test('drops a filter whose operator is not valid for that column\'s logical type', () => {
  // "contains" is a text operator, not valid for the decimal "id" column.
  const state = parse('/?b_items_f_op_id=contains&b_items_f_val_id=1');
  assert.deepEqual(state.filters, []);
});

test('blockBrowseStateToParams round-trips through parseBlockBrowseParams', () => {
  const original = parse('/?b_items_sort=name&b_items_dir=desc&b_items_f_op_id=gte&b_items_f_val_id=5');
  const qs = new URLSearchParams(blockBrowseStateToParams('items', original)).toString();
  const reparsed = parse(`/?${qs}`);
  assert.deepEqual(reparsed, original);
});
