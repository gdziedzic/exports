import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySqlServerType } from '../../../src/providers/sqlserver/types.js';

test('classifies integer family types', () => {
  for (const t of ['tinyint', 'smallint', 'int', 'bigint']) {
    assert.equal(classifySqlServerType(t), 'integer', t);
  }
});

test('classifies decimal/numeric/float/money family types', () => {
  for (const t of ['decimal', 'numeric', 'float', 'real', 'money', 'smallmoney']) {
    assert.equal(classifySqlServerType(t), 'decimal', t);
  }
});

test('classifies bit as boolean', () => {
  assert.equal(classifySqlServerType('bit'), 'boolean');
});

test('classifies date/time/datetime family types', () => {
  assert.equal(classifySqlServerType('date'), 'date');
  assert.equal(classifySqlServerType('time'), 'time');
  for (const t of ['datetime', 'datetime2', 'smalldatetime', 'datetimeoffset']) {
    assert.equal(classifySqlServerType(t), 'datetime', t);
  }
});

test('classifies binary/varbinary/image/rowversion as binary', () => {
  for (const t of ['binary', 'varbinary', 'image', 'timestamp', 'rowversion']) {
    assert.equal(classifySqlServerType(t), 'binary', t);
  }
});

test('classifies uniqueidentifier, xml, and unknown types as text', () => {
  assert.equal(classifySqlServerType('uniqueidentifier'), 'text');
  assert.equal(classifySqlServerType('nvarchar'), 'text');
  assert.equal(classifySqlServerType('xml'), 'text');
  assert.equal(classifySqlServerType('sql_variant'), 'text');
});

test('is case-insensitive', () => {
  assert.equal(classifySqlServerType('INT'), 'integer');
  assert.equal(classifySqlServerType('BIT'), 'boolean');
});
