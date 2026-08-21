import { html, buildPath, toQueryString } from './escape.js';
import { renderCellValue } from './cellValue.js';
import { browseStateToParams } from '../explorer/browseParams.js';
import { encodeRowKey } from '../explorer/rowKey.js';
import { CSRF_FIELD_NAME } from '../http/csrf.js';
import { nextSortDirection, sortArrow, filterOperatorOptions } from './browseControls.js';

function browseUrl(basePath, state) {
  return `${basePath}${toQueryString(browseStateToParams(state))}`;
}

function searchForm(basePath, state, columns, classifyType) {
  const searchable = columns.some((c) => classifyType(c.sqlType) === 'text');
  if (!searchable) return '';
  return html`<form method="get" action="${basePath}" class="search-form">
    ${state.sort ? html`<input type="hidden" name="sort" value="${state.sort.column}"><input type="hidden" name="dir" value="${state.sort.direction.toLowerCase()}">` : ''}
    ${state.pageSize ? html`<input type="hidden" name="pageSize" value="${state.pageSize}">` : ''}
    ${state.visibleColumns ? html`<input type="hidden" name="cols" value="${[...state.visibleColumns].join(',')}">` : ''}
    ${state.filters.map(
      (f) => html`<input type="hidden" name="f_op_${f.column}" value="${f.op}">${'value' in f ? html`<input type="hidden" name="f_val_${f.column}" value="${f.value}">` : ''}`,
    )}
    <input type="search" name="q" value="${state.search?.term ?? ''}" placeholder="Search all text columns...">
    <button type="submit" class="button-primary">Search</button>
    ${state.search ? html`<a class="button" href="${browseUrl(basePath, { ...state, search: null, page: 1 })}">Clear search</a>` : ''}
  </form>`;
}

