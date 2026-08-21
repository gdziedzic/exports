import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRequestTimeout } from '../../../src/providers/sqlserver/connections.js';

test('resolveRequestTimeout uses the source-level override when configured', () => {
  assert.equal(resolveRequestTimeout({ commandTimeoutMs: 5000 }, 15000), 5000);
});

test('resolveRequestTimeout falls back to the app-wide default when the source has no override', () => {
  assert.equal(resolveRequestTimeout({}, 15000), 15000);
});

test('resolveRequestTimeout is undefined (mssql package default applies) when neither is configured', () => {
  assert.equal(resolveRequestTimeout({}, undefined), undefined);
});
