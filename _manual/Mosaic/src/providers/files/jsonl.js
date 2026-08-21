import fs from 'node:fs';
import readline from 'node:readline';
import { assertFileSizeWithinLimit } from './limits.js';

function isScalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

/**
 * Streams a JSON Lines file, parsing each non-empty line as one JSON
 * object. Malformed lines are skipped with their line number recorded in
 * `warnings`, rather than failing the whole file.
 */
export async function parseJsonlFile(filePath, { maxFileSizeBytes, maxRecordCount, encoding = 'utf8' }) {
  assertFileSizeWithinLimit(filePath, maxFileSizeBytes);

  const records = [];
  const warnings = [];
  const columnSet = new Set();
  let truncated = false;

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding }),
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    if (line.trim() === '') continue;

    if (records.length >= maxRecordCount) {
      truncated = true;
      rl.close();
      break;
    }

    let obj;
    try {
      obj = JSON.parse(line);
    } catch (err) {
      warnings.push({ line: lineNumber, message: `Malformed JSON: ${err.message}` });
      continue;
    }
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      warnings.push({ line: lineNumber, message: 'Line is not a JSON object; skipped.' });
      continue;
    }

    const record = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isScalar(value)) {
        record[key] = value;
        columnSet.add(key);
      }
    }
    records.push(record);
  }

  return { columns: [...columnSet], records, truncated, warnings };
}
