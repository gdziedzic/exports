import { html, buildPath } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { breadcrumbs, tableBreadcrumbs } from '../render/breadcrumbs.js';
import { renderRecordFields, renderOriginalValueFields, decodeOriginalValue } from '../render/recordForm.js';
import { sendHtml } from '../http/respond.js';
import { noStore } from '../http/securityHeaders.js';
import { redirect } from '../http/redirect.js';
import { HttpError } from '../http/errors.js';
import { ensureCsrfToken, verifyCsrf, CSRF_FIELD_NAME } from '../http/csrf.js';
import { parseFormBody } from '../http/body.js';
import { findSqlSource, getSqlAdapter, findTable } from './sqlSourceContext.js';
import { decodeRowKey, encodeRowKey, InvalidRowKeyError } from './rowKey.js';
import { validateAndCoerceFields, hasErrors } from './formValidation.js';
import { friendlySqliteError } from '../providers/sqlite/errors.js';
import { friendlySqlServerError } from '../providers/sqlserver/errors.js';

function friendlyDbError(adapter, err) {
  return adapter.provider === 'sqlite' ? friendlySqliteError(err) : friendlySqlServerError(err);
}

function requireWritable(source, metadata) {
  if (!source.allowWrites) throw new HttpError(403, 'This source does not permit writes.');
  if (!metadata.writable) throw new HttpError(403, metadata.readOnlyReason ?? 'This table is read-only.');
}

function formPage({ title, breadcrumbItems, formHtml }) {
  return pageShell({
    title,
    activeNav: 'home',
    bodyHtml: html`${breadcrumbs(breadcrumbItems)}<h1>${title}</h1>${formHtml}`,
  });
}

function renderInsertPage(res, { status = 200, source, table, metadata, adapter, values, errors, csrfToken }) {
  const action = buildPath('sources', source.id, table.schema, table.name, 'new');
  const formHtml = html`${errors._form ? html`<div class="panel panel-error" role="alert">${errors._form}</div>` : ''}
  <form method="post" action="${action}" class="stack">
    <input type="hidden" name="${CSRF_FIELD_NAME}" value="${csrfToken}">
    ${renderRecordFields({
      mode: 'insert',
      columns: metadata.columns,
      classifyType: adapter.classifyType,
      values,
      errors,
      isKeyColumn: () => false,
    })}
    <button type="submit" class="button-primary">Create</button>
  </form>`;
  noStore(res);
  sendHtml(
    res,
    status,
    formPage({ title: `New ${table.name} record`, breadcrumbItems: tableBreadcrumbs(source, table.name, [{ label: 'New' }]), formHtml }),
  );
}

export async function handleNewRecordForm(req, res, params, { sources, settings }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  requireWritable(source, metadata);

  const csrfToken = ensureCsrfToken(req, res);
  renderInsertPage(res, { source, table, metadata, adapter, values: {}, errors: {}, csrfToken });
}

export async function handleCreateRecord(req, res, params, { sources, settings, logger, requestId }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  requireWritable(source, metadata);

  const body = await parseFormBody(req, settings.maxRequestBodyBytes);
  verifyCsrf(req, body.get(CSRF_FIELD_NAME));

  const { values, errors } = validateAndCoerceFields({
    columns: metadata.columns,
    classifyType: adapter.classifyType,
    coerceFormValue: adapter.coerceFormValue,
    formValues: body,
    mode: 'insert',
    keyColumns: metadata.keyColumns,
  });

  if (hasErrors(errors)) {
    const csrfToken = ensureCsrfToken(req, res);
    renderInsertPage(res, { status: 400, source, table, metadata, adapter, values, errors, csrfToken });
    return;
  }

  let row;
  try {
    row = await adapter.insertRow(table.schema, table.name, metadata, values);
  } catch (err) {
    logger.error('insert_failed', {
      requestId,
      sourceId: source.id,
      table: table.name,
      errorMessage: err.message,
    });
    const csrfToken = ensureCsrfToken(req, res);
    renderInsertPage(res, {
      status: 409,
      source,
      table,
      metadata,
      adapter,
      values,
      errors: { _form: friendlyDbError(adapter, err) },
      csrfToken,
    });
    return;
  }

  logger.info('record_created', { requestId, sourceId: source.id, table: table.name });
  const rowKey = encodeRowKey(metadata.keyColumns, row);
  redirect(res, `${buildPath('sources', source.id, table.schema, table.name, 'rows', rowKey)}?flash=created`);
}

