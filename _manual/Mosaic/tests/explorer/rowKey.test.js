import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeRowKey, decodeRowKey, InvalidRowKeyError } from '../../src/explorer/rowKey.js';

test('encode/decode round-trips a single-column key', () => {
  const encoded = encodeRowKey(['id'], { id: 42 });
  assert.deepEqual(decodeRowKey(encoded, ['id']), { id: 42 });
});

test('encode/decode round-trips a composite key, including a string component', () => {
  const encoded = encodeRowKey(['order_id', 'tag'], { order_id: 1, tag: 'priority' });
  assert.deepEqual(decodeRowKey(encoded, ['order_id', 'tag']), { order_id: 1, tag: 'priority' });
});

test('decodeRowKey rejects malformed JSON', () => {
  assert.throws(() => decodeRowKey('not-json', ['id']), InvalidRowKeyError);
});

test('decodeRowKey rejects a key whose length does not match the table\'s key shape', () => {
  const encoded = encodeRowKey(['a', 'b'], { a: 1, b: 2 });
  assert.throws(() => decodeRowKey(encoded, ['a']), InvalidRowKeyError);
});

test('decodeRowKey rejects a non-array JSON value', () => {
  assert.throws(() => decodeRowKey('{"id":1}', ['id']), InvalidRowKeyError);
});
