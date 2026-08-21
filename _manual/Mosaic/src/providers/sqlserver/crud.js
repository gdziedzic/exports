import sql from 'mssql';
import { quoteIdentifier } from './quoting.js';
import { getRowCount } from './metadata.js';

export function escapeLike(value) {
  return String(value).replace(/[\\%_[\]]/g, (ch) => '\\' + ch);
}

export function likeValue(op, value) {
  const esc = escapeLike(value);
  if (op === 'contains') return `%${esc}%`;
  if (op === 'startswith') return `${esc}%`;
  return `%${esc}`; // endswith
}

export function makeParamState() {
  return { count: 0, params: {} };
}

export function nextParam(state, value) {
  const name = `p${state.count++}`;
  state.params[name] = value;
  return `@${name}`;
}

/** T-SQL has no `IS <param>` operator (IS only takes NULL literals), so a
 * possibly-null value needs an explicit NULL branch to compare correctly. */
export function equalsFragment(col, value, state) {
  if (value === null || value === undefined) return `${col} IS NULL`;
  return `${col} = ${nextParam(state, value)}`;
}

export function buildFilterFragment(filter, state) {
  const col = quoteIdentifier(filter.column);
  switch (filter.op) {
    case 'eq':
      return `${col} = ${nextParam(state, filter.value)}`;
    case 'ne':
      return `${col} <> ${nextParam(state, filter.value)}`;
    case 'gt':
      return `${col} > ${nextParam(state, filter.value)}`;
    case 'gte':
      return `${col} >= ${nextParam(state, filter.value)}`;
    case 'lt':
      return `${col} < ${nextParam(state, filter.value)}`;
    case 'lte':
      return `${col} <= ${nextParam(state, filter.value)}`;
    case 'contains':
    case 'startswith':
    case 'endswith':
      return `${col} LIKE ${nextParam(state, likeValue(filter.op, filter.value))} ESCAPE '\\'`;
    case 'isnull':
      return `${col} IS NULL`;
    case 'isnotnull':
      return `${col} IS NOT NULL`;
    case 'true':
      return `${col} = 1`;
    case 'false':
      return `${col} = 0`;
    default:
      return null;
  }
}

/** Builds an OR'd "([col1] LIKE @pN OR [col2] LIKE @pM ...)" fragment for a global search
 * term across `search.columns` (already restricted to text-logical-type columns upstream). */
export function buildSearchFragment(search, state) {
  if (!search || !search.term || !search.columns || search.columns.length === 0) return null;
  const value = `%${escapeLike(search.term)}%`;
  const clauses = search.columns.map((col) => `${quoteIdentifier(col)} LIKE ${nextParam(state, value)} ESCAPE '\\'`);
  return `(${clauses.join(' OR ')})`;
}

export function buildWhereClause(filters, state, search = null) {
  const fragments = filters.map((f) => buildFilterFragment(f, state)).filter(Boolean);
  const searchFragment = buildSearchFragment(search, state);
  if (searchFragment) fragments.push(searchFragment);
  return fragments.join(' AND ');
}

export function buildKeyWhere(keyColumns, keyValues, state) {
  return keyColumns.map((c) => equalsFragment(quoteIdentifier(c), keyValues[c], state)).join(' AND ');
}

async function run(pool, sqlText, params) {
  const request = pool.request();
  for (const [name, value] of Object.entries(params)) request.input(name, value);
  return request.query(sqlText);
}

export async function queryRows(pool, schema, tableName, { filters, sort, offset, limit, search = null }) {
  const state = makeParamState();
  const whereSql = buildWhereClause(filters, state, search);
  const table = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;

  // OFFSET/FETCH requires an ORDER BY; fall back to a fixed, deterministic
  // ordering (SQL Server's internal row order is otherwise unspecified).
  const orderSql = sort ? `${quoteIdentifier(sort.column)} ${sort.direction}` : '(SELECT NULL)';
  const total = await getRowCount(pool, schema, tableName, whereSql, state.params);

  const offsetParam = nextParam(state, Number(offset));
  const limitParam = nextParam(state, Number(limit));
  const sqlText = `SELECT * FROM ${table}${whereSql ? ` WHERE ${whereSql}` : ''} ORDER BY ${orderSql} OFFSET ${offsetParam} ROWS FETCH NEXT ${limitParam} ROWS ONLY`;
  const result = await run(pool, sqlText, state.params);
  return { rows: result.recordset, total, executedSql: sqlText, executedParams: state.params };
}

export async function getRowByKey(pool, schema, tableName, keyColumns, keyValues) {
  const state = makeParamState();
  const whereSql = buildKeyWhere(keyColumns, keyValues, state);
  const table = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;
  const result = await run(pool, `SELECT * FROM ${table} WHERE ${whereSql}`, state.params);
  return result.recordset[0] ?? null;
}

export class ConcurrencyConflictError extends Error {
  constructor() {
    super('The record changed since it was loaded.');
    this.name = 'ConcurrencyConflictError';
  }
}

export class RecordNotFoundError extends Error {
  constructor() {
    super('Record not found.');
    this.name = 'RecordNotFoundError';
  }
}

