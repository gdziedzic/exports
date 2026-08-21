import { html, buildPath } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { breadcrumbs, tableBreadcrumbs } from '../render/breadcrumbs.js';
import { renderCellValue } from '../render/cellValue.js';
import { sendHtml } from '../http/respond.js';
import { HttpError } from '../http/errors.js';
import { findSqlSource, getSqlAdapter, findTable } from './sqlSourceContext.js';
import { decodeRowKey, InvalidRowKeyError } from './rowKey.js';
import { buildForeignKeyLinks } from './foreignKeyLinks.js';

const FLASH_MESSAGES = {
  created: 'Record created.',
  updated: 'Record saved.',
};

export async function handleRecordDetail(req, res, params, { sources, settings, url }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const table = await findTable(adapter, params.schema, params.table);
  const metadata = await adapter.getTableMetadata(table.schema, table.name, table.kind, settings.metadataCacheTtlMs);

  if (metadata.keyColumns.length === 0) {
    throw new HttpError(400, 'This table has no usable key, so individual records cannot be addressed.');
  }

  let keyValues;
  try {
    keyValues = decodeRowKey(params.rowKey, metadata.keyColumns);
  } catch (err) {
    if (err instanceof InvalidRowKeyError) throw new HttpError(400, err.message);
    throw err;
  }

  const row = await adapter.getRowByKey(table.schema, table.name, metadata.keyColumns, keyValues);
  if (!row) throw new HttpError(404, 'Record not found.');

  const writable = metadata.writable && source.allowWrites;
  const basePath = buildPath('sources', source.id, table.schema, table.name, 'rows', params.rowKey);

  const flash = FLASH_MESSAGES[url.searchParams.get('flash')];
  const foreignKeyByColumn = await buildForeignKeyLinks(adapter, source, metadata);

  const body = html`
    ${breadcrumbs(tableBreadcrumbs(source, table.name, [{ label: 'Record' }]))}
    <h1>${table.name} record</h1>
    ${flash ? html`<div class="panel panel-success">${flash}</div>` : ''}
    ${writable
      ? html`<p><a class="button" href="${basePath}/edit">Edit</a> <a class="button button-danger" href="${basePath}/delete">Delete</a></p>`
      : html`<p class="help-text">Read-only.</p>`}
    <dl>
      ${metadata.columns.map((col) => {
        const { className, content } = renderCellValue(row[col.name], adapter.classifyType(col.sqlType));
        const fk = foreignKeyByColumn.get(col.name);
        const value =
          fk && row[col.name] !== null
            ? html`<a href="${buildPath('sources', fk.sourceId, fk.schema, fk.table, 'rows', fk.rowKey(row[col.name]))}">${content}</a>`
            : content;
        return html`<dt>${col.name}</dt><dd class="${className}">${value}</dd>`;
      })}
    </dl>
  `;

  sendHtml(res, 200, pageShell({ title: `${table.name} record`, bodyHtml: body, activeNav: 'home' }));
}
