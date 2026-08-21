import { html, buildPath } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { breadcrumbs, sourceBreadcrumbs } from '../render/breadcrumbs.js';
import { sendHtml } from '../http/respond.js';
import { findSqlSource, getSqlAdapter } from './sqlSourceContext.js';

async function countRows(adapter, schema, tableName) {
  try {
    const { total } = await adapter.queryRows(schema, tableName, { filters: [], sort: null, offset: 0, limit: 1 });
    return total;
  } catch {
    return null;
  }
}

export async function handleSourceOverview(req, res, params, { sources, settings }) {
  const source = findSqlSource(sources, params.sourceId);
  const adapter = getSqlAdapter(source, settings);
  const tables = await adapter.listTablesAndViews();

  const rows = await Promise.all(
    tables.map(async (t) => ({ ...t, rowCount: await countRows(adapter, t.schema, t.name) })),
  );

  const body = html`
    ${breadcrumbs(sourceBreadcrumbs(source))}
    <h1>${source.name}</h1>
    <p class="help-text">
      Provider: <span class="badge">${source.provider}</span>
      ${source.allowWrites ? html`<span class="badge">writes enabled</span>` : html`<span class="badge">read-only source</span>`}
    </p>

    <div class="table-scroll">
      <table>
        <thead>
          <tr><th>Schema</th><th>Name</th><th>Type</th><th>Rows</th></tr>
        </thead>
        <tbody>
          ${rows.length === 0
            ? html`<tr><td colspan="4">No tables or views found.</td></tr>`
            : rows.map(
                (t) => html`<tr>
                  <td>${t.schema}</td>
                  <td><a href="${buildPath('sources', source.id, t.schema, t.name)}">${t.name}</a></td>
                  <td><span class="badge">${t.kind}</span></td>
                  <td>${t.rowCount ?? '-'}</td>
                </tr>`,
              )}
        </tbody>
      </table>
    </div>
  `;

  sendHtml(res, 200, pageShell({ title: source.name, bodyHtml: body, activeNav: 'home' }));
}
