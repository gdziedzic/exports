import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndCoerceFields, hasErrors } from '../../src/explorer/formValidation.js';
import { classifySqliteType, coerceFormValue } from '../../src/providers/sqlite/types.js';

// Mirrors the customers table from scripts/seed-reference-db.js: an identity
// PK, a required NOT-NULL column, a nullable UNIQUE column, and a NOT NULL
// column with a DEFAULT (the case that exposed the insert-vs-edit bug).
const columns = [
  { name: 'id', sqlType: 'INTEGER', nullable: false, defaultValue: null, isIdentity: true, isGenerated: false },
  { name: 'name', sqlType: 'TEXT', nullable: false, defaultValue: null, isIdentity: false, isGenerated: false },
  { name: 'email', sqlType: 'TEXT', nullable: true, defaultValue: null, isIdentity: false, isGenerated: false },
  { name: 'is_active', sqlType: 'INTEGER', nullable: false, defaultValue: '1', isIdentity: false, isGenerated: false },
  { name: 'created_at', sqlType: 'TEXT', nullable: false, defaultValue: 'CURRENT_TIMESTAMP', isIdentity: false, isGenerated: false },
];

function run(formEntries, mode, keyColumns = ['id']) {
  return validateAndCoerceFields({
    columns,
    classifyType: classifySqliteType,
    coerceFormValue,
    formValues: new URLSearchParams(formEntries),
    mode,
    keyColumns,
  });
}

test('insert: a NOT NULL column with a DEFAULT is optional and omitted (not nulled) when blank', () => {
  const { values, errors } = run({ name: 'Alice' }, 'insert');
  assert.equal(hasErrors(errors), false);
  assert.ok(!('is_active' in values), 'left out entirely so the DB DEFAULT applies');
  assert.ok(!('created_at' in values), 'left out entirely so the DB DEFAULT applies');
});

test('insert: a NOT NULL column with no DEFAULT is required', () => {
  const { errors } = run({}, 'insert');
  assert.equal(errors.name, 'This field is required.');
});

test('insert: the identity column is always optional and never included when blank', () => {
  const { values, errors } = run({ name: 'Alice' }, 'insert');
  assert.equal(hasErrors(errors), false);
  assert.ok(!('id' in values));
});

test('insert: a nullable column left blank is simply omitted', () => {
  const { values } = run({ name: 'Alice' }, 'insert');
  assert.ok(!('email' in values));
});

test('edit: a NOT NULL column with a DEFAULT is still required (UPDATE never applies DEFAULT)', () => {
  const { errors } = run({ name: 'Alice', email: '', is_active: '1' }, 'edit');
  assert.equal(errors.created_at, 'This field is required.');
});

test('edit: a nullable column left blank is explicitly set to null, clearing it', () => {
  const { values, errors } = run(
    { name: 'Alice', email: '', is_active: '1', created_at: '2026-01-01 00:00:00' },
    'edit',
  );
  assert.equal(hasErrors(errors), false);
  assert.equal(values.email, null);
});

test('edit: key columns are never present in values, even if submitted', () => {
  const { values } = run(
    { id: '999', name: 'Alice', email: 'a@example.com', is_active: '1', created_at: '2026-01-01 00:00:00' },
    'edit',
  );
  assert.ok(!('id' in values));
});

test('integer fields that fail to parse produce a field error instead of coercing to garbage', () => {
  // is_active is declared INTEGER (SQLite has no native boolean), so it is
  // classified as the "integer" logical type, not "boolean".
  const { errors } = run({ name: 'Alice', is_active: 'not-a-number', created_at: '2026-01-01' }, 'edit');
  assert.equal(errors.is_active, 'Must be a whole number.');
});

test('a valid integer value for an INTEGER column coerces to a JS number', () => {
  const { values } = run({ name: 'Alice', is_active: '0' }, 'insert');
  assert.equal(values.is_active, 0);
});

test('binary columns are never included in values or errors', () => {
  const binaryColumns = [...columns, { name: 'avatar', sqlType: 'BLOB', nullable: true, defaultValue: null, isIdentity: false, isGenerated: false }];
  const { values, errors } = validateAndCoerceFields({
    columns: binaryColumns,
    classifyType: classifySqliteType,
    coerceFormValue,
    formValues: new URLSearchParams({ name: 'Alice', avatar: 'ignored' }),
    mode: 'insert',
    keyColumns: ['id'],
  });
  assert.ok(!('avatar' in values));
  assert.ok(!('avatar' in errors));
});

test('generated columns are never included in values or errors', () => {
  const generatedColumns = [...columns, { name: 'total', sqlType: 'REAL', nullable: true, defaultValue: null, isIdentity: false, isGenerated: true }];
  const { values, errors } = validateAndCoerceFields({
    columns: generatedColumns,
    classifyType: classifySqliteType,
    coerceFormValue,
    formValues: new URLSearchParams({ name: 'Alice', total: '999' }),
    mode: 'insert',
    keyColumns: ['id'],
  });
  assert.ok(!('total' in values));
  assert.ok(!('total' in errors));
});
