import { quoteIdentifier } from './quoting.js';
import { getRowCount } from './metadata.js';

export function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (ch) => '\\' + ch);
}

export function likeValue(op, value) {
  const esc = escapeLike(value);
  if (op === 'contains') return `%${esc}%`;
  if (op === 'startswith') return `${esc}%`;
  return `%${esc}`; // endswith
}

/** Builds a single "col OP ?" fragment (or a no-param fragment) for one validated filter. */
function buildFilterFragment(filter) {
  const col = quoteIdentifier(filter.column);
  switch (filter.op) {
    case 'eq':
      return { sql: `${col} IS ?`, params: [filter.value] };
    case 'ne':
      return { sql: `${col} IS NOT ?`, params: [filter.value] };
    case 'gt':
      return { sql: `${col} > ?`, params: [filter.value] };
    case 'gte':
      return { sql: `${col} >= ?`, params: [filter.value] };
    case 'lt':
      return { sql: `${col} < ?`, params: [filter.value] };
    case 'lte':
      return { sql: `${col} <= ?`, params: [filter.value] };
    case 'contains':
    case 'startswith':
    case 'endswith':
      return { sql: `${col} LIKE ? ESCAPE '\\'`, params: [likeValue(filter.op, filter.value)] };
    case 'isnull':
      return { sql: `${col} IS NULL`, params: [] };
    case 'isnotnull':
      return { sql: `${col} IS NOT NULL`, params: [] };
    case 'true':
      return { sql: `${col} = 1`, params: [] };
    case 'false':
      return { sql: `${col} = 0`, params: [] };
    default:
      return null;
  }
}

/** Builds an OR'd "(col1 LIKE ? OR col2 LIKE ? ...)" fragment for a global search term
 * across `search.columns` (already restricted to text-logical-type columns upstream). */
export function buildSearchFragment(search) {
  if (!search || !search.term || !search.columns || search.columns.length === 0) return null;
  const value = `%${escapeLike(search.term)}%`;
  const clauses = search.columns.map((col) => `${quoteIdentifier(col)} LIKE ? ESCAPE '\\'`);
  return { sql: `(${clauses.join(' OR ')})`, params: search.columns.map(() => value) };
}

function buildWhereClause(filters, search) {
  const fragments = filters.map(buildFilterFragment).filter(Boolean);
  const searchFragment = buildSearchFragment(search);
  if (searchFragment) fragments.push(searchFragment);
  if (fragments.length === 0) return { sql: '', params: [] };
  return {
    sql: fragments.map((f) => f.sql).join(' AND '),
    params: fragments.flatMap((f) => f.params),
  };
}

// `SELECT *` never includes the rowid pseudo-column, so tables that fall
// back to rowid as their key (no declared primary key) must ask for it
// explicitly or every encoded row key comes out as [null].
function selectList(keyColumns) {
  return keyColumns.includes('rowid') ? 'rowid, *' : '*';
}

export function queryRows(db, tableName, { filters, sort, offset, limit, keyColumns = [], search = null }) {
  const { sql: whereSql, params: whereParams } = buildWhereClause(filters, search);
  const orderSql = sort ? ` ORDER BY ${quoteIdentifier(sort.column)} ${sort.direction}` : '';
  const sql = `SELECT ${selectList(keyColumns)} FROM ${quoteIdentifier(tableName)}${whereSql ? ` WHERE ${whereSql}` : ''}${orderSql} LIMIT ? OFFSET ?`;
  const params = [...whereParams, limit, offset];
  const rows = db.prepare(sql).all(...params);
  const total = getRowCount(db, tableName, whereSql, whereParams);
  return { rows, total, executedSql: sql, executedParams: params };
}

function buildKeyWhere(keyColumns, keyValues) {
  const sql = keyColumns.map((c) => `${quoteIdentifier(c)} IS ?`).join(' AND ');
  const params = keyColumns.map((c) => keyValues[c]);
  return { sql, params };
}

export function getRowByKey(db, tableName, keyColumns, keyValues) {
  const { sql: whereSql, params } = buildKeyWhere(keyColumns, keyValues);
  const sql = `SELECT ${selectList(keyColumns)} FROM ${quoteIdentifier(tableName)} WHERE ${whereSql}`;
  return db.prepare(sql).get(...params) ?? null;
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

function runInTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // rollback failing means the transaction was already gone - ignore
    }
    throw err;
  }
}

