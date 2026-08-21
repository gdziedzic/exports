import { html, buildPath } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { breadcrumbs } from '../render/breadcrumbs.js';
import { renderFileBrowseTable } from '../render/fileBrowse.js';
import { sendHtml } from '../http/respond.js';
import { findFileSource, loadFileSource } from './fileSourceContext.js';
import { parseFileBrowseParams, applyFileBrowseState } from './fileBrowseParams.js';
import { exportRows } from './export.js';

export async function handleFileBrowse(req, res, params, { sources, settings, url, logger, requestId }) {
  const source = findFileSource(sources, params.sourceId);
  const { columns, records, truncated, warnings } = await loadFileSource(source, settings);
  const indexed = records.map((row, i) => ({ ...row, __index: i }));

  const state = parseFileBrowseParams(url, {
    columns,
    defaultPageSize: settings.pageSize.default,
    maxPageSize: settings.pageSize.max,
  });

  const exportFormat = url.searchParams.get('export');
  if (exportFormat === 'csv' || exportFormat === 'json') {
    await exportRows(res, {
      format: exportFormat,
      filenameBase: source.id,
      settings,
      logger,
      requestId,
      fetchRows: async () => {
        const { rows } = applyFileBrowseState(indexed, { ...state, page: 1, pageSize: settings.exportLimits.maxRows });
        return { rows: rows.map(({ __index, ...rest }) => rest) };
      },
    });
    return;
  }

  const { rows, total } = applyFileBrowseState(indexed, state);
  const basePath = buildPath('files', source.id);

  const body = html`
    ${breadcrumbs([{ label: 'Sources', href: '/' }, { label: source.name }])}
    <h1>${source.name} <span class="badge">${source.provider}</span> <span class="badge">read-only</span></h1>
    ${truncated
      ? html`<p class="help-text">This file has more rows than the configured limit (${settings.fileLimits.maxRecordCount}); only the first ${records.length} are shown.</p>`
      : ''}
    <p class="help-text">
      Export: <a href="${basePath}?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), export: 'csv' }).toString()}">CSV</a>
      - <a href="${basePath}?${new URLSearchParams({ ...Object.fromEntries(url.searchParams), export: 'json' }).toString()}">JSON</a>
    </p>
    ${renderFileBrowseTable({ basePath, sourceId: source.id, state, columns, rows, total, warnings })}
  `;

  sendHtml(res, 200, pageShell({ title: source.name, bodyHtml: body, activeNav: 'home' }));
}