function filterForm(basePath, state, columns, classifyType, operatorsByType) {
  const activeByColumn = new Map(state.filters.map((f) => [f.column, f]));
  return html`<details class="panel" ${state.filters.length > 0 ? html`open` : ''}>
    <summary>Filters${state.filters.length > 0 ? ` (${state.filters.length} active)` : ''}</summary>
    <form method="get" action="${basePath}">
      ${state.sort ? html`<input type="hidden" name="sort" value="${state.sort.column}"><input type="hidden" name="dir" value="${state.sort.direction.toLowerCase()}">` : ''}
      ${state.pageSize ? html`<input type="hidden" name="pageSize" value="${state.pageSize}">` : ''}
      ${state.visibleColumns ? html`<input type="hidden" name="cols" value="${[...state.visibleColumns].join(',')}">` : ''}
      ${state.search?.term ? html`<input type="hidden" name="q" value="${state.search.term}">` : ''}
      <div class="table-scroll">
        <table>
          <thead><tr><th>Column</th><th>Condition</th><th>Value</th></tr></thead>
          <tbody>
            ${columns.map((col) => {
              const logicalType = classifyType(col.sqlType);
              const active = activeByColumn.get(col.name);
              const options = filterOperatorOptions(logicalType, active?.op, operatorsByType);
              if (options === '') return html``;
              return html`<tr>
                <td>${col.name}</td>
                <td><select name="f_op_${col.name}">${options}</select></td>
                <td><input type="text" name="f_val_${col.name}" value="${active && 'value' in active ? active.value : ''}"></td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>
      <button type="submit" class="button-primary">Apply filters</button>
      <a class="button" href="${browseUrl(basePath, { ...state, filters: [], page: 1 })}">Clear all filters</a>
    </form>
  </details>`;
}

function columnVisibilityForm(basePath, state, columns) {
  const visible = state.visibleColumns ?? new Set(columns.map((c) => c.name));
  return html`<details class="panel">
    <summary>Columns</summary>
    <form method="get" action="${basePath}">
      ${state.sort ? html`<input type="hidden" name="sort" value="${state.sort.column}"><input type="hidden" name="dir" value="${state.sort.direction.toLowerCase()}">` : ''}
      ${state.pageSize ? html`<input type="hidden" name="pageSize" value="${state.pageSize}">` : ''}
      ${state.search?.term ? html`<input type="hidden" name="q" value="${state.search.term}">` : ''}
      ${state.filters.map(
        (f) => html`<input type="hidden" name="f_op_${f.column}" value="${f.op}">${'value' in f ? html`<input type="hidden" name="f_val_${f.column}" value="${f.value}">` : ''}`,
      )}
      ${columns.map(
        (col) => html`<label><input type="checkbox" name="cols" value="${col.name}" ${visible.has(col.name) ? html`checked` : ''}> ${col.name}</label> `,
      )}
      <button type="submit" class="button-primary">Apply</button>
    </form>
  </details>`;
}

function formatExecutedParams(params) {
  if (!params) return '';
  if (Array.isArray(params)) {
    if (params.length === 0) return '';
    return params.map((v, i) => `?${i + 1} = ${JSON.stringify(v)}`).join('\n');
  }
  const entries = Object.entries(params);
  if (entries.length === 0) return '';
  return entries.map(([name, v]) => `@${name} = ${JSON.stringify(v)}`).join('\n');
}

/** A collapsible panel showing the actual SELECT sent to the database for the current
 * filters/sort/pagination, plus its bound parameter values - useful for debugging a filter
 * that isn't matching what's expected, or just to see what Mosaic is doing under the hood. */
function sqlDebugPanel(executedSql, executedParams) {
  if (!executedSql) return '';
  const paramsText = formatExecutedParams(executedParams);
  return html`<details class="panel">
    <summary>Show SQL</summary>
    <pre class="sql-output">${executedSql}</pre>
    ${paramsText ? html`<p class="help-text">Bound parameters:</p><pre class="sql-output">${paramsText}</pre>` : ''}
  </details>`;
}

function sortLink(basePath, state, columnName) {
  const nextDirection = nextSortDirection(state.sort, columnName);
  const arrow = sortArrow(state.sort, columnName);
  return html`<a href="${browseUrl(basePath, { ...state, sort: { column: columnName, direction: nextDirection }, page: 1 })}">${columnName}${arrow}</a>`;
}

function paginationControls(basePath, state, total, totalPages) {
  const page = Math.min(state.page, totalPages);
  return html`<p class="help-text">
    ${total} row${total === 1 ? '' : 's'} - page ${page} of ${totalPages}
    ${page > 1 ? html` - <a href="${browseUrl(basePath, { ...state, page: page - 1 })}">Previous</a>` : ''}
    ${page < totalPages ? html` - <a href="${browseUrl(basePath, { ...state, page: page + 1 })}">Next</a>` : ''}
  </p>`;
}

export function renderBrowseTable({
  basePath,
  sourceId,
  schema,
  tableName,
  state,
  columns,
  classifyType,
  operatorsByType,
  rows,
  total,
  keyColumns,
  writable,
  selectable = writable && keyColumns.length > 0,
  customActions = [],
  foreignKeyByColumn,
  csrfToken,
  executedSql,
  executedParams,
}) {
  const visibleColumns = state.visibleColumns ? columns.filter((c) => state.visibleColumns.has(c.name)) : columns;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const pageOutOfRange = rows.length === 0 && total > 0 && state.page > totalPages;
  // Bulk delete (and other write actions) needs the table to actually be writable; selecting
  // rows to generate INSERT statements from doesn't, so `selectable` is the broader condition
  // that controls whether the checkbox column/form appear at all.
  const bulkDeletable = writable && selectable;

  const table = html`
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            ${selectable ? html`<th><input type="checkbox" data-select-all-rows aria-label="Select all rows"></th>` : ''}
            ${visibleColumns.map((col) => html`<th>${sortLink(basePath, state, col.name)}</th>`)}
            ${writable ? html`<th>Actions</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${rows.length === 0
            ? html`<tr><td colspan="${visibleColumns.length + (writable ? 1 : 0) + (selectable ? 1 : 0)}">${pageOutOfRange ? `This page is out of range - showing 0 of ${total} rows.` : 'No rows match the current filters or search.'}</td></tr>`
            : rows.map((row) => {
                const rowKey = keyColumns.length > 0 ? encodeRowKey(keyColumns, row) : null;
                return html`<tr>
                  ${selectable ? html`<td>${rowKey ? html`<input type="checkbox" name="rowKey" value="${rowKey}">` : ''}</td>` : ''}
                  ${visibleColumns.map((col) => {
                    const { className, content } = renderCellValue(row[col.name], classifyType(col.sqlType));
                    const fk = foreignKeyByColumn?.get(col.name);
                    const cellContent =
                      fk && row[col.name] !== null
                        ? html`<a href="${buildPath('sources', fk.sourceId, fk.schema, fk.table, 'rows', fk.rowKey(row[col.name]))}">${content}</a>`
                        : content;
                    return html`<td class="${className}">${cellContent}</td>`;
                  })}
                  ${writable
                    ? html`<td>
                        ${rowKey
                          ? html`<a href="${buildPath('sources', sourceId, schema, tableName, 'rows', rowKey)}">view</a>
                              - <a href="${buildPath('sources', sourceId, schema, tableName, 'rows', rowKey, 'edit')}">edit</a>
                              - <a href="${buildPath('sources', sourceId, schema, tableName, 'rows', rowKey, 'delete')}">delete</a>`
                          : ''}
                      </td>`
                    : ''}
                </tr>`;
              })}
        </tbody>
      </table>
    </div>
  `;

  if (!selectable) {
    return html`
      ${searchForm(basePath, state, columns, classifyType)}
      ${filterForm(basePath, state, columns, classifyType, operatorsByType)}
      ${columnVisibilityForm(basePath, state, columns)}
      ${sqlDebugPanel(executedSql, executedParams)}
      ${paginationControls(basePath, state, total, totalPages)}
      ${table}
    `;
  }

  const generateInsertAction = `${basePath}/generate-insert`;

  return html`
    ${searchForm(basePath, state, columns, classifyType)}
    ${filterForm(basePath, state, columns, classifyType, operatorsByType)}
    ${columnVisibilityForm(basePath, state, columns)}
    ${sqlDebugPanel(executedSql, executedParams)}
    ${paginationControls(basePath, state, total, totalPages)}

    <form method="post" action="${generateInsertAction}">
      <input type="hidden" name="${CSRF_FIELD_NAME}" value="${csrfToken}">
      ${state.visibleColumns ? html`<input type="hidden" name="cols" value="${[...state.visibleColumns].join(',')}">` : ''}
      ${table}
      <p class="row-action-buttons">
        <button type="submit" formaction="${generateInsertAction}" class="button">Generate INSERT for selected</button>
        ${bulkDeletable
          ? html`<button type="submit" formaction="${basePath}/bulk-delete/review" class="button-danger">Delete selected</button>`
          : ''}
        ${bulkDeletable
          ? customActions.map(
              (action) =>
                html` <button type="submit" formaction="${basePath}/actions/${action.id}/review" class="button">${action.label}</button>`,
            )
          : ''}
      </p>
    </form>
  `;
}
