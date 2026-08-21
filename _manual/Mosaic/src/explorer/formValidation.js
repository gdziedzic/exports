/**
 * Validates and type-coerces submitted form fields against column metadata.
 * Skips generated/computed columns always, and skips key columns in edit
 * mode (their values come from the URL, never the body). Returns
 * { values, errors } - `values` only contains columns that should be
 * written; `errors` is keyed by column name.
 */
export function validateAndCoerceFields({ columns, classifyType, coerceFormValue, formValues, mode, keyColumns }) {
  const values = {};
  const errors = {};

  for (const column of columns) {
    if (column.isGenerated) continue;
    const logicalType = classifyType(column.sqlType);
    if (logicalType === 'binary') continue;
    if (mode === 'edit' && keyColumns.includes(column.name)) continue;

    const isIdentityInsert = mode === 'insert' && column.isIdentity;
    // On insert, a NOT NULL column with a DEFAULT doesn't need a value - the
    // database fills it in. On UPDATE there is no such fallback (DEFAULT
    // only applies to inserted rows), so any NOT NULL column is required
    // once editing, regardless of whether it has a DEFAULT clause.
    const required = mode === 'edit' ? !column.nullable : !isIdentityInsert && !column.nullable && column.defaultValue === null;

    const raw = formValues.get(column.name);
    const isBlank = raw === null || raw === undefined || raw.trim?.() === '';

    if (isBlank) {
      if (required) {
        errors[column.name] = 'This field is required.';
      } else if (mode === 'edit') {
        // Editing an existing row: a blank field is the user clearing it to NULL.
        values[column.name] = null;
      }
      // Insert, non-required, blank: omit entirely so the column's DEFAULT
      // (or NULL, if no default) applies naturally rather than forcing NULL
      // into a column that has a DEFAULT clause.
      continue;
    }

    if (logicalType === 'boolean') {
      values[column.name] = raw === '1' ? 1 : 0;
      continue;
    }

    const coerced = coerceFormValue(logicalType, raw);
    if ((logicalType === 'integer' || logicalType === 'decimal') && coerced === null) {
      errors[column.name] = logicalType === 'integer' ? 'Must be a whole number.' : 'Must be a number.';
      continue;
    }
    values[column.name] = coerced;
  }

  return { values, errors };
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}
