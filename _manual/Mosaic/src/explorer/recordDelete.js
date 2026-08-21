import { html, buildPath } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { breadcrumbs, tableBreadcrumbs } from '../render/breadcrumbs.js';
import { renderCellValue } from '../render/cellValue.js';
import { renderOriginalValueFields, decodeOriginalValue } from '../render/recordForm.js';
import { sendHtml } from '../http/respond.js';
import { noStore } from '../http/securityHeaders.js';
import { redirect } from '../http/redirect.js';
import { HttpError } from '../http/errors.js';
import { ensureCsrfToken, verifyCsrf, CSRF_FIELD_NAME } from '../http/csrf.js';
import { parseFormBody } from '../http/body.js';
import { findSqlSource, getSqlAdapter, findTable } from './sqlSourceContext.js';
import { decodeRowKey, InvalidRowKeyError } from './rowKey.js';
import { friendlySqliteError } from '../providers/sqlite/errors.js';
import { friendlySqlServerError } from '../providers/sqlserver/errors.js';

function friendlyDbError(adapter, err) {
  return adapter.provider === 'sqlite' ? friendlySqliteError(err) : friendlySqlServerError(err);
}

function requireWritable(source, metadata) {
  if (!source.allowWrites) throw new HttpError(403, 'This source does not permit writes.');
  if (!metadata.writable) throw new HttpError(403, metadata.readOnlyReason ?? 'This table is read-only.');
}

async function loadRow(adapter, table, metadata, rowKeyParam) {
  let keyValues;
  try {
    keyValues = decodeRowKey(rowKeyParam, metadata.keyColumns);
  } catch (err) {
    if (err instanceof InvalidRowKeyError) throw new HttpError(400, err.message);
    throw err;
  }
  const row = await adapter.getRowByKey(table.schema, table.name, metadata.keyColumns, keyValues);
  if (!row) throw new HttpError(404, 'Record not found.');
  return { keyValues, row };
}

export async function handleDeleteConfirm(req, res, params, { sources, settings }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  requireWritable(source, metadata);

  const { row } = await loadRow(adapter, table, metadata, params.rowKey);
  const csrfToken = ensureCsrfToken(req, res);
  const action = buildPath('sources', source.id, table.schema, table.name, 'rows', params.rowKey, 'delete');

  const body = html`
    ${breadcrumbs(tableBreadcrumbs(source, table.name, [{ label: 'Delete' }]))}
    <h1>Delete this ${table.name} record?</h1>
    <p class="help-text">This cannot be undone.</p>
    <dl>
      ${metadata.keyColumns.map((col) => {
        const { className, content } = renderCellValue(row[col], adapter.classifyType(metadata.columns.find((c) => c.name === col)?.sqlType));
        return html`<dt>${col}</dt><dd class="${className}">${content}</dd>`;
      })}
    </dl>
    <form method="post" action="${action}">
      <input type="hidden" name="${CSRF_FIELD_NAME}" value="${csrfToken}">
      ${renderOriginalValueFields(row)}
      <button type="submit" class="button-danger">Confirm delete</button>
      <a class="button" href="${buildPath('sources', source.id, table.schema, table.name, 'rows', params.rowKey)}">Cancel</a>
    </form>
  `;

  noStore(res);
  sendHtml(res, 200, pageShell({ title: `Delete ${table.name} record`, bodyHtml: body, activeNav: 'home' }));
}

export async function handleDeleteRecord(req, res, params, { sources, settings, logger, requestId }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  requireWritable(source, metadata);

  const { keyValues } = await loadRow(adapter, table, metadata, params.rowKey);
  const body = await parseFormBody(req, settings.maxRequestBodyBytes);
  verifyCsrf(req, body.get(CSRF_FIELD_NAME));

  const originalValues = {};
  for (const column of metadata.columns) {
    if (body.has(`original_${column.name}`)) {
      originalValues[column.name] = decodeOriginalValue(body.get(`original_${column.name}`));
    }
  }

  const basePath = buildPath('sources', source.id, table.schema, table.name);

  try {
    await adapter.deleteRow(table.schema, table.name, metadata, keyValues, originalValues);
  } catch (err) {
    if (err instanceof adapter.ConcurrencyConflictError) {
      throw new HttpError(409, 'This record changed since you loaded it. Reload and try again.');
    }
    if (err instanceof adapter.RecordNotFoundError) {
      redirect(res, `${basePath}?flash=already-deleted`);
      return;
    }
    logger.error('delete_failed', { requestId, sourceId: source.id, table: table.name, errorMessage: err.message });
    throw new HttpError(409, friendlyDbError(adapter, err));
  }

  logger.info('record_deleted', { requestId, sourceId: source.id, table: table.name });
  redirect(res, `${basePath}?flash=deleted`);
}
