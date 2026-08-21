import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeLike,
  makeParamState,
  nextParam,
  equalsFragment,
  buildFilterFragment,
  buildSearchFragment,
  buildWhereClause,
  buildKeyWhere,
  queryRows,
  getRowByKey,
} from '../../../src/providers/sqlserver/crud.js';

test('escapeLike escapes backslash, %, _, [ and ]', () => {
  assert.equal(escapeLike('50%_off[sale]\\'), '50\\%\\_off\\[sale\\]\\\\');
});

test('nextParam names params sequentially and never inlines the value', () => {
  const state = makeParamState();
  const p0 = nextParam(state, "'; DROP TABLE Orders; --");
  const p1 = nextParam(state, 42);
  assert.equal(p0, '@p0');
  assert.equal(p1, '@p1');
  assert.deepEqual(state.params, { p0: "'; DROP TABLE Orders; --", p1: 42 });
});

test('equalsFragment uses IS NULL for a null value instead of a bound param (T-SQL has no IS <param>)', () => {
  const state = makeParamState();
  assert.equal(equalsFragment('[email]', null, state), '[email] IS NULL');
  assert.deepEqual(state.params, {});
});

test('equalsFragment binds a parameter for a non-null value', () => {
  const state = makeParamState();
  const fragment = equalsFragment('[id]', 5, state);
  assert.equal(fragment, '[id] = @p0');
  assert.deepEqual(state.params, { p0: 5 });
});

test('buildFilterFragment quotes the identifier and parameterizes eq/ne/comparison values', () => {
  const state = makeParamState();
  const fragment = buildFilterFragment({ column: "weird]col", op: 'eq', value: "x' OR '1'='1" }, state);
  assert.equal(fragment, "[weird]]col] = @p0");
  assert.deepEqual(state.params, { p0: "x' OR '1'='1" });
});

test('buildFilterFragment builds a parameterized, escaped LIKE for contains/startswith/endswith', () => {
  const state = makeParamState();
  const fragment = buildFilterFragment({ column: 'name', op: 'contains', value: '50%' }, state);
  assert.equal(fragment, "[name] LIKE @p0 ESCAPE '\\'");
  assert.equal(state.params.p0, '%50\\%%');
});

test('buildFilterFragment renders no-value operators without any parameter', () => {
  const state = makeParamState();
  assert.equal(buildFilterFragment({ column: 'x', op: 'isnull' }, state), '[x] IS NULL');
  assert.equal(buildFilterFragment({ column: 'x', op: 'true' }, state), '[x] = 1');
  assert.deepEqual(state.params, {});
});

test('buildWhereClause ANDs multiple filters together, each with its own param', () => {
  const state = makeParamState();
  const sql = buildWhereClause(
    [
      { column: 'is_active', op: 'true' },
      { column: 'price', op: 'gte', value: '9.99' },
    ],
    state,
  );
  assert.equal(sql, '[is_active] = 1 AND [price] >= @p0');
  assert.deepEqual(state.params, { p0: '9.99' });
});

test('buildSearchFragment ORs a LIKE across every given column with one escaped, parameterized value', () => {
  const state = makeParamState();
  const fragment = buildSearchFragment({ term: '50%', columns: ['name', 'sku'] }, state);
  assert.equal(fragment, "([name] LIKE @p0 ESCAPE '\\' OR [sku] LIKE @p1 ESCAPE '\\')");
  assert.deepEqual(state.params, { p0: '%50\\%%', p1: '%50\\%%' });
});

test('buildSearchFragment returns null for an empty/missing search', () => {
  const state = makeParamState();
  assert.equal(buildSearchFragment(null, state), null);
  assert.equal(buildSearchFragment({ term: '', columns: ['name'] }, state), null);
  assert.equal(buildSearchFragment({ term: 'x', columns: [] }, state), null);
});

test('buildWhereClause ANDs a search fragment onto the filter fragments', () => {
  const state = makeParamState();
  const sql = buildWhereClause([{ column: 'is_active', op: 'true' }], state, { term: 'bob', columns: ['name'] });
  assert.equal(sql, "[is_active] = 1 AND ([name] LIKE @p0 ESCAPE '\\')");
});

