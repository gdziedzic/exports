import { html } from './escape.js';

const MAX_BINARY_PREVIEW_BYTES = 16;

function toHex(bytes) {
  return [...bytes.slice(0, MAX_BINARY_PREVIEW_BYTES)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

/**
 * Renders one browse-table cell value with type-aware, distinct handling
 * for NULL vs empty string vs boolean vs binary, per the browse-table spec.
 * Returns { className, content } where className goes on the <td>.
 */
export function renderCellValue(value, logicalType) {
  if (value === null || value === undefined) {
    return { className: 'cell-null', content: html`NULL` };
  }

  if (value instanceof Uint8Array) {
    const preview = toHex(value);
    const suffix = value.length > MAX_BINARY_PREVIEW_BYTES ? '...' : '';
    return { className: 'cell-binary', content: html`<code>${preview}${suffix}</code> (${value.length} bytes)` };
  }

  if (typeof value === 'string' && value === '') {
    return { className: 'cell-empty', content: html`` };
  }

  if (logicalType === 'boolean') {
    const truthy = value === 1 || value === '1' || value === true;
    return { className: 'cell-boolean', content: html`<span class="badge">${truthy ? 'true' : 'false'}</span>` };
  }

  return { className: '', content: html`${String(value)}` };
}
