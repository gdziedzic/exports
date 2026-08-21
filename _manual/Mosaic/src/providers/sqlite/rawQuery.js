import { quoteIdentifier } from './quoting.js';
import { escapeLike, likeValue } from './crud.js';
import { inferValueLogicalType } from '../logicalTypes.js';

/**
 * Executes admin-authored SQL (from a configured page's .sql file) with
 * named parameters. This is a different trust boundary from the automatic
 * explorer's CRUD paths - the SQL text itself is never request-supplied,
 * only the bound parameter values are, and node:sqlite parameter binding
 * still fully escapes those.
 */
export function runSelectQuery(db, sqlText, params) {
  return db.prepare(sqlText).all(params);
}

/**
 * Describes the columns a table block's query produces, for validating
 * requested sort/filter identifiers before they're quoted into SQL. Column
 * *names* come from the prepared statement without executing it
 * (`.columns()`), which is reliable; the *type* is frequently null for
 * joined/aliased/expression columns, so it's inferred instead from one
 * sampled row's actual JS value (same inference cell rendering already
 * uses). Callers are expected to cache this - it costs a real query.
 */
export function describeColumns(db, sqlText, innerParams) {
  const stmt = db.prepare(sqlText);
  const names = stmt.columns().map((c) => c.name);
  const sample = stmt.get(innerParams) ?? {};
  return names.map((name) => ({ name, logicalType: inferValueLogicalType(sample[name]) }));
}

/** Builds a single "col OP @name" fragment (or a no-param fragment) for one validated filter,
 * binding by name so it can be merged with the inner query's own named parameters. */
function buildFilterFragment(filter, paramName) {
  const col = quoteIdentifier(filter.column);
  switch (filter.op) {
    case 'eq':
      return { sql: `${col} IS @${paramName}`, params: { [paramName]: filter.value } };
    case 'ne':
      return { sql: `${col} IS NOT @${paramName}`, params: { [paramName]: filter.value } };
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
 * own SQL hand-wrote ORDER BY/LIMIT/OFFSET. `filters`/`sort` must already be
 * validated against `describeColumns`' output - identifiers are quoted, not
 * parameterized, so that validation is the only thing standing between a
 * request and raw SQL text.
 */
export function runTableBlockQuery(db, { sqlText, innerParams, filters, sort, offset, limit }) {
  const engineParams = {};
  const whereParts = [];
  filters.forEach((filter, i) => {
    const fragment = buildFilterFragment(filter, `__f${i}`);
    if (!fragment) return;
    whereParts.push(fragment.sql);
    Object.assign(engineParams, fragment.params);
  });
  const whereSql = whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : '';
  const orderSql = sort ? ` ORDER BY ${quoteIdentifier(sort.column)} ${sort.direction}` : '';
  engineParams.__limit = limit;
  engineParams.__offset = offset;

  const wrapped = `SELECT * FROM (${sqlText}) AS block_result${whereSql}${orderSql} LIMIT @__limit OFFSET @__offset`;
  return db.prepare(wrapped).all({ ...innerParams, ...engineParams });
}

export function runWriteQuery(db, sqlText, params) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const info = db.prepare(sqlText).run(params);
    db.exec('COMMIT');
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // rollback failing means the transaction was already gone - ignore
    }
    throw err;
  }
}
