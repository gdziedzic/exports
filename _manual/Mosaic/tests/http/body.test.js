import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readRequestBody, parseFormBody, RequestTooLargeError } from '../../src/http/body.js';

function fakeRequest({ headers = {}, chunks = [] }) {
  const req = new EventEmitter();
  req.headers = headers;
  req.destroy = () => {
    req.destroyed = true;
  };
  process.nextTick(() => {
    for (const chunk of chunks) req.emit('data', Buffer.from(chunk));
    req.emit('end');
  });
  return req;
}

test('readRequestBody resolves with the concatenated body under the limit', async () => {
  const req = fakeRequest({ chunks: ['hello ', 'world'] });
  const buf = await readRequestBody(req, 1024);
  assert.equal(buf.toString('utf8'), 'hello world');
});

test('readRequestBody rejects up front when Content-Length exceeds the limit', async () => {
  const req = fakeRequest({ headers: { 'content-length': '5000' }, chunks: [] });
  await assert.rejects(() => readRequestBody(req, 10), RequestTooLargeError);
  assert.equal(req.destroyed, true);
});

test('readRequestBody rejects mid-stream when a chunked body exceeds the limit despite no Content-Length', async () => {
  const req = fakeRequest({ chunks: ['a'.repeat(20), 'b'.repeat(20)] });
  await assert.rejects(() => readRequestBody(req, 10), RequestTooLargeError);
});

test('parseFormBody parses application/x-www-form-urlencoded bodies', async () => {
  const req = fakeRequest({ chunks: ['name=Alice&age=30'] });
  const params = await parseFormBody(req, 1024);
  assert.equal(params.get('name'), 'Alice');
  assert.equal(params.get('age'), '30');
});
