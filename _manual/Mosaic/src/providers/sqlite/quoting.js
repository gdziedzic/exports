/** Quotes a SQLite identifier (table, column, index name). Doubles embedded quotes. */
export function quoteIdentifier(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

export function qualifiedColumn(table, column) {
  return `${quoteIdentifier(table)}.${quoteIdentifier(column)}`;
}
