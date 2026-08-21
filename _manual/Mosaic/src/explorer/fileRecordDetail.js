import { html, buildPath } from '../render/escape.js';
import { pageShell } from '../render/layout.js';
import { breadcrumbs } from '../render/breadcrumbs.js';
import { renderCellValue } from '../render/cellValue.js';
import { sendHtml } from '../http/respond.js';
import { HttpError } from '../http/errors.js';
import { findFileSource, loadFileSource } from './fileSourceContext.js';

function inferValueLogicalType(value) {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'decimal';
  return 'text';
}

export async function handleFileRecordDetail(req, res, params, { sources, settings }) {
  const source = findFileSource(sources, params.sourceId);
  const { records } = await loadFileSource(source, settings);

  const index = Number(params.recordIndex);
  if (!Number.isInteger(index) || index < 0 || index >= records.length) {
    throw new HttpError(404, 'Record not found.');
  }
  const row = records[index];

  const body = html`
    ${breadcrumbs([
      { label: 'Sources', href: '/' },
      { label: source.name, href: buildPath('files', source.id) },
      { label: `Record ${index + 1}` },
    ])}
    <h1>${source.name} record ${index + 1}</h1>
    <p class="help-text">Read-only.</p>
    <dl>
      ${Object.entries(row).map(([key, value]) => {
        const { className, content } = renderCellValue(value, inferValueLogicalType(value));
        return html`<dt>${key}</dt><dd class="${className}">${content}</dd>`;
      })}
    </dl>
  `;

  sendHtml(res, 200, pageShell({ title: `${source.name} record ${index + 1}`, bodyHtml: body, activeNav: 'home' }));
}
