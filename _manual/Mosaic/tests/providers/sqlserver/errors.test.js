import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlySqlServerError } from '../../../src/providers/sqlserver/errors.js';

test('maps unique/PK violations (2627, 2601) to a friendly conflict message', () => {
  assert.match(friendlySqlServerError({ number: 2627 }), /unique/i);
  assert.match(friendlySqlServerError({ number: 2601 }), /unique/i);
});

test('maps a foreign key violation (547) to a friendly message', () => {
  assert.match(friendlySqlServerError({ number: 547 }), /does not exist|depends/i);
});

test('maps a NOT NULL violation (515) to a friendly required-value message', () => {
  assert.match(friendlySqlServerError({ number: 515 }), /required/i);
});

test('maps a conversion failure (245) to a friendly type message', () => {
  assert.match(friendlySqlServerError({ number: 245 }), /type/i);
});

test('falls back to a generic message for an unrecognized error number, never echoing raw SQL', () => {
  const message = friendlySqlServerError({ number: 99999, message: "Invalid column 'secret_internal_col'." });
  assert.doesNotMatch(message, /secret_internal_col/);
});
