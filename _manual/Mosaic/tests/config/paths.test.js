import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT_DIR, resolveWithinRoot, PathEscapeError } from '../../src/config/paths.js';

test('resolveWithinRoot resolves a plain relative path', () => {
  const resolved = resolveWithinRoot(CONTENT_DIR, 'data/products.csv');
  assert.ok(resolved.startsWith(CONTENT_DIR));
});

test('resolveWithinRoot rejects parent-directory traversal', () => {
  assert.throws(() => resolveWithinRoot(CONTENT_DIR, '../outside.txt'), PathEscapeError);
});

test('resolveWithinRoot rejects traversal hidden inside a longer relative path', () => {
  assert.throws(() => resolveWithinRoot(CONTENT_DIR, 'data/../../outside.txt'), PathEscapeError);
});

test('resolveWithinRoot rejects absolute paths', () => {
  assert.throws(() => resolveWithinRoot(CONTENT_DIR, 'C:\\Windows\\system.ini'), PathEscapeError);
});

test('resolveWithinRoot rejects UNC paths', () => {
  assert.throws(() => resolveWithinRoot(CONTENT_DIR, '\\\\server\\share\\file.txt'), PathEscapeError);
});

test('resolveWithinRoot rejects device paths', () => {
  assert.throws(() => resolveWithinRoot(CONTENT_DIR, '\\\\?\\C:\\secrets.txt'), PathEscapeError);
});

test('resolveWithinRoot rejects the root itself (empty relative path)', () => {
  assert.throws(() => resolveWithinRoot(CONTENT_DIR, '.'), PathEscapeError);
});

test('resolveWithinRoot rejects non-string input', () => {
  assert.throws(() => resolveWithinRoot(CONTENT_DIR, undefined), PathEscapeError);
  assert.throws(() => resolveWithinRoot(CONTENT_DIR, ''), PathEscapeError);
});
