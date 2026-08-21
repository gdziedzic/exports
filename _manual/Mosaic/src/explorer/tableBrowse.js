import { html, buildPath } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { breadcrumbs, tableBreadcrumbs } from '../render/breadcrumbs.js';
import { renderBrowseTable } from '../render/tableBrowse.js';
import { sendHtml } from '../http/respond.js';
import { ensureCsrfToken } from '../http/csrf.js';
import { findSqlSource, getSqlAdapter, findTable } from './sqlSourceContext.js';
import { parseBrowseParams } from './browseParams.js';
import { buildForeignKeyLinks } from './foreignKeyLinks.js';
import { exportRows } from './export.js';

const FLASH_MESSAGES = {
  deleted: 'Record deleted.',
  'already-deleted': 'That record was already deleted.',
  'action-created': 'Custom action created.',
  'action-deleted': 'Custom action deleted.',
};

function resolveFlash(url) {
  const flashKey = url.searchParams.get('flash');
  if (flashKey === 'bulk-deleted') {
    const n = Number(url.searchParams.get('n')) || 0;
    const failedCount = Number(url.searchParams.get('failed')) || 0;
    return `Deleted ${n} record${n === 1 ? '' : 's'}.${failedCount > 0 ? ` ${failedCount} could not be deleted.` : ''}`;
  }
  if (flashKey === 'action-ran') {
    const n = Number(url.searchParams.get('n')) || 0;
    const failedCount = Number(url.searchParams.get('failed')) || 0;
    return `Action ran on ${n} record${n === 1 ? '' : 's'}.${failedCount > 0 ? ` ${failedCount} failed.` : ''}`;
  }
  return FLASH_MESSAGES[flashKey];
}

export async function handleTableBrowse(req, res, params, { sources, settings, tableActions, url, logger, requestId }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, settings.metadataCacheTtlMs);

  const state = parseBrowseParams(url, {
    columns: metadata.columns,
    classifyType: adapter.classifyType,
    operatorsByType: adapter.operatorsByType,
    coerceFormValue: adapter.coerceFormValue,
    defaultPageSize: settings.pageSize.default,
    maxPageSize: settings.pageSize.max,
  });

  const exportFormat = url.searchParams.get('export');
  if (exportFormat === 'csv' || exportFormat === 'json') {
    await exportRows(res, {
      format: exportFormat,
      filenameBase: table.name,
      settings,
      logger,
      requestId,
      fetchRows: (offset, limit) =>
        adapter.queryRows(table.schema, table.name, {
          filters: state.filters,
          sort: state.sort,
          offset,
          limit,
          keyColumns: metadata.keyColumns,
          search: state.search,
        }),
    });
    return;
  }

  const writable = metadata.writable && source.allowWrites;
  // Row selection (for bulk delete, generate-INSERT, and custom actions) only needs a real key
  // to identify rows by - it doesn't require the table to be writable, since generate-INSERT
  // is a read-only, non-destructive operation.
  const selectable = metadata.keyColumns.length > 0;
  const basePath = buildPath('sources', source.id, table.schema, table.name);

  const { rows, total, executedSql, executedParams } = await adapter.queryRows(table.schema, table.name, {
    filters: state.filters,
    sort: state.sort,
    offset: (state.page - 1) * state.pageSize,
    limit: state.pageSize,
    keyColumns: metadata.keyColumns,
    search: state.search,
  });

  const foreignKeyByColumn = await buildForeignKeyLinks(adapter, source, metadata);
  const csrfToken = selectable ? ensureCsrfToken(req, res) : null;
  const customActions = writable ? tableActions.listForTable(source.id, table.schema, table.name) : [];

  const flash = resolveFlash(url);

  const body = html`
    ${breadcrumbs(tableBreadcrumbs(source, table.name))}
    <h1>${table.name} <span class="badge">${table.kind}</span> <span class="badge">${table.schema}</span></h1>
    ${flash ? html`<div class="panel panel-success">${flash}</div>` : ''}
    ${!metadata.writable
      ? html`<p class="help-text">Read-only: ${metadata.readOnlyReason}</p>`
      : !source.allowWrites
        ? html`<p class="help-text">Read-only: this source does not permit writes.</p>`
        : html`<p>
            <a class="button button-primary" href="${basePath}/new">Insert new</a>
            - <a class="button" href="${basePath}/actions/new">Add custom action</a>
          </p>`}
    <p class="help-text">
      Export: <a href="${basePath}?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), export: 'csv' }).toString()}">CSV</a>
      - <a href="${basePath}?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), export: 'json' }).toString()}">JSON</a>
    </p>
    ${renderBrowseTable({
      basePath,
      sourceId: source.id,
      schema: table.schema,
      tableName: table.name,
      state,
      columns: metadata.columns,
      classifyType: adapter.classifyType,
      operatorsByType: adapter.operatorsByType,
      rows,
      total,
      keyColumns: metadata.keyColumns,
      writable,
      selectable,
      customActions,
      foreignKeyByColumn,
      csrfToken,
      executedSql,
      executedParams,
    })}
  `;

  sendHtml(res, 200, pageShell({ title: table.name, bodyHtml: body, activeNav: 'home' }));
}