/** Inserts a row using only writable columns present in `values`. Returns the inserted row. */
export function insertRow(db, tableName, metadata, values) {
  const writableColumns = metadata.columns.filter((c) => c.writable);
  const columnsToInsert = writableColumns.filter((c) => values[c.name] !== undefined);

  return runInTransaction(db, () => {
    const columnList = columnsToInsert.map((c) => quoteIdentifier(c.name)).join(', ');
    const placeholders = columnsToInsert.map(() => '?').join(', ');
    const sql = columnsToInsert.length > 0
      ? `INSERT INTO ${quoteIdentifier(tableName)} (${columnList}) VALUES (${placeholders})`
      : `INSERT INTO ${quoteIdentifier(tableName)} DEFAULT VALUES`;
    const params = columnsToInsert.map((c) => values[c.name]);
    const info = db.prepare(sql).run(...params);

    if (metadata.keyColumns.length === 1 && metadata.keyColumns[0] === 'rowid') {
      return getRowByKey(db, tableName, ['rowid'], { rowid: info.lastInsertRowid });
    }
    if (metadata.primaryKeyColumns.length === 1 && metadata.columns.find((c) => c.name === metadata.primaryKeyColumns[0])?.isIdentity) {
      const idCol = metadata.primaryKeyColumns[0];
      return getRowByKey(db, tableName, [idCol], { [idCol]: info.lastInsertRowid });
    }
    // Non-identity key: the caller supplied the full key in `values`.
    const keyValues = {};
    for (const col of metadata.keyColumns) keyValues[col] = values[col];
    return getRowByKey(db, tableName, metadata.keyColumns, keyValues);
  });
}

/**
 * Updates a row using optimistic concurrency: the WHERE clause matches the
 * key AND every original column value. If zero rows matched, distinguishes
 * "already deleted" from "changed underneath us" with a follow-up lookup.
 */
export function updateRow(db, tableName, metadata, keyValues, newValues, originalValues) {
  const writableColumns = metadata.columns.filter((c) => c.writable && !metadata.keyColumns.includes(c.name));
  const columnsToUpdate = writableColumns.filter((c) => c.name in newValues);

  return runInTransaction(db, () => {
    const setSql = columnsToUpdate.map((c) => `${quoteIdentifier(c.name)} = ?`).join(', ');
    const setParams = columnsToUpdate.map((c) => newValues[c.name]);

    const { sql: keyWhereSql, params: keyParams } = buildKeyWhere(metadata.keyColumns, keyValues);
    const concurrencyColumns = metadata.columns.filter((c) => c.name in originalValues);
    const concurrencyWhereSql = concurrencyColumns.map((c) => `${quoteIdentifier(c.name)} IS ?`).join(' AND ');
    const concurrencyParams = concurrencyColumns.map((c) => originalValues[c.name]);

    const whereSql = [keyWhereSql, concurrencyWhereSql].filter(Boolean).join(' AND ');

    if (columnsToUpdate.length === 0) {
      return getRowByKey(db, tableName, metadata.keyColumns, keyValues);
    }

    const sql = `UPDATE ${quoteIdentifier(tableName)} SET ${setSql} WHERE ${whereSql}`;
    const info = db.prepare(sql).run(...setParams, ...keyParams, ...concurrencyParams);

    if (info.changes === 0) {
      const stillExists = getRowByKey(db, tableName, metadata.keyColumns, keyValues);
      if (!stillExists) throw new RecordNotFoundError();
      throw new ConcurrencyConflictError();
    }

    return getRowByKey(db, tableName, metadata.keyColumns, keyValues);
  });
}

export function deleteRow(db, tableName, metadata, keyValues, originalValues) {
  return runInTransaction(db, () => {
    const { sql: keyWhereSql, params: keyParams } = buildKeyWhere(metadata.keyColumns, keyValues);
    const concurrencyColumns = metadata.columns.filter((c) => c.name in originalValues);
    const concurrencyWhereSql = concurrencyColumns.map((c) => `${quoteIdentifier(c.name)} IS ?`).join(' AND ');
    const concurrencyParams = concurrencyColumns.map((c) => originalValues[c.name]);

    const whereSql = [keyWhereSql, concurrencyWhereSql].filter(Boolean).join(' AND ');
    const sql = `DELETE FROM ${quoteIdentifier(tableName)} WHERE ${whereSql}`;
    const info = db.prepare(sql).run(...keyParams, ...concurrencyParams);

    if (info.changes === 0) {
      const stillExists = getRowByKey(db, tableName, metadata.keyColumns, keyValues);
      if (stillExists) throw new ConcurrencyConflictError();
      throw new RecordNotFoundError();
    }
  });
}
