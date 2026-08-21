import { html, buildPath } from './escape.js';
import { renderCellValue } from './cellValue.js';
import { errorPanel } from './layout.js';
import { inferValueLogicalType, OPERATORS_BY_LOGICAL_TYPE } from '../providers/logicalTypes.js';
import { nextSortDirection, sortArrow, filterOperatorOptions } from './browseControls.js';

function blockLink(pagePath, url, blockId, overrides) {
  const params = new URLSearchParams(url.searchParams);
  for (const [key, value] of Object.entries(overrides)) {
    const paramKey = `b_${blockId}_${key}`;
    if (value === null || value === undefined) params.delete(paramKey);
    else params.set(paramKey, String(value));
  }
  const qs = params.toString();
  return `${pagePath}${qs ? `?${qs}` : ''}`;
}

function blockExportLink(pagePath, url, blockId, format) {
  const params = new URLSearchParams(url.searchParams);
  params.set(`b_${blockId}_export`, format);
  return `${pagePath}?${params.toString()}`;
}

function blockSortLink(pagePath, url, blockId, sort, columnName, label) {
  const nextDirection = nextSortDirection(sort, columnName);
  const arrow = sortArrow(sort, columnName);
  const href = blockLink(pagePath, url, blockId, { sort: columnName, dir: nextDirection.toLowerCase(), page: null });
  return html`<a href="${href}">${label ?? columnName}${arrow}</a>`;
}

function blockClearFiltersLink(pagePath, url, blockId, columns) {
  const params = new URLSearchParams(url.searchParams);
  for (const col of columns) {
    params.delete(`b_${blockId}_f_op_${col.name}`);
    params.delete(`b_${blockId}_f_val_${col.name}`);
  }
  params.delete(`b_${blockId}_page`);
  const qs = params.toString();
  return `${pagePath}${qs ? `?${qs}` : ''}`;
}

/**
 * A block's filter form is a plain GET form, and GET forms only submit their
 * own named controls - not the rest of the current URL. Since a page can
 * carry page-level params, other blocks' own state, and this block's own
 * sort/pageSize, "preserve everything else" is done by echoing every
 * current query param as a hidden input except the ones this form's own
 * visible controls (and pagination) own - simpler and more robust than
 * enumerating known state fields by name (which src/render/tableBrowse.js
 * can do because a browse URL has no unrelated params to worry about).
 */
function blockFilterForm(pagePath, url, blockId, columns, filters) {
  const ownedKeys = new Set([`b_${blockId}_page`]);
  for (const col of columns) {
    ownedKeys.add(`b_${blockId}_f_op_${col.name}`);
    ownedKeys.add(`b_${blockId}_f_val_${col.name}`);
  }
  const preserved = [...url.searchParams.entries()].filter(([key]) => !ownedKeys.has(key));
  const activeByColumn = new Map(filters.map((f) => [f.column, f]));

  const rows = columns
    .map((col) => {
      const active = activeByColumn.get(col.name);
      const options = filterOperatorOptions(col.logicalType, active?.op, OPERATORS_BY_LOGICAL_TYPE);
      if (options === '') return null;
      return html`<tr>
        <td>${col.name}</td>
        <td><select name="b_${blockId}_f_op_${col.name}">${options}</select></td>
        <td><input type="text" name="b_${blockId}_f_val_${col.name}" value="${active && 'value' in active ? active.value : ''}"></td>
      </tr>`;
    })
    .filter(Boolean);

  if (rows.length === 0) return '';

  return html`<details class="panel" ${filters.length > 0 ? html`open` : ''}>
    <summary>Filters${filters.length > 0 ? ` (${filters.length} active)` : ''}</summary>
    <form method="get" action="${pagePath}">
      ${preserved.map(([key, value]) => html`<input type="hidden" name="${key}" value="${value}">`)}
      <div class="table-scroll">
        <table>
          <thead><tr><th>Column</th><th>Condition</th><th>Value</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <button type="submit" class="button-primary">Apply filters</button>
      <a class="button" href="${blockClearFiltersLink(pagePath, url, blockId, columns)}">Clear filters</a>
    </form>
  </details>`;
}

