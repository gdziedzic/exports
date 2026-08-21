import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseJsonlFile } from '../../../src/providers/files/jsonl.js';
import { FileTooLargeError } from '../../../src/providers/files/limits.js';

function tmpJsonl(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-jsonl-'));
  const filePath = path.join(dir, 'data.jsonl');
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

const defaults = { maxFileSizeBytes: 10_000_000, maxRecordCount: 10_000 };

test('parses one JSON object per line', async () => {
  const file = tmpJsonl('{"a":1}\n{"a":2}\n');
  const { records, columns } = await parseJsonlFile(file, defaults);
  assert.deepEqual(columns, ['a']);
  assert.deepEqual(records, [{ a: 1 }, { a: 2 }]);
});

test('skips blank lines without affecting line numbering of later errors', async () => {
  const file = tmpJsonl('{"a":1}\n\nnot json\n');
  const { records, warnings } = await parseJsonlFile(file, defaults);
  assert.equal(records.length, 1);
  assert.equal(warnings[0].line, 3);
});

test('reports the correct line number for a malformed line and continues parsing', async () => {
  const file = tmpJsonl('{"a":1}\nnope\n{"a":3}\n');
  const { records, warnings } = await parseJsonlFile(file, defaults);
  assert.deepEqual(records, [{ a: 1 }, { a: 3 }]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].line, 2);
});

test('reports a non-object JSON value (array, scalar) as a skipped line', async () => {
  const file = tmpJsonl('[1,2,3]\n"just a string"\n42\n');
  const { records, warnings } = await parseJsonlFile(file, defaults);
  assert.equal(records.length, 0);
  assert.equal(warnings.length, 3);
});

test('collects the union of keys across all lines as columns', async () => {
  const file = tmpJsonl('{"a":1}\n{"b":2}\n');
  const { columns } = await parseJsonlFile(file, defaults);
  assert.deepEqual(columns.sort(), ['a', 'b']);
});

test('stops after maxRecordCount and reports truncated', async () => {
  const lines = Array.from({ length: 10 }, (_, i) => JSON.stringify({ i })).join('\n');
  const file = tmpJsonl(lines + '\n');
  const { records, truncated } = await parseJsonlFile(file, { ...defaults, maxRecordCount: 4 });
  assert.equal(records.length, 4);
  assert.equal(truncated, true);
});

test('rejects a file larger than maxFileSizeBytes before reading it', async () => {
  const file = tmpJsonl('{"a":1}\n');
  await assert.rejects(() => parseJsonlFile(file, { ...defaults, maxFileSizeBytes: 1 }), FileTooLargeError);
});
