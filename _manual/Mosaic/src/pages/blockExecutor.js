import { referencedParamNames } from '../config/pages.js';
import { createTtlCache } from '../providers/cache.js';

const blockColumnsCache = createTtlCache();

function bindInnerParams(sql, paramValues) {
  const params = {};
  for (const name of referencedParamNames(sql)) {
    if (paramValues.has(name)) params[name] = paramValues.get(name);
  }
  return params;
}

/**
 * Describes a table block's result columns (name + inferred logical type),
 * TTL-cached per page+block so a normal page load doesn't pay for a real
 * introspection query on every request. See each provider's rawQuery.js
 * (describeColumns) for what this actually runs.
 */
export async function describeTableBlockColumns({ adapter, pageId, block, sql, paramValues, ttlMs }) {
  const cacheKey = `${pageId}::${block.id}`;
  const cached = blockColumnsCache.get(cacheKey, ttlMs);
  if (cached) return cached;

  const innerParams = bindInnerParams(sql, paramValues);
  const columns = await adapter.describeTableBlockColumns(sql, innerParams);
  blockColumnsCache.set(cacheKey, columns);
  return columns;
}

/**
 * Executes a table block with engine-owned sort/filter/pagination - the
 * block's own SQL is just `SELECT ... FROM ... [WHERE ...]` (no ORDER
 * BY/LIMIT/OFFSET; validated at config-load time in config/pages.js).
 * `sort`/`filters` must already be validated against
 * `describeTableBlockColumns`' output (see pages/blockBrowseParams.js) -
 * this function trusts them and quotes their identifiers directly.
 */
export async function executeTableBlock({ adapter, block, sql, paramValues, page, pageSize, sort, filters }) {
  const innerParams = bindInnerParams(sql, paramValues);
  const offset = (page - 1) * pageSize;
  const fetchSize = pageSize + 1;

  const rows = await adapter.runTableBlockQuery({ sqlText: sql, innerParams, filters, sort, offset, limit: fetchSize });

  const hasNextPage = rows.length > pageSize;
  return { kind: 'table', rows: hasNextPage ? rows.slice(0, pageSize) : rows, hasNextPage, page, pageSize };
}

/**
 * Executes a "scalar" or "single-record" block - "table" blocks go through
 * executeTableBlock instead (see caller in explorer/pageRender.js). Binds
 * only the parameters the block's SQL actually references (required by
 * node:sqlite, which throws on an unreferenced bound name, and generally
 * good practice for SQL Server too). @Offset/@PageSize remain available to
 * these presentations for an author's own manual "top N" style query, bound
 * as 0/pageSize respectively - pagination as a concept doesn't apply here.
 */
export async function executeBlock({ adapter, block, sql, paramValues, pageSize }) {
  const referenced = referencedParamNames(sql);

  const params = {};
  for (const name of referenced) {
    if (name === 'Offset') {
      params.Offset = 0;
    } else if (name === 'PageSize') {
      params.PageSize = pageSize;
    } else if (paramValues.has(name)) {
      params[name] = paramValues.get(name);
    }
  }

  const rows = await adapter.runSelectQuery(sql, params);

  if (block.presentation === 'scalar') {
    const firstRow = rows[0];
    const keys = firstRow ? Object.keys(firstRow) : [];
    return {
      kind: 'scalar',
      value: firstRow ? firstRow[keys[0]] : null,
      hasExtraRows: rows.length > 1,
      hasExtraColumns: keys.length > 1,
    };
  }

  return { kind: 'single-record', row: rows[0] ?? null, hasExtraRows: rows.length > 1 };
}

export async function executeWriteAction({ adapter, sql, paramValues }) {
  const referenced = referencedParamNames(sql);
  const params = {};
  for (const name of referenced) {
    if (paramValues.has(name)) params[name] = paramValues.get(name);
  }
  return adapter.runWriteQuery(sql, params);
}
