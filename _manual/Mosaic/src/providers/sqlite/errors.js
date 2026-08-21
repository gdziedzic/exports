/** Maps a raw node:sqlite constraint error to a safe, user-facing message. Never surfaces raw SQL text. */
export function friendlySqliteError(err) {
  const message = err?.message ?? '';
  if (message.includes('UNIQUE constraint failed')) {
    return 'This value conflicts with an existing record (a unique value is required).';
  }
  if (message.includes('NOT NULL constraint failed')) {
    return 'A required value is missing.';
  }
  if (message.includes('FOREIGN KEY constraint failed')) {
    return 'This references a record that does not exist.';
  }
  if (message.includes('CHECK constraint failed')) {
    return 'This value does not satisfy a database constraint.';
  }
  return 'The database rejected this write.';
}
