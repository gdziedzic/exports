import test from 'node:test';
import assert from 'node:assert/strict';
import { executeBlock, executeTableBlock, describeTableBlockColumns, executeWriteAction } from '../../src/pages/blockExecutor.js';

function stubAdapter(rows) {
  const calls = [];
  return {
    calls,
    runSelectQuery: async (sql, params) => {
      calls.push({ sql, params });
      return typeof rows === 'function' ? rows(params) : rows;
    },
    runWriteQuery: async (sql, params) => {
      calls.push({ sql, params });
      return { changes: 1 };
    },
  };
}

function stubTableAdapter(rowsOrFn) {
  const calls = [];
  return {
    calls,
    runTableBlockQuery: async (opts) => {
      calls.push(opts);
      return typeof rowsOrFn === 'function' ? rowsOrFn(opts) : rowsOrFn;
    },
  };
}

test('executeBlock binds only parameters actually referenced in the SQL text', async () => {
  const adapter = stubAdapter([]);
  await executeBlock({
    adapter,
    block: { presentation: 'scalar' },
    sql: 'SELECT @Used AS x',
    paramValues: new Map([['Used', 1], ['Unused', 2]]),
    pageSize: 10,
  });
  assert.deepEqual(Object.keys(adapter.calls[0].params).sort(), ['Used']);
});

test('executeBlock binds @Offset as 0 and @PageSize as pageSize for scalar/single-record presentations', async () => {
  const adapter = stubAdapter([]);
  await executeBlock({
    adapter,
    block: { presentation: 'scalar' },
    sql: 'SELECT @PageSize AS x LIMIT @PageSize OFFSET @Offset',
    paramValues: new Map(),
    pageSize: 7,
  });
  assert.equal(adapter.calls[0].params.Offset, 0);
  assert.equal(adapter.calls[0].params.PageSize, 7);
});

test('executeBlock scalar presentation returns the first column of the first row and flags extras', async () => {
  const adapter = stubAdapter([{ count: 42, other: 'x' }, { count: 43, other: 'y' }]);
  const result = await executeBlock({ adapter, block: { presentation: 'scalar' }, sql: 'SELECT count, other FROM t', paramValues: new Map(), pageSize: 10 });
  assert.equal(result.kind, 'scalar');
  assert.equal(result.value, 42);
  assert.equal(result.hasExtraRows, true);
  assert.equal(result.hasExtraColumns, true);
});

test('executeBlock scalar presentation with an empty result set returns null without throwing', async () => {
  const adapter = stubAdapter([]);
  const result = await executeBlock({ adapter, block: { presentation: 'scalar' }, sql: 'SELECT count FROM t', paramValues: new Map(), pageSize: 10 });
  assert.equal(result.value, null);
  assert.equal(result.hasExtraRows, false);
});

test('executeBlock single-record presentation returns the first row and flags extra rows', async () => {
  const adapter = stubAdapter([{ id: 1 }, { id: 2 }]);
  const result = await executeBlock({ adapter, block: { presentation: 'single-record' }, sql: 'SELECT * FROM t', paramValues: new Map(), pageSize: 10 });
  assert.equal(result.kind, 'single-record');
  assert.deepEqual(result.row, { id: 1 });
  assert.equal(result.hasExtraRows, true);
});

test('executeBlock single-record presentation with no rows returns row: null', async () => {
  const adapter = stubAdapter([]);
  const result = await executeBlock({ adapter, block: { presentation: 'single-record' }, sql: 'SELECT * FROM t', paramValues: new Map(), pageSize: 10 });
  assert.equal(result.row, null);
});

test('executeTableBlock requests pageSize+1 rows and trims the extra row, reporting hasNextPage', async () => {
  const allRows = Array.from({ length: 6 }, (_, i) => ({ id: i }));
  const adapter = stubTableAdapter((opts) => allRows.slice(0, opts.limit));
  const result = await executeTableBlock({
    adapter,
    block: { presentation: 'table' },
    sql: 'SELECT * FROM t',
    paramValues: new Map(),
    page: 1,
    pageSize: 5,
    sort: null,
    filters: [],
  });
  assert.equal(result.kind, 'table');
  assert.equal(result.rows.length, 5);
  assert.equal(result.hasNextPage, true);
});

