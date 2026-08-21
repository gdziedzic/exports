export { OPERATORS_BY_LOGICAL_TYPE, coerceFormValue } from '../logicalTypes.js';

/**
 * Maps a SQLite declared column type to a logical type used to pick filter
 * operators and form controls. SQLite type affinity is name-based, not
 * enforced, so this is necessarily a heuristic over the declared type text.
 */
export function classifySqliteType(sqlType) {
  const t = (sqlType ?? '').toUpperCase();
  if (t.includes('BOOL')) return 'boolean';
  if (t.includes('BLOB')) return 'binary';
  if (t.includes('DATETIME') || t.includes('TIMESTAMP')) return 'datetime';
  if (t.includes('DATE')) return 'date';
  if (t.includes('TIME')) return 'time';
  if (t.includes('INT')) return 'integer';
  if (t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB') || t.includes('NUMERIC') || t.includes('DECIMAL')) {
    return 'decimal';
  }
  if (t.includes('CHAR') || t.includes('TEXT') || t.includes('CLOB')) return 'text';
  return 'text';
}
