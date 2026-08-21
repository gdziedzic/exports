// Renders SQL literal text for the "Generate INSERT" feature. This is a
// display/export convenience, not a query the app itself executes - the
// generated text is meant to be copy-pasted (e.g. into another environment),
// so it uses real SQL literal syntax rather than parameter placeholders.

function sqlStringLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex').toUpperCase();
}

/** Formats one column value as a SQL literal for `provider`, honoring the column's logical
 * type (so e.g. a 0/1 SQLite boolean still reads as a literal boolean value) and each
 * provider's own binary-literal syntax (SQL Server's `0x...` vs SQLite's `X'...'`). */
export function formatSqlLiteral(value, logicalType, provider) {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Uint8Array) {
    return provider === 'sqlserver' ? `0x${bytesToHex(value)}` : `X'${bytesToHex(value)}'`;
  }
  if (logicalType === 'boolean') {
    const truthy = value === 1 || value === '1' || value === true;
    return truthy ? '1' : '0';
  }
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return sqlStringLiteral(value);
}

/** Builds one `INSERT INTO ... VALUES (...);` statement for `row`, restricted to `columns`
 * (the caller decides which - e.g. only the currently visible browse-table columns). */
export function buildInsertStatement({ provider, quoteIdentifier, schema, tableName, columns, classifyType, row }) {
  const qualifiedTable = provider === 'sqlserver' ? `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}` : quoteIdentifier(tableName);
  const columnList = columns.map((c) => quoteIdentifier(c.name)).join(', ');
  const valueList = columns.map((c) => formatSqlLiteral(row[c.name], classifyType(c.sqlType), provider)).join(', ');
  return `INSERT INTO ${qualifiedTable} (${columnList}) VALUES (${valueList});`;
}
