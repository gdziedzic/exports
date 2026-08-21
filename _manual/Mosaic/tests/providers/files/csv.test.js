import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCsvFile } from '../../../src/providers/files/csv.js';
import { FileTooLargeError } from '../../../src/providers/files/limits.js';

function tmpCsv(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-csv-'));
  const filePath = path.join(dir, 'data.csv');
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

const defaults = { maxFileSizeBytes: 10_000_000, maxRecordCount: 10_000 };

test('parses a simple header + rows CSV', async () => {
  const file = tmpCsv('a,b,c\n1,2,3\n4,5,6\n');
  const { columns, records } = await parseCsvFile(file, { ...defaults });
  assert.deepEqual(columns, ['a', 'b', 'c']);
  assert.deepEqual(records, [
    { a: '1', b: '2', c: '3' },
    { a: '4', b: '5', c: '6' },
  ]);
});

test('handles quoted fields with embedded delimiters', async () => {
  const file = tmpCsv('name,note\n"Doe, Jane","hello world"\n');
  const { records } = await parseCsvFile(file, { ...defaults });
  assert.deepEqual(records, [{ name: 'Doe, Jane', note: 'hello world' }]);
});

test('handles doubled-quote escaping inside a quoted field', async () => {
  const file = tmpCsv('note\n"She said ""hi"" to me"\n');
  const { records } = await parseCsvFile(file, { ...defaults });
  assert.equal(records[0].note, 'She said "hi" to me');
});

test('handles an embedded newline inside a quoted field', async () => {
  const file = tmpCsv('note\n"line one\nline two"\n');
  const { records } = await parseCsvFile(file, { ...defaults });
  assert.equal(records[0].note, 'line one\nline two');
});

test('handles CRLF line endings without leaking \\r into field values', async () => {
  const file = tmpCsv('a,b\r\n1,2\r\n');
  const { records } = await parseCsvFile(file, { ...defaults });
  assert.deepEqual(records, [{ a: '1', b: '2' }]);
});

test('respects a custom delimiter', async () => {
  const file = tmpCsv('a;b\n1;2\n');
  const { records } = await parseCsvFile(file, { ...defaults, delimiter: ';' });
  assert.deepEqual(records, [{ a: '1', b: '2' }]);
});

test('hasHeader: false generates column_N names and treats the first row as data', async () => {
  const file = tmpCsv('1,2,3\n4,5,6\n');
  const { columns, records } = await parseCsvFile(file, { ...defaults, hasHeader: false });
  assert.deepEqual(columns, ['column_1', 'column_2', 'column_3']);
  assert.equal(records.length, 2);
});

test('skips fully blank lines', async () => {
  const file = tmpCsv('a,b\n1,2\n\n3,4\n');
  const { records } = await parseCsvFile(file, { ...defaults });
  assert.equal(records.length, 2);
});

test('reports an unterminated quoted field as a warning and drops the trailing row, without throwing', async () => {
  const file = tmpCsv('a,b\n"unterminated,x\n');
  const { records, warnings } = await parseCsvFile(file, { ...defaults });
  assert.equal(records.length, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /unterminated/i);
});

test('stops after maxRecordCount and reports truncated', async () => {
  const rows = Array.from({ length: 10 }, (_, i) => `${i}`).join('\n');
  const file = tmpCsv(`a\n${rows}\n`);
  const { records, truncated } = await parseCsvFile(file, { ...defaults, maxRecordCount: 3 });
  assert.equal(records.length, 3);
  assert.equal(truncated, true);
});

test('rejects a file larger than maxFileSizeBytes before reading it', async () => {
  const file = tmpCsv('a,b\n1,2\n');
  await assert.rejects(() => parseCsvFile(file, { ...defaults, maxFileSizeBytes: 1 }), FileTooLargeError);
});

test('handles a value with no closing delimiter at EOF (no trailing newline)', async () => {
  const file = tmpCsv('a,b\n1,2');
  const { records } = await parseCsvFile(file, { ...defaults });
  assert.deepEqual(records, [{ a: '1', b: '2' }]);
});
