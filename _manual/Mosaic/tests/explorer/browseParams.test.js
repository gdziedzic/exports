import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBrowseParams, browseStateToParams } from '../../src/explorer/browseParams.js';
import { classifySqliteType, OPERATORS_BY_LOGICAL_TYPE, coerceFormValue } from '../../src/providers/sqlite/types.js';

const columns = [
  { name: 'id', sqlType: 'INTEGER' },
  { name: 'name', sqlType: 'TEXT' },
  { name: 'price', sqlType: 'REAL' },
];

function parse(url) {
  return parseBrowseParams(new URL(url, 'http://x'), {
    columns,
    classifyType: classifySqliteType,
    operatorsByType: OPERATORS_BY_LOGICAL_TYPE,
    coerceFormValue,
    defaultPageSize: 50,
    maxPageSize: 500,
  });
}

test('parses page/pageSize, clamped to [1, maxPageSize]', () => {
  assert.equal(parse('/?page=3&pageSize=10').page, 3);
  assert.equal(parse('/?pageSize=10').pageSize, 10);
  assert.equal(parse('/?pageSize=999999').pageSize, 500, 'clamped to maxPageSize');
  assert.equal(parse('/?pageSize=0').pageSize, 50, 'a non-positive pageSize is invalid, so it falls back to the default');
});

test('accepts a valid sort column and direction', () => {
  const state = parse('/?sort=name&dir=desc');
  assert.deepEqual(state.sort, { column: 'name', direction: 'DESC' });
});

test('silently drops sort on an unknown column rather than erroring', () => {
  assert.equal(parse('/?sort=not_a_real_column&dir=asc').sort, null);
});

test('silently drops sort with an unallowlisted direction', () => {
  assert.equal(parse('/?sort=name&dir=sideways').sort, null);
});

test('parses a value-bearing filter for a valid column/operator pair, coercing the value for its logical type', () => {
  const state = parse('/?f_op_price=gte&f_val_price=9.99');
  assert.deepEqual(state.filters, [{ column: 'price', op: 'gte', logicalType: 'decimal', value: 9.99 }]);
});

test('drops a value-bearing filter whose value does not coerce cleanly for the column\'s logical type', () => {
  // "price" is decimal; a non-numeric string can't be coerced, so the filter is dropped
  // rather than reaching SQL and blowing up on a provider that doesn't implicitly convert it.
  const state = parse('/?f_op_price=gte&f_val_price=not-a-number');
  assert.deepEqual(state.filters, []);
});

test('parses a no-value filter operator (isnull)', () => {
  const state = parse('/?f_op_name=isnull');
  assert.deepEqual(state.filters, [{ column: 'name', op: 'isnull', logicalType: 'text' }]);
});

test('drops a filter whose operator is not valid for that column\'s logical type', () => {
  // "contains" is a text operator, not valid for the numeric "price" column.
  const state = parse('/?f_op_price=contains&f_val_price=9');
  assert.deepEqual(state.filters, []);
});

test('drops a filter for a column name that does not exist', () => {
  const state = parse('/?f_op_not_a_column=eq&f_val_not_a_column=x');
  assert.deepEqual(state.filters, []);
});

test('drops a value-bearing filter whose value is empty', () => {
  const state = parse('/?f_op_price=eq&f_val_price=');
  assert.deepEqual(state.filters, []);
});

test('parses cols, dropping unknown column names, and treats an all-unknown list as unset', () => {
  const state = parse('/?cols=name,bogus,price');
  assert.deepEqual(state.visibleColumns, new Set(['name', 'price']));
  assert.equal(parse('/?cols=bogus1,bogus2').visibleColumns, null);
});

test('parses repeated cols= fields (an HTML checkbox group submits one per checked box), not just the first', () => {
  const state = parse('/?cols=name&cols=price');
  assert.deepEqual(state.visibleColumns, new Set(['name', 'price']));
});

test('browseStateToParams round-trips through parseBrowseParams', () => {
  const original = parse('/?page=2&pageSize=25&sort=name&dir=desc&f_op_price=gte&f_val_price=5&cols=name,price');
  const qs = new URLSearchParams(browseStateToParams(original)).toString();
  const reparsed = parse(`/?${qs}`);
  assert.deepEqual(reparsed, original);
});

test('parses a search term, restricted to text-logical-type columns', () => {
  const state = parse('/?q=widget');
  assert.deepEqual(state.search, { term: 'widget', columns: ['name'] });
});

test('trims whitespace from a search term and drops a whitespace-only one', () => {
  assert.deepEqual(parse('/?q=%20widget%20').search, { term: 'widget', columns: ['name'] });
  assert.equal(parse('/?q=%20%20').search, null);
});

test('drops an empty search term', () => {
  assert.equal(parse('/?q=').search, null);
});

test('search is null when no column is text-typed', () => {
  const numericOnlyColumns = [{ name: 'id', sqlType: 'INTEGER' }];
  const state = parseBrowseParams(new URL('/?q=5', 'http://x'), {
    columns: numericOnlyColumns,
    classifyType: classifySqliteType,
    operatorsByType: OPERATORS_BY_LOGICAL_TYPE,
    coerceFormValue,
    defaultPageSize: 50,
    maxPageSize: 500,
  });
  assert.equal(state.search, null);
});

test('browseStateToParams round-trips a search term alongside other state', () => {
  const original = parse('/?page=2&sort=name&dir=desc&q=widget');
  const qs = new URLSearchParams(browseStateToParams(original)).toString();
  const reparsed = parse(`/?${qs}`);
  assert.deepEqual(reparsed, original);
});
