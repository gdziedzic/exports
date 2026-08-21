/** Maps a raw mssql/tedious error to a safe, user-facing message. Never surfaces raw SQL text. */
export function friendlySqlServerError(err) {
  const number = err?.number;
  if (number === 2627 || number === 2601) {
    return 'This value conflicts with an existing record (a unique value is required).';
  }
  if (number === 547) {
    return 'This references a record that does not exist, or another record still depends on this one.';
  }
  if (number === 515) {
    return 'A required value is missing.';
  }
  if (number === 245) {
    return 'One of the values is not the right type for its column.';
  }
  return 'The database rejected this write.';
}
