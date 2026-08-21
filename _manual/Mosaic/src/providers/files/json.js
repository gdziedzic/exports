import fs from 'node:fs/promises';
import { assertFileSizeWithinLimit } from './limits.js';

export class JsonParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'JsonParseError';
  }
}

function isScalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

/**
 * Reads and parses a JSON file whose root is either an array of objects, or
 * an object with a configured `rootProperty` containing that array. Not
 * streamed - the whole (size-bounded) file is parsed at once, per the
 * documented limitation that a single top-level JSON array can't be safely
 * streamed without a streaming JSON parser dependency.
 */
export async function parseJsonFile(filePath, { rootProperty, maxFileSizeBytes, maxRecordCount, encoding = 'utf8' }) {
  assertFileSizeWithinLimit(filePath, maxFileSizeBytes);
  const text = await fs.readFile(filePath, encoding);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new JsonParseError(`Invalid JSON: ${err.message}`);
  }

  let array;
  if (Array.isArray(parsed)) {
    array = parsed;
  } else if (rootProperty) {
    const candidate = parsed && typeof parsed === 'object' ? parsed[rootProperty] : undefined;
    if (!Array.isArray(candidate)) {
      throw new JsonParseError(`Configured rootProperty "${rootProperty}" was not found or is not an array.`);
    }
    array = candidate;
  } else {
    throw new JsonParseError('JSON root is not an array; configure rootProperty to point at the record array.');
  }

  const truncated = array.length > maxRecordCount;
  const limited = truncated ? array.slice(0, maxRecordCount) : array;

  const columnSet = new Set();
  const warnings = [];
  const records = [];

  limited.forEach((item, index) => {
    if (Array.isArray(item)) {
      warnings.push({ line: null, message: `Record ${index + 1} is an array, not an object; skipped.` });
      return;
    }
    if (item !== null && typeof item === 'object') {
      const record = {};
      for (const [key, value] of Object.entries(item)) {
        if (isScalar(value)) {
          record[key] = value;
          columnSet.add(key);
        }
      }
      records.push(record);
      return;
    }
    if (isScalar(item)) {
      records.push({ value: item });
      columnSet.add('value');
      return;
    }
    warnings.push({ line: null, message: `Record ${index + 1} could not be represented as a row; skipped.` });
  });

  return { columns: [...columnSet], records, truncated, warnings };
}
