const NO_VALUE_OPS = new Set(['isnull', 'isnotnull', 'true', 'false']);

function parseIntOr(raw, fallback) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Parses page/pageSize/sort/dir/f_op_<col>+f_val_<col>/cols query params
 * against real column metadata. One operator field per column keeps the
 * filter form simple (a single <select> + <input> pair per column) and
 * keeps parsing simple to match. Anything that doesn't match a real column,
 * a real operator for that column's logical type, an allowlisted sort
 * direction, or a value that coerces cleanly for the column's logical type
 * (via coerceFormValue - e.g. a non-numeric string against an integer/decimal
 * column) is silently dropped rather than erroring the whole page - the URL
 * stays shareable even after a schema changes, and nothing unvalidated ever
 * reaches SQL.
 */
export function parseBrowseParams(url, { columns, classifyType, operatorsByType, coerceFormValue, defaultPageSize, maxPageSize }) {
  const params = url.searchParams;
  const page = parseIntOr(params.get('page'), 1);
  const pageSize = Math.min(Math.max(1, parseIntOr(params.get('pageSize'), defaultPageSize)), maxPageSize);

  const columnNames = new Set(columns.map((c) => c.name));

  let sort = null;
  const sortColumn = params.get('sort');
  const sortDir = (params.get('dir') ?? 'asc').toLowerCase();
  if (sortColumn && columnNames.has(sortColumn) && (sortDir === 'asc' || sortDir === 'desc')) {
    sort = { column: sortColumn, direction: sortDir === 'desc' ? 'DESC' : 'ASC' };
  }

  const filters = [];
  for (const column of columns) {
    const op = params.get(`f_op_${column.name}`);
    if (!op) continue;
    const logicalType = classifyType(column.sqlType);
    const allowedOps = operatorsByType[logicalType] ?? [];
    if (!allowedOps.includes(op)) continue;

    if (NO_VALUE_OPS.has(op)) {
      filters.push({ column: column.name, op, logicalType });
    } else {
      const rawValue = params.get(`f_val_${column.name}`);
      if (rawValue !== null && rawValue !== '') {
        const value = coerceFormValue(logicalType, rawValue);
        if (value !== null) filters.push({ column: column.name, op, logicalType, value });
      }
    }
  }

  let visibleColumns = null;
  if (params.has('cols')) {
    // Accepts both a single comma-joined value (links built via
    // browseStateToParams) and repeated `cols=` fields (an HTML checkbox
    // group of that name submits one field per checked box).
    const requested = params
      .getAll('cols')
      .flatMap((v) => v.split(','))
      .map((s) => s.trim())
      .filter(Boolean);
    const filtered = new Set(requested.filter((c) => columnNames.has(c)));
    if (filtered.size > 0) visibleColumns = filtered;
  }

  // A single "q" box is easier to reach for than per-column filters when you just want
  // "find the row with this in it" - it OR's a LIKE across every text-logical-type column
  // (the same identifier-validation/quoting path as a per-column filter, just applied to a
  // fixed list instead of one chosen column). Restricted to text columns since LIKE against
  // non-text types is inconsistent/error-prone across providers.
  let search = null;
  const rawSearch = params.get('q');
  if (rawSearch && rawSearch.trim()) {
    const searchColumns = columns.filter((c) => classifyType(c.sqlType) === 'text').map((c) => c.name);
    if (searchColumns.length > 0) search = { term: rawSearch.trim(), columns: searchColumns };
  }

  return { page, pageSize, sort, filters, visibleColumns, search };
}

/** Builds the query-string params for links that change one aspect of browse state while preserving the rest. */
export function browseStateToParams(state) {
  const out = {};
  if (state.page && state.page !== 1) out.page = state.page;
  if (state.pageSize) out.pageSize = state.pageSize;
  if (state.sort) {
    out.sort = state.sort.column;
    out.dir = state.sort.direction.toLowerCase();
  }
  for (const filter of state.filters ?? []) {
    out[`f_op_${filter.column}`] = filter.op;
    if ('value' in filter) out[`f_val_${filter.column}`] = filter.value;
  }
  if (state.visibleColumns) {
    out.cols = [...state.visibleColumns].join(',');
  }
  if (state.search?.term) out.q = state.search.term;
  return out;
}
