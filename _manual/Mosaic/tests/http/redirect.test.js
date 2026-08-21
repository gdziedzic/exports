import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeLocalRedirect } from '../../src/http/redirect.js';

test('accepts a plain local path', () => {
  assert.equal(isSafeLocalRedirect('/sources/local-reference'), true);
});

test('accepts a local path with a query string', () => {
  assert.equal(isSafeLocalRedirect('/pages/ops?b_orders_page=2'), true);
});

test('rejects protocol-relative URLs', () => {
  assert.equal(isSafeLocalRedirect('//evil.example/phish'), false);
});

test('rejects backslash-prefixed URLs some browsers treat as protocol-relative', () => {
  assert.equal(isSafeLocalRedirect('/\\evil.example'), false);
});

test('rejects absolute URLs to another origin', () => {
  assert.equal(isSafeLocalRedirect('https://evil.example/'), false);
});

test('rejects paths without a leading slash', () => {
  assert.equal(isSafeLocalRedirect('sources/x'), false);
});

test('rejects header-injection via CR/LF', () => {
  assert.equal(isSafeLocalRedirect('/x\r\nSet-Cookie: evil=1'), false);
});

test('rejects empty and non-string input', () => {
  assert.equal(isSafeLocalRedirect(''), false);
  assert.equal(isSafeLocalRedirect(undefined), false);
  assert.equal(isSafeLocalRedirect(null), false);
});
