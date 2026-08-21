import { OPERATORS_BY_LOGICAL_TYPE, coerceFormValue } from '../providers/logicalTypes.js';

const NO_VALUE_OPS = new Set(['isnull', 'isnotnull', 'true', 'false']);

/**
 * Parses b_<blockId>_sort/dir/f_op_<col>/f_val_<col> query params for one
 * table block against its introspected [{name, logicalType}] columns -
 * block-scoped counterpart to src/explorer/browseParams.js, using the same
 * "silently drop anything invalid" philosophy (a shareable URL survives a
 * query/schema change; nothing unvalidated ever reaches SQL). `columns`
 * already carries a `logicalType` per entry (see rawQuery.js's
 * describeColumns), so there's no separate classifyType needed here.
 */
export function parseBlockBrowseParams(url, blockId, columns) {
  const params = url.searchParams;
  const columnByName = new Map(columns.map((c) => [c.name, c]));

  let sort = null;
  const sortColumn = params.get(`b_${blockId}_sort`);
  const sortDir = (params.get(`b_${blockId}_dir`) ?? 'asc').toLowerCase();
  if (sortColumn && columnByName.has(sortColumn) && (sortDir === 'asc' || sortDir === 'desc')) {
    sort = { column: sortColumn, direction: sortDir === 'desc' ? 'DESC' : 'ASC' };
  }

  const filters = [];
  for (const column of columns) {
    const op = params.get(`b_${blockId}_f_op_${column.name}`);
    if (!op) continue;
    const allowedOps = OPERATORS_BY_LOGICAL_TYPE[column.logicalType] ?? [];
    if (!allowedOps.includes(op)) continue;

    if (NO_VALUE_OPS.has(op)) {
      filters.push({ column: column.name, op, logicalType: column.logicalType });
    } else {
      const rawValue = params.get(`b_${blockId}_f_val_${column.name}`);
      if (rawValue !== null && rawValue !== '') {
        const value = coerceFormValue(column.logicalType, rawValue);
        if (value !== null) filters.push({ column: column.name, op, logicalType: column.logicalType, value });
      }
    }
  }

  return { sort, filters };
}

/** Builds the query-string params for a link that changes this block's sort/filter state
 * while preserving everything else on the URL (the caller merges this into the full param set). */
export function blockBrowseStateToParams(blockId, state) {
  const out = {};
  if (state.sort) {
    out[`b_${blockId}_sort`] = state.sort.column;
    out[`b_${blockId}_dir`] = state.sort.direction.toLowerCase();
  }
  for (const filter of state.filters ?? []) {
    out[`b_${blockId}_f_op_${filter.column}`] = filter.op;
    if ('value' in filter) out[`b_${blockId}_f_val_${filter.column}`] = filter.value;
  }
  return out;
}
