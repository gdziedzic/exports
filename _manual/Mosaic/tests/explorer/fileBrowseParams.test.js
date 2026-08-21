import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFileBrowseParams, applyFileBrowseState, fileBrowseStateToParams } from '../../src/explorer/fileBrowseParams.js';

const columns = ['name', 'category', 'price'];

function parse(url) {
  return parseFileBrowseParams(new URL(url, 'http://x'), { columns, defaultPageSize: 50, maxPageSize: 500 });
}

test('parses q as a trimmed free-text search term', () => {
  assert.equal(parse('/?q=%20hello%20').search, 'hello');
  assert.equal(parse('/?q=').search, null);
});

test('parses per-column filters, dropping unknown columns', () => {
  const state = parse('/?f_category=Bags&f_not_a_col=x');
  assert.deepEqual(state.columnFilters, [{ column: 'category', value: 'Bags' }]);
});

test('accepts a valid sort column/direction and drops an invalid one', () => {
  assert.deepEqual(parse('/?sort=price&dir=desc').sort, { column: 'price', direction: 'desc' });
  assert.equal(parse('/?sort=bogus&dir=asc').sort, null);
});

test('applyFileBrowseState filters by search across all columns', () => {
  const records = [{ name: 'Widget', category: 'Tools' }, { name: 'Gadget', category: 'Electronics' }];
  const { rows, total } = applyFileBrowseState(records, { search: 'tool', columnFilters: [], sort: null, page: 1, pageSize: 50 });
  assert.equal(total, 1);
  assert.equal(rows[0].name, 'Widget');
});

test('applyFileBrowseState combines search and per-column filters (AND)', () => {
  const records = [
    { name: 'Red Widget', category: 'Tools' },
    { name: 'Blue Widget', category: 'Tools' },
  ];
  const { rows } = applyFileBrowseState(records, {
    search: 'widget',
    columnFilters: [{ column: 'name', value: 'red' }],
    sort: null,
    page: 1,
    pageSize: 50,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Red Widget');
});

test('applyFileBrowseState sorts numerically when both values are numbers', () => {
  const records = [{ price: 30 }, { price: 5 }, { price: 100 }];
  const { rows } = applyFileBrowseState(records, { search: null, columnFilters: [], sort: { column: 'price', direction: 'asc' }, page: 1, pageSize: 50 });
  assert.deepEqual(rows.map((r) => r.price), [5, 30, 100]);
});

test('applyFileBrowseState sorts null/undefined values last regardless of direction', () => {
  const records = [{ price: null }, { price: 2 }, { price: 1 }];
  const asc = applyFileBrowseState(records, { search: null, columnFilters: [], sort: { column: 'price', direction: 'asc' }, page: 1, pageSize: 50 });
  assert.deepEqual(asc.rows.map((r) => r.price), [1, 2, null]);
  const desc = applyFileBrowseState(records, { search: null, columnFilters: [], sort: { column: 'price', direction: 'desc' }, page: 1, pageSize: 50 });
  assert.deepEqual(desc.rows.map((r) => r.price), [2, 1, null]);
});

test('applyFileBrowseState paginates the filtered result and reports the filtered total', () => {
  const records = Array.from({ length: 25 }, (_, i) => ({ name: `item${i}` }));
  const { rows, total } = applyFileBrowseState(records, { search: null, columnFilters: [], sort: null, page: 2, pageSize: 10 });
  assert.equal(total, 25);
  assert.equal(rows.length, 10);
  assert.equal(rows[0].name, 'item10');
});

test('parses repeated cols= fields (an HTML checkbox group submits one per checked box), not just the first', () => {
  const state = parse('/?cols=name&cols=price');
  assert.deepEqual(state.visibleColumns, new Set(['name', 'price']));
});

test('fileBrowseStateToParams round-trips through parseFileBrowseParams', () => {
  const original = parse('/?q=hello&f_category=Bags&sort=price&dir=desc&page=2&pageSize=10&cols=name,price');
  const qs = new URLSearchParams(fileBrowseStateToParams(original)).toString();
  const reparsed = parse(`/?${qs}`);
  assert.deepEqual(reparsed, original);
});