function renderTable(block, result, pagePath, url) {
  const rows = result.rows;
  const columns = result.columns ?? [];
  const columnMeta = new Map((block.columns ?? []).map((c) => [c.name, c]));
  const visibleColumns = columns.filter((c) => !columnMeta.get(c.name)?.hidden);

  return html`
    ${blockFilterForm(pagePath, url, block.id, columns, result.filters ?? [])}
    <div class="table-scroll">
      <table>
        <thead>
          <tr>${visibleColumns.map((c) => html`<th>${blockSortLink(pagePath, url, block.id, result.sort, c.name, columnMeta.get(c.name)?.label)}</th>`)}</tr>
        </thead>
        <tbody>
          ${rows.length === 0
            ? html`<tr><td colspan="${visibleColumns.length || 1}">No rows.</td></tr>`
            : rows.map(
                (row) => html`<tr>
                  ${visibleColumns.map((c) => {
                    const { className, content } = renderCellValue(row[c.name], c.logicalType);
                    return html`<td class="${className}">${content}</td>`;
                  })}
                </tr>`,
              )}
        </tbody>
      </table>
    </div>
  `;
}

function renderSingleRecord(block, result) {
  if (!result.row) return html`<p class="help-text">No record.</p>`;
  return html`
    ${result.hasExtraRows ? html`<p class="help-text">This query returned more than one row; only the first is shown.</p>` : ''}
    <dl>
      ${Object.entries(result.row).map(([key, value]) => {
        const { className, content } = renderCellValue(value, inferValueLogicalType(value));
        return html`<dt>${key}</dt><dd class="${className}">${content}</dd>`;
      })}
    </dl>
  `;
}

function renderScalar(result) {
  const { className, content } = renderCellValue(result.value, inferValueLogicalType(result.value));
  return html`
    ${result.hasExtraColumns ? html`<p class="help-text">This query returned more than one column; only the first is shown.</p>` : ''}
    ${result.hasExtraRows ? html`<p class="help-text">This query returned more than one row; only the first is shown.</p>` : ''}
    <p class="scalar-value ${className}">${content}</p>
  `;
}

export function renderBlock({ pageId, page, block, url, status }) {
  const pagePath = buildPath('pages', pageId);
  const widthClass = block.width === 'half' ? 'block-half' : 'block-full';

  let bodyHtml;
  if (status.state === 'blocked') {
    bodyHtml = html`<p class="help-text">Waiting for required parameters.</p>`;
  } else if (status.state === 'error') {
    bodyHtml = errorPanel({
      title: 'This block failed to load',
      message: status.message,
      correlationId: status.correlationId,
      retryHref: pagePath,
    });
  } else if (status.result.kind === 'table') {
    bodyHtml = renderTable(block, status.result, pagePath, url);
  } else if (status.result.kind === 'single-record') {
    bodyHtml = renderSingleRecord(block, status.result);
  } else {
    bodyHtml = renderScalar(status.result);
  }

  const isTable = block.presentation === 'table';
  const showPagination = isTable && status.state === 'ok';
  const showExports = status.state === 'ok' && (block.allowCsvExport || block.allowJsonExport);

  return html`<section class="panel ${widthClass}" aria-labelledby="block-${block.id}-title">
    <h2 id="block-${block.id}-title">${block.title}</h2>
    ${block.description ? html`<p class="help-text">${block.description}</p>` : ''}
    ${bodyHtml}
    ${showPagination
      ? html`<p class="help-text">
          Page ${status.result.page}
          ${status.result.page > 1 ? html` - <a href="${blockLink(pagePath, url, block.id, { page: status.result.page - 1 })}">Previous</a>` : ''}
          ${status.result.hasNextPage ? html` - <a href="${blockLink(pagePath, url, block.id, { page: status.result.page + 1 })}">Next</a>` : ''}
        </p>`
      : ''}
    ${showExports
      ? html`<p class="help-text">
          Export:
          ${block.allowCsvExport ? html` <a href="${blockExportLink(pagePath, url, block.id, 'csv')}">CSV</a>` : ''}
          ${block.allowJsonExport ? html` <a href="${blockExportLink(pagePath, url, block.id, 'json')}">JSON</a>` : ''}
        </p>`
      : ''}
    ${status.state === 'ok' && block.writeActions?.length > 0
      ? html`<p class="help-text">
          Actions:
          ${block.writeActions.map((action) => {
            const href = `${buildPath('pages', pageId, 'actions', action.id)}?${url.searchParams.toString()}`;
            return html` <a class="button ${action.destructive ? 'button-danger' : ''}" href="${href}">${action.label}</a>`;
          })}
        </p>`
      : ''}
  </section>`;
}
