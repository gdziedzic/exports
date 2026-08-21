import { html, buildPath } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { breadcrumbs, tableBreadcrumbs } from '../render/breadcrumbs.js';
import { sendHtml } from '../http/respond.js';
import { noStore } from '../http/securityHeaders.js';
import { HttpError } from '../http/errors.js';
import { verifyCsrf, CSRF_FIELD_NAME } from '../http/csrf.js';
import { parseFormBody } from '../http/body.js';
import { findSqlSource, getSqlAdapter, findTable } from './sqlSourceContext.js';
import { decodeSelectedKeys } from './rowKey.js';
import { buildInsertStatement } from './insertStatement.js';

/**
 * POST target of the "Generate INSERT for selected" button on the table
 * browser. Unlike bulk delete, this never touches the database - it's a
 * read-only convenience that renders `INSERT INTO ...` text for the
 * selected rows, restricted to whichever columns are currently visible in
 * the browse table. Available even for read-only sources/tables, since
 * generating text isn't a write; only a real row key (to re-fetch the
 * selected rows) is required.
 */
export async function handleGenerateInsert(req, res, params, { sources, settings }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, 0);
  const basePath = buildPath('sources', source.id, table.schema, table.name);

  if (metadata.keyColumns.length === 0) {
    throw new HttpError(400, 'Rows in this table cannot be uniquely selected.');
  }

  const body = await parseFormBody(req, settings.maxRequestBodyBytes);
  verifyCsrf(req, body.get(CSRF_FIELD_NAME));

  const rawKeys = body.getAll('rowKey');
  if (rawKeys.length === 0) throw new HttpError(400, 'No rows were selected.');

  const keyValuesList = decodeSelectedKeys(rawKeys, metadata.keyColumns);
  const rows = [];
  for (const keyValues of keyValuesList) {
    const row = await adapter.getRowByKey(table.schema, table.name, metadata.keyColumns, keyValues);
    if (row) rows.push(row);
  }

  const requestedCols = body.get('cols');
  const requestedNames = requestedCols
    ? requestedCols
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
  const columnsForInsert = requestedNames
    ? metadata.columns.filter((c) => requestedNames.includes(c.name))
    : metadata.columns;
  const insertColumns = columnsForInsert.length > 0 ? columnsForInsert : metadata.columns;

  const statements = rows.map((row) =>
    buildInsertStatement({
      provider: adapter.provider,
      quoteIdentifier: adapter.quoteIdentifier,
      schema: table.schema,
      tableName: table.name,
      columns: insertColumns,
      classifyType: adapter.classifyType,
      row,
    }),
  );

  const sqlText = statements.join('\n');
  const rowCount = rows.length;

  const bodyHtml = html`
    ${breadcrumbs(tableBreadcrumbs(source, table.name, [{ label: 'Generate INSERT' }]))}
    <h1>Generated INSERT for ${rowCount} ${table.name} record${rowCount === 1 ? '' : 's'}</h1>
    ${rowCount === 0
      ? html`<p class="help-text">None of the selected rows could be found anymore.</p>`
      : html`<p class="help-text">
          Only the currently visible column${insertColumns.length === 1 ? '' : 's'} (${insertColumns.map((c) => c.name).join(', ')}) are included.
        </p>
        <textarea readonly rows="${Math.min(Math.max(statements.length, 4), 24)}" class="sql-output" data-select-on-focus>${sqlText}</textarea>`}
    <p><a class="button" href="${basePath}">Back</a></p>
  `;

  noStore(res);
  sendHtml(res, 200, pageShell({ title: `Generate INSERT - ${table.name}`, bodyHtml, activeNav: 'home' }));
}
