function parseIntOr(raw, fallback) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Parses page/pageSize/sort/dir/q/f_<col>/cols query params for a file
 * source. File sources have no declared schema or types, so filtering is
 * uniformly a case-insensitive substring match (per-column via f_<col>, or
 * across every visible scalar field via q) and sorting is a generic
 * numeric-aware comparator - simpler than the DB explorer's typed operator
 * set, matching the fact these are unstructured/semi-structured sources.
 */
export function parseFileBrowseParams(url, { columns, defaultPageSize, maxPageSize }) {
  const params = url.searchParams;
  const page = parseIntOr(params.get('page'), 1);
  const pageSize = Math.min(Math.max(1, parseIntOr(params.get('pageSize'), defaultPageSize)), maxPageSize);

  const columnSet = new Set(columns);

  let sort = null;
  const sortColumn = params.get('sort');
  const sortDir = (params.get('dir') ?? 'asc').toLowerCase();
  if (sortColumn && columnSet.has(sortColumn) && (sortDir === 'asc' || sortDir === 'desc')) {
    sort = { column: sortColumn, direction: sortDir };
  }

  const search = params.get('q')?.trim() || null;

  const columnFilters = [];
  for (const column of columns) {
    const value = params.get(`f_${column}`);
    if (value !== null && value.trim() !== '') {
      columnFilters.push({ column, value });
    }
  }

  let visibleColumns = null;
  if (params.has('cols')) {
    // Accepts both a single comma-joined value (links built via
    // fileBrowseStateToParams) and repeated `cols=` fields (an HTML checkbox
    // group of that name submits one field per checked box).
    const requested = params
      .getAll('cols')
      .flatMap((v) => v.split(','))
      .map((s) => s.trim())
      .filter(Boolean);
    const filtered = new Set(requested.filter((c) => columnSet.has(c)));
    if (filtered.size > 0) visibleColumns = filtered;
  }

  return { page, pageSize, sort, search, columnFilters, visibleColumns };
}

export function fileBrowseStateToParams(state) {
  const out = {};
  if (state.page && state.page !== 1) out.page = state.page;
  if (state.pageSize) out.pageSize = state.pageSize;
  if (state.sort) {
    out.sort = state.sort.column;
    out.dir = state.sort.direction;
  }
  if (state.search) out.q = state.search;
  for (const f of state.columnFilters ?? []) out[`f_${f.column}`] = f.value;
  if (state.visibleColumns) out.cols = [...state.visibleColumns].join(',');
  return out;
}

/** True if `value`'s string form contains `term`, case-insensitively. */
function matchesTerm(value, term) {
  if (value === null || value === undefined) return false;
  return String(value).toLowerCase().includes(term.toLowerCase());
}

export function applyFileBrowseState(records, state) {
  let filtered = records;

  if (state.search) {
    filtered = filtered.filter((row) => Object.values(row).some((v) => matchesTerm(v, state.search)));
  }
  for (const f of state.columnFilters) {
    filtered = filtered.filter((row) => matchesTerm(row[f.column], f.value));
  }

  if (state.sort) {
    const { column, direction } = state.sort;
    const dirMultiplier = direction === 'desc' ? -1 : 1;
    filtered = [...filtered].sort((a, b) => {
      const av = a[column];
      const bv = b[column];
      if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dirMultiplier;
      return String(av).localeCompare(String(bv)) * dirMultiplier;
    });
  }

  const total = filtered.length;
  const offset = (state.page - 1) * state.pageSize;
  const page = filtered.slice(offset, offset + state.pageSize);
  return { rows: page, total };
}
