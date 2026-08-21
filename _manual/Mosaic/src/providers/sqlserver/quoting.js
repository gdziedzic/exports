/** Quotes a SQL Server identifier (schema, table, column). Doubles embedded ]. */
export function quoteIdentifier(name) {
  return '[' + String(name).replace(/]/g, ']]') + ']';
}

export function qualifiedTable(schema, table) {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

export function qualifiedColumn(schema, table, column) {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}.${quoteIdentifier(column)}`;
}
