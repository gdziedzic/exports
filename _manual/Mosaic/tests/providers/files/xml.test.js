import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseXmlFile } from '../../../src/providers/files/xml.js';
import { FileTooLargeError } from '../../../src/providers/files/limits.js';

function tmpXml(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-xml-'));
  const filePath = path.join(dir, 'data.xml');
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

const defaults = { maxFileSizeBytes: 10_000_000, maxRecordCount: 10_000 };

test('flattens attributes (prefixed) and simple child elements at the record path', async () => {
  const file = tmpXml('<Root><Items><Item id="1"><Name>Widget</Name><Price>9.99</Price></Item></Items></Root>');
  const { columns, records } = await parseXmlFile(file, { ...defaults, recordPath: 'Root/Items/Item' });
  assert.deepEqual(columns.sort(), ['@id', 'Name', 'Price']);
  assert.deepEqual(records, [{ '@id': '1', Name: 'Widget', Price: '9.99' }]);
});

test('supports a custom attributePrefix', async () => {
  const file = tmpXml('<Root><Item id="1"><Name>X</Name></Item></Root>');
  const { columns } = await parseXmlFile(file, { ...defaults, recordPath: 'Root/Item', attributePrefix: 'attr_' });
  assert.ok(columns.includes('attr_id'));
});

test('flattens a child element\'s own attributes as childName@attr', async () => {
  const file = tmpXml('<Root><Item><Price currency="USD">9.99</Price></Item></Root>');
  const { records } = await parseXmlFile(file, { ...defaults, recordPath: 'Root/Item' });
  assert.equal(records[0]['Price@currency'], 'USD');
  assert.equal(records[0].Price, '9.99');
});

test('finds records nested arbitrarily deep, matching only the configured path', async () => {
  const file = tmpXml('<A><B><C><Item><X>1</X></Item></C></B></A>');
  const { records } = await parseXmlFile(file, { ...defaults, recordPath: 'A/B/C/Item' });
  assert.deepEqual(records, [{ X: '1' }]);
});

test('reports and omits a nested/ambiguous grandchild structure instead of failing', async () => {
  const file = tmpXml('<Root><Item><Name>X</Name><Details><Weight>5</Weight></Details></Item></Root>');
  const { records, warnings } = await parseXmlFile(file, { ...defaults, recordPath: 'Root/Item' });
  assert.deepEqual(records, [{ Name: 'X' }]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /Details/);
});

test('handles multiple records at the same path', async () => {
  const file = tmpXml('<Root><Item><X>1</X></Item><Item><X>2</X></Item></Root>');
  const { records } = await parseXmlFile(file, { ...defaults, recordPath: 'Root/Item' });
  assert.deepEqual(records, [{ X: '1' }, { X: '2' }]);
});

test('truncates at maxRecordCount and reports truncated', async () => {
  const items = Array.from({ length: 10 }, (_, i) => `<Item><X>${i}</X></Item>`).join('');
  const file = tmpXml(`<Root>${items}</Root>`);
  const { records, truncated } = await parseXmlFile(file, { ...defaults, recordPath: 'Root/Item', maxRecordCount: 3 });
  assert.equal(records.length, 3);
  assert.equal(truncated, true);
});

test('rejects a file larger than maxFileSizeBytes before reading it', async () => {
  const file = tmpXml('<Root><Item><X>1</X></Item></Root>');
  await assert.rejects(() => parseXmlFile(file, { ...defaults, recordPath: 'Root/Item', maxFileSizeBytes: 1 }), FileTooLargeError);
});

test('does not match an element at the wrong depth (e.g. a differently-nested same-named element)', async () => {
  const file = tmpXml('<Root><Item><Nested><Item><X>wrong</X></Item></Nested></Item></Root>');
  const { records } = await parseXmlFile(file, { ...defaults, recordPath: 'Root/Item' });
  // only the outer Item matches Root/Item; the inner one is 2 levels too deep
  assert.equal(records.length, 1);
});
