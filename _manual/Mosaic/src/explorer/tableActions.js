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
import { referencedParamNames } from '../config/pages.js';
import { executeWriteAction } from '../pages/blockExecutor.js';

function requireWritable(source, metadata) {
  if (!source.allowWrites) throw new HttpError(403, 'This source does not permit writes.');
  if (!metadata.writable) throw new HttpError(403, metadata.readOnlyReason ?? 'This table is read-only.');
}

function findAction(tableActions, actionId, source, table) {
  const action = tableActions.findForTable(actionId, source.id, table.schema, table.name);
  if (!action) throw new HttpError(404, 'Custom action not found.');
  return action;
}

function renderNewActionForm(res, { status = 200, source, table, existingActions, values, errors, csrfToken }) {
  const basePath = buildPath('sources', source.id, table.schema, table.name);
  const body = html`
    ${breadcrumbs(tableBreadcrumbs(source, table.name, [{ label: 'Add custom action' }]))}
    <h1>Add a custom action for ${table.name}</h1>
    <p class="help-text">
      The SQL runs once per row selected on the browse page, with every column of that row
      available as a same-named parameter - e.g. <code>UPDATE ${table.name} SET counter = counter + 1
      WHERE id = @id</code> to increment a counter. A reference to a column that doesn't exist on
      this table is rejected below.
    </p>
    ${errors._form ? html`<div class="panel panel-error" role="alert">${errors._form}</div>` : ''}
    <form method="post" action="${basePath}/actions" class="stack">
      <input type="hidden" name="${CSRF_FIELD_NAME}" value="${csrfToken}">
      <div>
        <label for="action-label">Button label</label>
        <input type="text" id="action-label" name="label" value="${values.label ?? ''}" required maxlength="80">
        ${errors.label ? html`<p class="field-error">${errors.label}</p>` : ''}
      </div>
      <div>
        <label for="action-sql">SQL to run per selected row</label>
        <textarea id="action-sql" name="sql" rows="6" required>${values.sql ?? ''}</textarea>
        ${errors.sql ? html`<p class="field-error">${errors.sql}</p>` : ''}
      </div>
      <button type="submit" class="button-primary">Add action</button>
      <a class="button" href="${basePath}">Cancel</a>
    </form>

    ${existingActions.length > 0
      ? html`<h2>Existing actions</h2>
          <ul>
            ${existingActions.map(
              (action) => html`<li>
                <strong>${action.label}</strong> - <code>${action.sql}</code>
                <form method="post" action="${basePath}/actions/${action.id}/delete" class="inline-form">
                  <input type="hidden" name="${CSRF_FIELD_NAME}" value="${csrfToken}">
                  <button type="submit" class="button-danger">Delete</button>
                </form>
              </li>`,
            )}
          </ul>`
      : ''}
  `;
  noStore(res);
  sendHtml(res, status, pageShell({ title: `Add custom action - ${table.name}`, bodyHtml: body, activeNav: 'home' }));
}

export async function handleNewTableActionForm(req, res, params, { sources, settings, tableActions }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  requireWritable(source, metadata);

  const csrfToken = ensureCsrfToken(req, res);
  const existingActions = tableActions.listForTable(source.id, table.schema, table.name);
  renderNewActionForm(res, { source, table, existingActions, values: {}, errors: {}, csrfToken });
}

export async function handleCreateTableAction(req, res, params, { sources, settings, tableActions, logger, requestId }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  requireWritable(source, metadata);

  const body = await parseFormBody(req, settings.maxRequestBodyBytes);
  verifyCsrf(req, body.get(CSRF_FIELD_NAME));

  const label = (body.get('label') ?? '').trim();
  const sql = (body.get('sql') ?? '').trim();
  const errors = {};
  if (!label) errors.label = 'Label is required.';
  else if (label.length > 80) errors.label = 'Label must be 80 characters or fewer.';
  if (!sql) errors.sql = 'SQL is required.';

  if (!errors.sql) {
    const columnNames = new Set(metadata.columns.map((c) => c.name));
    const unknown = [...referencedParamNames(sql)].filter((name) => !columnNames.has(name));
    if (unknown.length > 0) {
      errors.sql = `References column${unknown.length === 1 ? '' : 's'} not on this table: ${unknown.map((n) => `@${n}`).join(', ')}`;
    }
  }

  if (Object.keys(errors).length > 0) {
    const csrfToken = ensureCsrfToken(req, res);
    const existingActions = tableActions.listForTable(source.id, table.schema, table.name);
    renderNewActionForm(res, { status: 400, source, table, existingActions, values: { label, sql }, errors, csrfToken });
    return;
  }

  tableActions.add({ sourceId: source.id, schema: table.schema, table: table.name, label, sql });
  logger.info('table_action_created', { requestId, sourceId: source.id, table: table.name });

  const basePath = buildPath('sources', source.id, table.schema, table.name);
  redirect(res, `${basePath}?flash=action-created`);
}

