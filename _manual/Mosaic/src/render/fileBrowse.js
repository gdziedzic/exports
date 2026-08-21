import { html, buildPath, toQueryString } from './escape.js';
import { renderCellValue } from './cellValue.js';
import { fileBrowseStateToParams } from '../explorer/fileBrowseParams.js';

function inferValueLogicalType(value) {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'decimal';
  return 'text';
}

function browseUrl(basePath, state) {
  return `${basePath}${toQueryString(fileBrowseStateToParams(state))}`;
}

function searchAndFilterForm(basePath, state, columns) {
  const filterByColumn = new Map(state.columnFilters.map((f) => [f.column, f.value]));
  return html`<details class="panel" ${state.search || state.columnFilters.length > 0 ? html`open` : ''}>
    <summary>Search &amp; filters${state.columnFilters.length > 0 ? ` (${state.columnFilters.length} column filter${state.columnFilters.length === 1 ? '' : 's'})` : ''}</summary>
    <form method="get" action="${basePath}">
      ${state.sort ? html`<input type="hidden" name="sort" value="${state.sort.column}"><input type="hidden" name="dir" value="${state.sort.direction}">` : ''}
      ${state.pageSize ? html`<input type="hidden" name="pageSize" value="${state.pageSize}">` : ''}
      ${state.visibleColumns ? html`<input type="hidden" name="cols" value="${[...state.visibleColumns].join(',')}">` : ''}
      <label for="q">Search all columns</label>
      <input type="text" id="q" name="q" value="${state.search ?? ''}" placeholder="Search...">
      <div class="table-scroll">
        <table>
          <thead><tr><th>Column</th><th>Contains</th></tr></thead>
          <tbody>
            ${columns.map((col) => html`<tr><td>${col}</td><td><input type="text" name="f_${col}" value="${filterByColumn.get(col) ?? ''}"></td></tr>`)}
          </tbody>
        </table>
      </div>
      <button type="submit" class="button-primary">Apply</button>
      <a class="button" href="${browseUrl(basePath, { ...state, search: null, columnFilters: [], page: 1 })}">Clear all filters</a>
    </form>
  </details>`;
}

function sortLink(basePath, state, columnName) {
  const nextDirection = state.sort?.column === columnName && state.sort.direction === 'asc' ? 'desc' : 'asc';
  const arrow = state.sort?.column === columnName ? (state.sort.direction === 'asc' ? ' ↑' : ' ↓') : '';
  return html`<a href="${browseUrl(basePath, { ...state, sort: { column: columnName, direction: nextDirection }, page: 1 })}">${columnName}${arrow}</a>`;
}

function paginationControls(basePath, state, total) {
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const page = Math.min(state.page, totalPages);
  return html`<p class="help-text">
    ${total} row${total === 1 ? '' : 's'} - page ${page} of ${totalPages}
    ${page > 1 ? html` - <a href="${browseUrl(basePath, { ...state, page: page - 1 })}">Previous</a>` : ''}
    ${page < totalPages ? html` - <a href="${browseUrl(basePath, { ...state, page: page + 1 })}">Next</a>` : ''}
  </p>`;
}

export function renderFileBrowseTable({ basePath, sourceId, state, columns, rows, total, warnings }) {
  const visibleColumns = state.visibleColumns ? columns.filter((c) => state.visibleColumns.has(c)) : columns;

  return html`
    ${warnings.length > 0
      ? html`<div class="panel panel-error">
          <p>${warnings.length} row${warnings.length === 1 ? '' : 's'} could not be parsed:</p>
          <ul>${warnings.slice(0, 20).map((w) => html`<li>${w.line !== null && w.line !== undefined ? `Line ${w.line}: ` : ''}${w.message}</li>`)}</ul>
          ${warnings.length > 20 ? html`<p class="help-text">...and ${warnings.length - 20} more.</p>` : ''}
        </div>`
      : ''}
    ${searchAndFilterForm(basePath, state, columns)}
    ${paginationControls(basePath, state, total)}
    <div class="table-scroll">
      <table>
        <thead>
          <tr>${visibleColumns.map((col) => html`<th>${sortLink(basePath, state, col)}</th>`)}<th>Actions</th></tr>
        </thead>
        <tbody>
          ${rows.length === 0
            ? html`<tr><td colspan="${visibleColumns.length + 1}">No rows match the current search/filters.</td></tr>`
            : rows.map(
                (row) => html`<tr>
                  ${visibleColumns.map((col) => {
                    const { className, content } = renderCellValue(row[col], inferValueLogicalType(row[col]));
                    return html`<td class="${className}">${content}</td>`;
                  })}
                  <td><a href="${buildPath('files', sourceId, 'records', row.__index)}">view</a></td>
                </tr>`,
              )}
        </tbody>
      </table>
    </div>
  `;
}
