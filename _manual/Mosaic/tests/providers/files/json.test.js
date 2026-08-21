import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseJsonFile, JsonParseError } from '../../../src/providers/files/json.js';
import { FileTooLargeError } from '../../../src/providers/files/limits.js';

function tmpJson(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-json-'));
  const filePath = path.join(dir, 'data.json');
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

const defaults = { maxFileSizeBytes: 10_000_000, maxRecordCount: 10_000 };

test('parses a root array of objects', async () => {
  const file = tmpJson(JSON.stringify([{ a: 1, b: 'x' }, { a: 2, b: 'y' }]));
  const { columns, records } = await parseJsonFile(file, { ...defaults, rootProperty: undefined });
  assert.deepEqual(columns.sort(), ['a', 'b']);
  assert.deepEqual(records, [{ a: 1, b: 'x' }, { a: 2, b: 'y' }]);
});

test('parses a configured rootProperty containing the record array', async () => {
  const file = tmpJson(JSON.stringify({ meta: 'x', items: [{ a: 1 }] }));
  const { records } = await parseJsonFile(file, { ...defaults, rootProperty: 'items' });
  assert.deepEqual(records, [{ a: 1 }]);
});

test('throws JsonParseError when the root is not an array and no rootProperty is configured', async () => {
  const file = tmpJson(JSON.stringify({ a: 1 }));
  await assert.rejects(() => parseJsonFile(file, { ...defaults, rootProperty: undefined }), JsonParseError);
});

test('throws JsonParseError when rootProperty does not exist or is not an array', async () => {
  const file = tmpJson(JSON.stringify({ a: 1 }));
  await assert.rejects(() => parseJsonFile(file, { ...defaults, rootProperty: 'missing' }), JsonParseError);
});

test('throws JsonParseError with a clear message on malformed JSON, never a raw parser stack', async () => {
  const file = tmpJson('{ not json');
  await assert.rejects(() => parseJsonFile(file, { ...defaults, rootProperty: undefined }), JsonParseError);
});

test('infers columns only from scalar properties, skipping nested objects/arrays', async () => {
  const file = tmpJson(JSON.stringify([{ id: 1, name: 'x', meta: { nested: true }, tags: ['a', 'b'] }]));
  const { columns, records } = await parseJsonFile(file, { ...defaults, rootProperty: undefined });
  assert.deepEqual(columns.sort(), ['id', 'name']);
  assert.deepEqual(records[0], { id: 1, name: 'x' });
});

test('wraps a primitive array element as a single "value" column', async () => {
  const file = tmpJson(JSON.stringify(['a', 'b', 'c']));
  const { columns, records } = await parseJsonFile(file, { ...defaults, rootProperty: undefined });
  assert.deepEqual(columns, ['value']);
  assert.deepEqual(records, [{ value: 'a' }, { value: 'b' }, { value: 'c' }]);
});

test('skips a nested-array element with a warning instead of throwing', async () => {
  const file = tmpJson(JSON.stringify([{ id: 1 }, [1, 2, 3]]));
  const { records, warnings } = await parseJsonFile(file, { ...defaults, rootProperty: undefined });
  assert.equal(records.length, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /array, not an object/);
});

test('truncates at maxRecordCount and reports truncated', async () => {
  const file = tmpJson(JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ i }))));
  const { records, truncated } = await parseJsonFile(file, { ...defaults, rootProperty: undefined, maxRecordCount: 3 });
  assert.equal(records.length, 3);
  assert.equal(truncated, true);
});

test('rejects a file larger than maxFileSizeBytes before reading it', async () => {
  const file = tmpJson(JSON.stringify([{ a: 1 }]));
  await assert.rejects(() => parseJsonFile(file, { ...defaults, rootProperty: undefined, maxFileSizeBytes: 1 }), FileTooLargeError);
});
