export { OPERATORS_BY_LOGICAL_TYPE, coerceFormValue } from '../logicalTypes.js';

const INTEGER_TYPES = new Set(['tinyint', 'smallint', 'int', 'bigint']);
const DECIMAL_TYPES = new Set(['decimal', 'numeric', 'float', 'real', 'money', 'smallmoney']);
const DATETIME_TYPES = new Set(['datetime', 'datetime2', 'smalldatetime', 'datetimeoffset']);
const BINARY_TYPES = new Set(['binary', 'varbinary', 'image', 'timestamp', 'rowversion']);

/**
 * Maps a SQL Server INFORMATION_SCHEMA.COLUMNS DATA_TYPE value to a logical
 * type. uniqueidentifier (GUID) and xml/sql_variant fall back to "text" -
 * they behave as plain strings for filtering/editing purposes here.
 */
export function classifySqlServerType(dataType) {
  const t = (dataType ?? '').toLowerCase();
  if (t === 'bit') return 'boolean';
  if (INTEGER_TYPES.has(t)) return 'integer';
  if (DECIMAL_TYPES.has(t)) return 'decimal';
  if (t === 'date') return 'date';
  if (t === 'time') return 'time';
  if (DATETIME_TYPES.has(t)) return 'datetime';
  if (BINARY_TYPES.has(t)) return 'binary';
  return 'text';
}
