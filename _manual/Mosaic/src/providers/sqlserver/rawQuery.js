import sql from 'mssql';
import { quoteIdentifier } from './quoting.js';
import { escapeLike, likeValue } from './crud.js';
import { classifySqlServerType } from './types.js';

/** Executes admin-authored SQL (from a configured page's .sql file) with named parameters. */
export async function runSelectQuery(pool, sqlText, params) {
  const request = pool.request();
  for (const [name, value] of Object.entries(params)) request.input(name, value);
  const result = await request.query(sqlText);
  return result.recordset;
}

/**
 * Describes the columns a table block's query produces, for validating
 * requested sort/filter identifiers before they're quoted into SQL.
 * `TOP (0)` still gets SQL Server to compile and describe the result set
 * (recordset column metadata, including type), without fetching any rows.
 * `column.type` is one of mssql's `TYPES` classes (e.g. `sql.Int`); its
 * `.name` (e.g. "Int") lines up with classifySqlServerType's expected
 * lowercase type-name buckets. Callers are expected to cache this - it
 * costs a real round trip.
 */
export async function describeColumns(pool, sqlText, innerParams) {
  const request = pool.request();
  for (const [name, value] of Object.entries(innerParams)) request.input(name, value);
  const result = await request.query(`SELECT TOP (0) * FROM (${sqlText}) AS block_result`);
  return Object.values(result.recordset.columns).map((col) => ({
    name: col.name,
    logicalType: classifySqlServerType(col.type?.name?.toLowerCase()),
  }));
}

/** Builds a single "col OP @name" fragment (or a no-param fragment) for one validated filter,
 * binding by name so it can be merged with the inner query's own named parameters. LIKE-based
 * operators are only ever requested for text-classified columns (enforced by the caller's
 * operator-set validation), so no CAST is needed for SQL Server's LIKE type restrictions. */
function buildFilterFragment(filter, paramName) {
  const col = quoteIdentifier(filter.column);
  switch (filter.op) {
    case 'eq':
      return { sql: `${col} = @${paramName}`, params: { [paramName]: filter.value } };
    case 'ne':
      return { sql: `${col} <> @${paramName}`, params: { [paramName]: filter.value } };
    case 'gt':
      return { sql: `${col} > @${paramName}`, params: { [paramName]: filter.value } };
    case 'gte':
      return { sql: `${col} >= @${paramName}`, params: { [paramName]: filter.value } };
    case 'lt':
      return { sql: `${col} < @${paramName}`, params: { [paramName]: filter.value } };
    case 'lte':
      return { sql: `${col} <= @${paramName}`, params: { [paramName]: filter.value } };
    case 'contains':
    case 'startswith':
    case 'endswith':
      return { sql: `${col} LIKE @${paramName} ESCAPE '\\'`, params: { [paramName]: likeValue(filter.op, filter.value) } };
    case 'isnull':
      return { sql: `${col} IS NULL`, params: {} };
    case 'isnotnull':
      return { sql: `${col} IS NOT NULL`, params: {} };
    case 'true':
      return { sql: `${col} = 1`, params: {} };
    case 'false':
      return { sql: `${col} = 0`, params: {} };
    default:
      return null;
  }
}

/**
 * Executes a table block's query wrapped with engine-owned dynamic
 * filter/sort/pagination, replacing the old convention where the block's
 * own SQL hand-wrote ORDER BY/OFFSET/FETCH. `filters`/`sort` must already be
 * validated against `describeColumns`' output. OFFSET/FETCH requires an
 * ORDER BY; falls back to a fixed, deterministic ordering when no sort is
 * chosen, same as the automatic browser's `queryRows` does.
 */
export async function runTableBlockQuery(pool, { sqlText, innerParams, filters, sort, offset, limit }) {
  const engineParams = {};
  const whereParts = [];
  filters.forEach((filter, i) => {
    const fragment = buildFilterFragment(filter, `__f${i}`);
    if (!fragment) return;
    whereParts.push(fragment.sql);
    Object.assign(engineParams, fragment.params);
  });
  const whereSql = whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : '';
  const orderSql = sort ? `${quoteIdentifier(sort.column)} ${sort.direction}` : '(SELECT NULL)';
  engineParams.__offset = offset;
  engineParams.__limit = limit;

  const wrapped = `SELECT * FROM (${sqlText}) AS block_result${whereSql} ORDER BY ${orderSql} OFFSET @__offset ROWS FETCH NEXT @__limit ROWS ONLY`;
  const request = pool.request();
  for (const [name, value] of Object.entries({ ...innerParams, ...engineParams })) request.input(name, value);
  const result = await request.query(wrapped);
  return result.recordset;
}

export async function runWriteQuery(pool, sqlText, params) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const request = new sql.Request(transaction);
    for (const [name, value] of Object.entries(params)) request.input(name, value);
    const result = await request.query(sqlText);
    await transaction.commit();
    return { rowsAffected: result.rowsAffected[0] ?? 0 };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {
      // rollback failing means the transaction was already gone - ignore
    }
    throw err;
  }
}