async function loadRowForEdit(adapter, table, metadata, rowKeyParam) {
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

function renderEditPage(res, { status = 200, source, table, metadata, adapter, row, values, errors, csrfToken, rowKeyParam }) {
  const action = buildPath('sources', source.id, table.schema, table.name, 'rows', rowKeyParam, 'edit');
  const isKeyColumn = (name) => metadata.keyColumns.includes(name);
  const formHtml = html`${errors._form ? html`<div class="panel panel-error" role="alert">${errors._form}</div>` : ''}
  <form method="post" action="${action}" class="stack">
    <input type="hidden" name="${CSRF_FIELD_NAME}" value="${csrfToken}">
    ${renderOriginalValueFields(row)}
    ${renderRecordFields({
      mode: 'edit',
      columns: metadata.columns,
      classifyType: adapter.classifyType,
      values: { ...row, ...values },
      errors,
      isKeyColumn,
    })}
    <button type="submit" class="button-primary">Save</button>
  </form>`;
  noStore(res);
  sendHtml(
    res,
    status,
    formPage({ title: `Edit ${table.name} record`, breadcrumbItems: tableBreadcrumbs(source, table.name, [{ label: 'Edit' }]), formHtml }),
  );
}

export async function handleEditRecordForm(req, res, params, { sources, settings }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  requireWritable(source, metadata);

  const { row } = await loadRowForEdit(adapter, table, metadata, params.rowKey);
  const csrfToken = ensureCsrfToken(req, res);
  renderEditPage(res, { source, table, metadata, adapter, row, values: {}, errors: {}, csrfToken, rowKeyParam: params.rowKey });
}

export async function handleUpdateRecord(req, res, params, { sources, settings, logger, requestId }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  requireWritable(source, metadata);

  const { keyValues, row } = await loadRowForEdit(adapter, table, metadata, params.rowKey);
  const body = await parseFormBody(req, settings.maxRequestBodyBytes);
  verifyCsrf(req, body.get(CSRF_FIELD_NAME));

  const originalValues = {};
  for (const column of metadata.columns) {
    if (body.has(`original_${column.name}`)) {
      originalValues[column.name] = decodeOriginalValue(body.get(`original_${column.name}`));
    }
  }

  const { values, errors } = validateAndCoerceFields({
    columns: metadata.columns,
    classifyType: adapter.classifyType,
    coerceFormValue: adapter.coerceFormValue,
    formValues: body,
    mode: 'edit',
    keyColumns: metadata.keyColumns,
  });

  if (hasErrors(errors)) {
    const csrfToken = ensureCsrfToken(req, res);
    renderEditPage(res, { status: 400, source, table, metadata, adapter, row, values, errors, csrfToken, rowKeyParam: params.rowKey });
    return;
  }

  let updated;
  try {
    updated = await adapter.updateRow(table.schema, table.name, metadata, keyValues, values, originalValues);
  } catch (err) {
    if (err instanceof adapter.ConcurrencyConflictError) {
      const csrfToken = ensureCsrfToken(req, res);
      renderEditPage(res, {
        status: 409,
        source,
        table,
        metadata,
        adapter,
        row,
        values,
        errors: { _form: 'This record changed since you loaded it. Reload and try again.' },
        csrfToken,
        rowKeyParam: params.rowKey,
      });
      return;
    }
    if (err instanceof adapter.RecordNotFoundError) {
      throw new HttpError(404, 'Record not found - it may have been deleted.');
    }
    logger.error('update_failed', { requestId, sourceId: source.id, table: table.name, errorMessage: err.message });
    const csrfToken = ensureCsrfToken(req, res);
    renderEditPage(res, {
      status: 409,
      source,
      table,
      metadata,
      adapter,
      row,
      values,
      errors: { _form: friendlyDbError(adapter, err) },
      csrfToken,
      rowKeyParam: params.rowKey,
    });
    return;
  }

  logger.info('record_updated', { requestId, sourceId: source.id, table: table.name });
  const newRowKey = encodeRowKey(metadata.keyColumns, updated);
  redirect(res, `${buildPath('sources', source.id, table.schema, table.name, 'rows', newRowKey)}?flash=updated`);
}