test('executeTableBlock reports hasNextPage: false when fewer rows than pageSize+1 come back', async () => {
  const adapter = stubTableAdapter([{ id: 1 }, { id: 2 }]);
  const result = await executeTableBlock({
    adapter, block: { presentation: 'table' }, sql: 'SELECT * FROM t', paramValues: new Map(), page: 1, pageSize: 5, sort: null, filters: [],
  });
  assert.equal(result.hasNextPage, false);
  assert.equal(result.rows.length, 2);
});

test('executeTableBlock computes offset from page/pageSize and requests pageSize+1 as the limit', async () => {
  const adapter = stubTableAdapter([]);
  await executeTableBlock({
    adapter, block: { presentation: 'table' }, sql: 'SELECT * FROM t', paramValues: new Map(), page: 3, pageSize: 10, sort: null, filters: [],
  });
  assert.equal(adapter.calls[0].offset, 20);
  assert.equal(adapter.calls[0].limit, 11);
});

test('executeTableBlock binds only inner params referenced in the SQL text, and passes sort/filters through to the adapter untouched', async () => {
  const adapter = stubTableAdapter([]);
  const sort = { column: 'id', direction: 'DESC' };
  const filters = [{ column: 'price', op: 'gte', value: 10 }];
  await executeTableBlock({
    adapter,
    block: { presentation: 'table' },
    sql: 'SELECT * FROM t WHERE a = @Used',
    paramValues: new Map([['Used', 1], ['Unused', 2]]),
    page: 1,
    pageSize: 10,
    sort,
    filters,
  });
  assert.deepEqual(adapter.calls[0].innerParams, { Used: 1 });
  assert.deepEqual(adapter.calls[0].sort, sort);
  assert.deepEqual(adapter.calls[0].filters, filters);
  assert.equal(adapter.calls[0].sqlText, 'SELECT * FROM t WHERE a = @Used');
});

test('describeTableBlockColumns caches per page+block, calling the adapter only once within the TTL', async () => {
  let calls = 0;
  const adapter = {
    describeTableBlockColumns: async () => {
      calls++;
      return [{ name: 'id', logicalType: 'decimal' }];
    },
  };
  const args = { adapter, pageId: 'p1', block: { id: 'b1' }, sql: 'SELECT id FROM t', paramValues: new Map(), ttlMs: 60_000 };

  const first = await describeTableBlockColumns(args);
  const second = await describeTableBlockColumns(args);

  assert.deepEqual(first, [{ name: 'id', logicalType: 'decimal' }]);
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
});

test('describeTableBlockColumns re-introspects once the TTL is exhausted (ttlMs <= 0 means always expired)', async () => {
  let calls = 0;
  const adapter = {
    describeTableBlockColumns: async () => {
      calls++;
      return [{ name: 'id', logicalType: 'decimal' }];
    },
  };
  const args = { adapter, pageId: 'p2', block: { id: 'b1' }, sql: 'SELECT id FROM t', paramValues: new Map(), ttlMs: 0 };

  await describeTableBlockColumns(args);
  await describeTableBlockColumns(args);

  assert.equal(calls, 2);
});

test('executeWriteAction binds only referenced parameters and delegates to runWriteQuery', async () => {
  const adapter = stubAdapter([]);
  const result = await executeWriteAction({
    adapter,
    sql: 'UPDATE t SET x = @NewValue WHERE id = @Id',
    paramValues: new Map([['NewValue', 5], ['Id', 1], ['Extraneous', 99]]),
  });
  assert.deepEqual(adapter.calls[0].params, { NewValue: 5, Id: 1 });
  assert.deepEqual(result, { changes: 1 });
});
