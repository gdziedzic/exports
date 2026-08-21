/**
 * Encodes/decodes the composite (possibly single-column) key used in
 * /rows/:rowKey URLs as a JSON array of values, in `keyColumns` order. The
 * router already applies a single decodeURIComponent to path segments and
 * buildPath()/escapeUrlComponent already apply the matching encode, so
 * callers just pass/receive the raw JSON string as one path segment.
 */
export function encodeRowKey(keyColumns, row) {
  return JSON.stringify(keyColumns.map((col) => row[col]));
}

export class InvalidRowKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidRowKeyError';
  }
}

export function decodeRowKey(rowKeyParam, keyColumns) {
  let values;
  try {
    values = JSON.parse(rowKeyParam);
  } catch {
    throw new InvalidRowKeyError('Malformed row key.');
  }
  if (!Array.isArray(values) || values.length !== keyColumns.length) {
    throw new InvalidRowKeyError('Row key does not match this table\'s key shape.');
  }
  const keyValues = {};
  keyColumns.forEach((col, i) => {
    keyValues[col] = values[i];
  });
  return keyValues;
}

/** Decodes a batch of submitted `rowKey` fields against this table's key shape, dropping
 * duplicates and any malformed/stale key rather than failing the whole batch. Shared by every
 * multi-row form (bulk delete, generate-INSERT, custom table actions). */
export function decodeSelectedKeys(rawKeys, keyColumns) {
  const seen = new Set();
  const keyValuesList = [];
  for (const raw of rawKeys) {
    if (seen.has(raw)) continue;
    seen.add(raw);
    try {
      keyValuesList.push(decodeRowKey(raw, keyColumns));
    } catch (err) {
      if (err instanceof InvalidRowKeyError) continue;
      throw err;
    }
  }
  return keyValuesList;
}