/**
 * POST target of a custom action's button on the table browser. Mirrors bulk delete's
 * review/execute shape: re-loads each selected row (a stale/tampered key drops silently) and
 * shows what will run before doing anything.
 */
export async function handleTableActionReview(req, res, params, { sources, settings, tableActions }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  requireWritable(source, metadata);
  const action = findAction(tableActions, params.actionId, source, table);

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
    redirect(res, `${basePath}?flash=action-ran&n=0`);
    return;
  }

  const csrfToken = ensureCsrfToken(req, res);
  const executeAction = `${basePath}/actions/${action.id}/execute`;

  const bodyHtml = html`
    ${breadcrumbs(tableBreadcrumbs(source, table.name, [{ label: action.label }]))}
    <h1>${action.label} on ${rows.length} ${table.name} record${rows.length === 1 ? '' : 's'}?</h1>
    <p class="help-text">This runs: <code>${action.sql}</code></p>
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
    <form method="post" action="${executeAction}">
      <input type="hidden" name="${CSRF_FIELD_NAME}" value="${csrfToken}">
      ${rows.map(({ keyValues }) => html`<input type="hidden" name="rowKey" value="${encodeRowKey(metadata.keyColumns, keyValues)}">`)}
      <button type="submit" class="button-primary">Confirm</button>
      <a class="button" href="${basePath}">Cancel</a>
    </form>
  `;

  noStore(res);
  sendHtml(res, 200, pageShell({ title: `${action.label} - ${table.name}`, bodyHtml, activeNav: 'home' }));
}

/** Executes the action's SQL once per selected row, binding that row's own column values as
 * named parameters (see src/pages/blockExecutor.js's executeWriteAction). One row's failure
 * doesn't abort the rest, matching bulk delete's "one row's error doesn't fail the batch". */
export async function handleTableActionExecute(req, res, params, { sources, settings, tableActions, logger, requestId }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  requireWritable(source, metadata);
  const action = findAction(tableActions, params.actionId, source, table);

  const body = await parseFormBody(req, settings.maxRequestBodyBytes);
  verifyCsrf(req, body.get(CSRF_FIELD_NAME));

  const keyValuesList = decodeSelectedKeys(body.getAll('rowKey'), metadata.keyColumns);
  const basePath = buildPath('sources', source.id, table.schema, table.name);

  let succeeded = 0;
  let failed = 0;
  for (const keyValues of keyValuesList) {
    const row = await adapter.getRowByKey(table.schema, table.name, metadata.keyColumns, keyValues);
    if (!row) continue; // already gone since the review step - not a failure

    try {
      await executeWriteAction({ adapter, sql: action.sql, paramValues: new Map(Object.entries(row)) });
      succeeded++;
    } catch (err) {
      failed++;
      logger.error('table_action_row_failed', {
        requestId,
        sourceId: source.id,
        table: table.name,
        actionId: action.id,
        errorMessage: err.message,
      });
    }
  }

  logger.info('table_action_completed', { requestId, sourceId: source.id, table: table.name, actionId: action.id, succeeded, failed });

  const flashParams = new URLSearchParams({ flash: 'action-ran', n: String(succeeded) });
  if (failed > 0) flashParams.set('failed', String(failed));
  redirect(res, `${basePath}?${flashParams.toString()}`);
}

export async function handleDeleteTableAction(req, res, params, { sources, settings, tableActions, logger, requestId }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  requireWritable(source, metadata);
  const action = findAction(tableActions, params.actionId, source, table);

  const body = await parseFormBody(req, settings.maxRequestBodyBytes);
  verifyCsrf(req, body.get(CSRF_FIELD_NAME));

  tableActions.remove(action.id);
  logger.info('table_action_deleted', { requestId, sourceId: source.id, table: table.name, actionId: action.id });

  const basePath = buildPath('sources', source.id, table.schema, table.name);
  redirect(res, `${basePath}?flash=action-deleted`);
}