test('buildKeyWhere quotes each key column and parameterizes each value', () => {
  const state = makeParamState();
  const sql = buildKeyWhere(['OrderId', 'LineNo'], { OrderId: 1, LineNo: 2 }, state);
  assert.equal(sql, '[OrderId] = @p0 AND [LineNo] = @p1');
  assert.deepEqual(state.params, { p0: 1, p1: 2 });
});

function fakePool(queryHandler) {
  const queries = [];
  return {
    queries,
    request() {
      const inputs = {};
      const req = {
        input(name, value) {
          inputs[name] = value;
          return req;
        },
        async query(sqlText) {
          queries.push({ sqlText, inputs });
          return queryHandler(sqlText, inputs);
        },
      };
      return req;
    },
  };
}

test('queryRows sends a parameterized, quoted SELECT with OFFSET/FETCH and a separate COUNT(*)', async () => {
  const pool = fakePool((sqlText) => {
    if (sqlText.includes('COUNT(*)')) return { recordset: [{ c: 3 }] };
    return { recordset: [{ id: 1, name: 'Widget' }] };
  });

  const { rows, total } = await queryRows(pool, 'dbo', 'Orders', {
    filters: [{ column: 'name', op: 'contains', value: 'wid' }],
    sort: { column: 'id', direction: 'DESC' },
    offset: 20,
    limit: 10,
  });

  assert.equal(total, 3);
  assert.deepEqual(rows, [{ id: 1, name: 'Widget' }]);

  const selectCall = pool.queries.find((q) => q.sqlText.startsWith('SELECT *'));
  assert.match(selectCall.sqlText, /FROM \[dbo\]\.\[Orders\]/);
  assert.match(selectCall.sqlText, /WHERE \[name\] LIKE @p\d+ ESCAPE '\\'/);
  assert.match(selectCall.sqlText, /ORDER BY \[id\] DESC/);
  assert.match(selectCall.sqlText, /OFFSET @p\d+ ROWS FETCH NEXT @p\d+ ROWS ONLY/);
  // offset/limit are bound parameters, never string-concatenated literals
  assert.ok(Object.values(selectCall.inputs).includes(20));
  assert.ok(Object.values(selectCall.inputs).includes(10));
});

test('queryRows ANDs a search fragment onto the WHERE clause', async () => {
  const pool = fakePool((sqlText) => (sqlText.includes('COUNT(*)') ? { recordset: [{ c: 1 }] } : { recordset: [{ id: 1, name: 'Bob' }] }));

  const { total } = await queryRows(pool, 'dbo', 'Orders', {
    filters: [{ column: 'is_active', op: 'true' }],
    sort: null,
    offset: 0,
    limit: 10,
    search: { term: 'bob', columns: ['name'] },
  });

  assert.equal(total, 1);
  const selectCall = pool.queries.find((q) => q.sqlText.startsWith('SELECT *'));
  assert.match(selectCall.sqlText, /WHERE \[is_active\] = 1 AND \(\[name\] LIKE @p\d+ ESCAPE '\\'\)/);
});

test('queryRows falls back to a deterministic ORDER BY when no sort is given (OFFSET/FETCH requires one)', async () => {
  const pool = fakePool((sqlText) => (sqlText.includes('COUNT(*)') ? { recordset: [{ c: 0 }] } : { recordset: [] }));
  await queryRows(pool, 'dbo', 'Orders', { filters: [], sort: null, offset: 0, limit: 50 });
  const selectCall = pool.queries.find((q) => q.sqlText.startsWith('SELECT *'));
  assert.match(selectCall.sqlText, /ORDER BY \(SELECT NULL\)/);
});

test('getRowByKey quotes the table and parameterizes every key value', async () => {
  const pool = fakePool(() => ({ recordset: [{ id: 7, name: 'Row Seven' }] }));
  const row = await getRowByKey(pool, 'dbo', 'Orders', ['id'], { id: 7 });
  assert.deepEqual(row, { id: 7, name: 'Row Seven' });
  assert.match(pool.queries[0].sqlText, /FROM \[dbo\]\.\[Orders\] WHERE \[id\] = @p0/);
  assert.deepEqual(pool.queries[0].inputs, { p0: 7 });
});

test('getRowByKey returns null when nothing matches', async () => {
  const pool = fakePool(() => ({ recordset: [] }));
  assert.equal(await getRowByKey(pool, 'dbo', 'Orders', ['id'], { id: 999 }), null);
});
