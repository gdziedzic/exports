import { html, buildPath } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { breadcrumbs, tableBreadcrumbs } from '../render/breadcrumbs.js';
import { renderCellValue } from '../render/cellValue.js';
import { sendHtml } from '../http/respond.js';
import { noStore } from '../http/securityHeaders.js';
import { redirect } from '../http/redirect.js';
import { HttpError } from '../http/errors.js';
import { ensureCsrfToken, verifyCsrf, CSRF_FIELD_NAME } from '../http/csrf.js';
import { parseFormBody } from '../http/body.js';
import { findSqlSource, getSqlAdapter, findTable } from './sqlSourceContext.js';
import { encodeRowKey, decodeSelectedKeys } from './rowKey.js';

function requireWritable(source, metadata) {
  if (!source.allowWrites) throw new HttpError(403, 'This source does not permit writes.');
  if (!metadata.writable) throw new HttpError(403, metadata.readOnlyReason ?? 'This table is read-only.');
}

/**
 * POST target of the "Delete selected" button on the table browser. Re-loads
 * each selected row (so a stale/tampered key just drops silently, same spirit
 * as a bad sort/filter param) and renders a second confirm step listing what
 * will actually be deleted, mirroring the single-row delete's GET-confirm /
 * POST-execute shape - just POST-POST here since the row-key list comes from
 * checkboxes rather than fitting in a URL.
 */
export async function handleBulkDeleteReview(req, res, params, { sources, settings }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  requireWritable(source, metadata);

  const body = await parseFormBody(req, settings.maxRequestBodyBytes);
  const basePath = buildPath('sources', source.id, table.schema, table.name);

  const rawKeys = body.getAll('rowKey');
  if (rawKeys.length === 0) throw new HttpError(400, 'No rows were selected.');

  const keyValuesList = decodeSelectedKeys(rawKeys, metadata.keyColumns);
  const rows = [];
  for (const keyValues of keyValuesList) {
    const row = await adapter.getRowByKey(table.schema, table.name, metadata.keyColumns, keyValues);
    if (row) rows.push({ keyValues, row });
  }

  if (rows.length === 0) {
    redirect(res, `${basePath}?flash=bulk-deleted&n=0`);
    return;
  }

  const csrfToken = ensureCsrfToken(req, res);
  const action = `${basePath}/bulk-delete`;

  const bodyHtml = html`
    ${breadcrumbs(tableBreadcrumbs(source, table.name, [{ label: 'Delete selected' }]))}
    <h1>Delete ${rows.length} ${table.name} record${rows.length === 1 ? '' : 's'}?</h1>
    <p class="help-text">This cannot be undone.</p>
    <div class="table-scroll">
      <table>
        <thead><tr>${metadata.keyColumns.map((c) => html`<th>${c}</th>`)}</tr></thead>
        <tbody>
          ${rows.map(
            ({ row }) => html`<tr>
              ${metadata.keyColumns.map((c) => {
                const { className, content } = renderCellValue(row[c], adapter.classifyType(metadata.columns.find((col) => col.name === c)?.sqlType));
                return html`<td class="${className}">${content}</td>`;
              })}
            </tr>`,
          )}
        </tbody>
      </table>
    </div>
    <form method="post" action="${action}">
      <input type="hidden" name="${CSRF_FIELD_NAME}" value="${csrfToken}">
      ${rows.map(({ keyValues }) => html`<input type="hidden" name="rowKey" value="${encodeRowKey(metadata.keyColumns, keyValues)}">`)}
      <button type="submit" class="button-danger">Confirm delete</button>
      <a class="button" href="${basePath}">Cancel</a>
    </form>
  `;

  noStore(res);
  sendHtml(res, 200, pageShell({ title: `Delete selected ${table.name} records`, bodyHtml, activeNav: 'home' }));
}

/** Executes the batch, deleting by key only (no optimistic-concurrency check -
 * carrying every original column value for every selected row through the form
 * doesn't scale the way it does for a single-row edit/delete). One row's
 * failure doesn't abort the rest, matching the page-block "one block's error
 * doesn't fail the page" philosophy. */
export async function handleBulkDeleteExecute(req, res, params, { sources, settings, logger, requestId }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  requireWritable(source, metadata);

  const body = await parseFormBody(req, settings.maxRequestBodyBytes);
  verifyCsrf(req, body.get(CSRF_FIELD_NAME));

  const keyValuesList = decodeSelectedKeys(body.getAll('rowKey'), metadata.keyColumns);
  const basePath = buildPath('sources', source.id, table.schema, table.name);

  let deleted = 0;
  let failed = 0;
  for (const keyValues of keyValuesList) {
    try {
      await adapter.deleteRow(table.schema, table.name, metadata, keyValues, {});
      deleted++;
    } catch (err) {
      if (err instanceof adapter.RecordNotFoundError) continue; // already gone since the review step - not a failure
      failed++;
      logger.error('bulk_delete_row_failed', { requestId, sourceId: source.id, table: table.name, errorMessage: err.message });
    }
  }

  logger.info('bulk_delete_completed', { requestId, sourceId: source.id, table: table.name, deleted, failed });

  const flashParams = new URLSearchParams({ flash: 'bulk-deleted', n: String(deleted) });
  if (failed > 0) flashParams.set('failed', String(failed));
  redirect(res, `${basePath}?${flashParams.toString()}`);
}