async function withTransaction(pool, fn) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (err) {
    try {
      await transaction.rollback();
    } catch {
      // rollback failing means the transaction was already gone - ignore
    }
    throw err;
  }
}

async function runInTx(transaction, sqlText, params) {
  const request = new sql.Request(transaction);
  for (const [name, value] of Object.entries(params)) request.input(name, value);
  return request.query(sqlText);
}

export async function insertRow(pool, schema, tableName, metadata, values) {
  const table = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;
  const writableColumns = metadata.columns.filter((c) => c.writable);
  const columnsToInsert = writableColumns.filter((c) => values[c.name] !== undefined);

  return withTransaction(pool, async (transaction) => {
    const state = makeParamState();
    const columnList = columnsToInsert.map((c) => quoteIdentifier(c.name)).join(', ');
    const placeholders = columnsToInsert.map((c) => nextParam(state, values[c.name])).join(', ');
    const sqlText =
      columnsToInsert.length > 0
        ? `INSERT INTO ${table} (${columnList}) OUTPUT INSERTED.* VALUES (${placeholders})`
        : `INSERT INTO ${table} OUTPUT INSERTED.* DEFAULT VALUES`;
    const result = await runInTx(transaction, sqlText, state.params);
    return result.recordset[0];
  });
}

export async function updateRow(pool, schema, tableName, metadata, keyValues, newValues, originalValues) {
  const table = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;
  const writableColumns = metadata.columns.filter((c) => c.writable && !metadata.keyColumns.includes(c.name));
  const columnsToUpdate = writableColumns.filter((c) => c.name in newValues);

  return withTransaction(pool, async (transaction) => {
    if (columnsToUpdate.length === 0) {
      return getRowByKeyInTx(transaction, schema, tableName, metadata.keyColumns, keyValues);
    }

    const state = makeParamState();
    const setSql = columnsToUpdate.map((c) => `${quoteIdentifier(c.name)} = ${nextParam(state, newValues[c.name])}`).join(', ');
    const keyWhereSql = buildKeyWhere(metadata.keyColumns, keyValues, state);

    // Prefer the rowversion column when present - a single, cheap,
    // DB-maintained concurrency token instead of comparing every column.
    let concurrencyWhereSql;
    if (metadata.rowversionColumn && metadata.rowversionColumn in originalValues) {
      concurrencyWhereSql = equalsFragment(quoteIdentifier(metadata.rowversionColumn), originalValues[metadata.rowversionColumn], state);
    } else {
      const concurrencyColumns = metadata.columns.filter((c) => c.name in originalValues);
      concurrencyWhereSql = concurrencyColumns.map((c) => equalsFragment(quoteIdentifier(c.name), originalValues[c.name], state)).join(' AND ');
    }

    const whereSql = [keyWhereSql, concurrencyWhereSql].filter(Boolean).join(' AND ');
    const sqlText = `UPDATE ${table} SET ${setSql} OUTPUT INSERTED.* WHERE ${whereSql}`;
    const result = await runInTx(transaction, sqlText, state.params);

    if (result.recordset.length === 0) {
      const stillExists = await getRowByKeyInTx(transaction, schema, tableName, metadata.keyColumns, keyValues);
      if (!stillExists) throw new RecordNotFoundError();
      throw new ConcurrencyConflictError();
    }
    return result.recordset[0];
  });
}

export async function deleteRow(pool, schema, tableName, metadata, keyValues, originalValues) {
  const table = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;

  return withTransaction(pool, async (transaction) => {
    const state = makeParamState();
    const keyWhereSql = buildKeyWhere(metadata.keyColumns, keyValues, state);

    let concurrencyWhereSql;
    if (metadata.rowversionColumn && metadata.rowversionColumn in originalValues) {
      concurrencyWhereSql = equalsFragment(quoteIdentifier(metadata.rowversionColumn), originalValues[metadata.rowversionColumn], state);
    } else {
      const concurrencyColumns = metadata.columns.filter((c) => c.name in originalValues);
      concurrencyWhereSql = concurrencyColumns.map((c) => equalsFragment(quoteIdentifier(c.name), originalValues[c.name], state)).join(' AND ');
    }

    const whereSql = [keyWhereSql, concurrencyWhereSql].filter(Boolean).join(' AND ');
    const result = await runInTx(transaction, `DELETE FROM ${table} WHERE ${whereSql}`, state.params);

    if (result.rowsAffected[0] === 0) {
      const stillExists = await getRowByKeyInTx(transaction, schema, tableName, metadata.keyColumns, keyValues);
      if (stillExists) throw new ConcurrencyConflictError();
      throw new RecordNotFoundError();
    }
  });
}

async function getRowByKeyInTx(transaction, schema, tableName, keyColumns, keyValues) {
  const state = makeParamState();
  const whereSql = buildKeyWhere(keyColumns, keyValues, state);
  const table = `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`;
  const result = await runInTx(transaction, `SELECT * FROM ${table} WHERE ${whereSql}`, state.params);
  return result.recordset[0] ?? null;
}
