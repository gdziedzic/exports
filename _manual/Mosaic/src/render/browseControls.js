import { html } from './escape.js';

/** Human labels for filter operators, shared by the automatic table browser
 * (src/render/tableBrowse.js) and configured-page table blocks (src/render/pageBlocks.js). */
export const OP_LABELS = {
  eq: 'Equals',
  ne: 'Not equals',
  contains: 'Contains',
  startswith: 'Starts with',
  endswith: 'Ends with',
  gt: 'Greater than',
  gte: 'Greater or equal',
  lt: 'Less than',
  lte: 'Less or equal',
  isnull: 'Is NULL',
  isnotnull: 'Is not NULL',
  true: 'Is true',
  false: 'Is false',
};

/** The direction a sort link for `columnName` should switch to next - toggles when it's
 * already the active sort column, otherwise starts ascending. */
export function nextSortDirection(currentSort, columnName) {
  return currentSort?.column === columnName && currentSort.direction === 'ASC' ? 'DESC' : 'ASC';
}

/** The " ↑"/" ↓" suffix for a column header, or '' when it's not the active sort column. */
export function sortArrow(currentSort, columnName) {
  if (currentSort?.column !== columnName) return '';
  return currentSort.direction === 'ASC' ? ' ↑' : ' ↓';
}

/** The <option> list for one column's operator <select>, restricted to the operators valid
 * for its logical type. Returns '' (an empty column) when the type has no operators at all
 * (e.g. binary), so the caller can skip rendering a filter row entirely for that column. */
export function filterOperatorOptions(logicalType, activeOp, operatorsByType) {
  const ops = operatorsByType[logicalType] ?? [];
  if (ops.length === 0) return '';
  return html`<option value="">-</option>
    ${ops.map((op) => html`<option value="${op}" ${activeOp === op ? html`selected` : ''}>${OP_LABELS[op] ?? op}</option>`)}`;
}
