import test from 'node:test';
import assert from 'node:assert/strict';
import { listTablesAndViews, getTableMetadata } from '../../../src/providers/sqlserver/metadata.js';

function fakePool(routes) {
  return {
    request() {
      const req = {
        input() {
          return req;
        },
        async query(sqlText) {
          for (const [match, recordset] of routes) {
            if (sqlText.includes(match)) return { recordset };
          }
          return { recordset: [] };
        },
      };
      return req;
    },
  };
}

test('listTablesAndViews maps schema/table/kind from the UNION query', async () => {
  const pool = fakePool([
    [
      'sys.tables',
      [
        { schemaName: 'dbo', tableName: 'Orders', kind: 'table' },
        { schemaName: 'dbo', tableName: 'OrderSummary', kind: 'view' },
      ],
    ],
  ]);
  const tables = await listTablesAndViews(pool);
  assert.deepEqual(tables, [
    { schema: 'dbo', name: 'Orders', kind: 'table' },
    { schema: 'dbo', name: 'OrderSummary', kind: 'view' },
  ]);
});

let idCounter = 0;
function makeMetadataPool({ columns, flags = [], keyConstraints = [], foreignKeys = [] }) {
  return fakePool([
    ['INFORMATION_SCHEMA.COLUMNS', columns],
    ['is_identity', flags],
    ['sys.key_constraints', keyConstraints],
    ['sys.foreign_keys', foreignKeys],
  ]);
}

test('getTableMetadata detects a single-column identity primary key', async () => {
  const pool = makeMetadataPool({
    columns: [
      { name: 'Id', sqlType: 'int', isNullable: 'NO', defaultValue: null, ordinal: 1 },
      { name: 'Name', sqlType: 'nvarchar', isNullable: 'NO', defaultValue: null, ordinal: 2 },
    ],
    flags: [
      { columnName: 'Id', isIdentity: true, isComputed: false },
      { columnName: 'Name', isIdentity: false, isComputed: false },
    ],
    keyConstraints: [{ constraintName: 'PK_Customers', constraintType: 'PK', columnName: 'Id', keyOrdinal: 1 }],
  });
  const meta = await getTableMetadata(`s${++idCounter}`, pool, 'dbo', 'Customers', 'table', 0);
  assert.deepEqual(meta.keyColumns, ['Id']);
  const idCol = meta.columns.find((c) => c.name === 'Id');
  assert.equal(idCol.isIdentity, true);
  assert.equal(idCol.writable, false, 'identity columns are never explicitly insertable here');
  assert.equal(meta.writable, true);
});

test('getTableMetadata detects a computed column as non-writable', async () => {
  const pool = makeMetadataPool({
    columns: [
      { name: 'Id', sqlType: 'int', isNullable: 'NO', defaultValue: null, ordinal: 1 },
      { name: 'Total', sqlType: 'decimal', isNullable: 'YES', defaultValue: null, ordinal: 2 },
    ],
    flags: [
      { columnName: 'Id', isIdentity: true, isComputed: false },
      { columnName: 'Total', isIdentity: false, isComputed: true },
    ],
    keyConstraints: [{ constraintName: 'PK_Orders', constraintType: 'PK', columnName: 'Id', keyOrdinal: 1 }],
  });
  const meta = await getTableMetadata(`s${++idCounter}`, pool, 'dbo', 'Orders', 'table', 0);
  const total = meta.columns.find((c) => c.name === 'Total');
  assert.equal(total.isGenerated, true);
  assert.equal(total.writable, false);
});

test('getTableMetadata detects a rowversion column and excludes it from writes', async () => {
  const pool = makeMetadataPool({
    columns: [
      { name: 'Id', sqlType: 'int', isNullable: 'NO', defaultValue: null, ordinal: 1 },
      { name: 'RowVer', sqlType: 'timestamp', isNullable: 'NO', defaultValue: null, ordinal: 2 },
    ],
    flags: [
      { columnName: 'Id', isIdentity: true, isComputed: false },
      { columnName: 'RowVer', isIdentity: false, isComputed: false },
    ],
    keyConstraints: [{ constraintName: 'PK_Items', constraintType: 'PK', columnName: 'Id', keyOrdinal: 1 }],
  });
  const meta = await getTableMetadata(`s${++idCounter}`, pool, 'dbo', 'Items', 'table', 0);
  assert.equal(meta.rowversionColumn, 'RowVer');
  const rv = meta.columns.find((c) => c.name === 'RowVer');
  assert.equal(rv.writable, false);
});

test('getTableMetadata falls back to an all-NOT-NULL unique constraint when there is no primary key', async () => {
  const pool = makeMetadataPool({
    columns: [
      { name: 'Code', sqlType: 'nvarchar', isNullable: 'NO', defaultValue: null, ordinal: 1 },
      { name: 'Label', sqlType: 'nvarchar', isNullable: 'YES', defaultValue: null, ordinal: 2 },
    ],
    flags: [
      { columnName: 'Code', isIdentity: false, isComputed: false },
      { columnName: 'Label', isIdentity: false, isComputed: false },
    ],
    keyConstraints: [{ constraintName: 'UQ_Code', constraintType: 'UQ', columnName: 'Code', keyOrdinal: 1 }],
  });
  const meta = await getTableMetadata(`s${++idCounter}`, pool, 'dbo', 'Lookup', 'table', 0);
  assert.deepEqual(meta.keyColumns, ['Code']);
  assert.equal(meta.writable, true);
});

test('getTableMetadata does not use a nullable unique constraint as a fallback key', async () => {
  const pool = makeMetadataPool({
    columns: [{ name: 'Email', sqlType: 'nvarchar', isNullable: 'YES', defaultValue: null, ordinal: 1 }],
    flags: [{ columnName: 'Email', isIdentity: false, isComputed: false }],
    keyConstraints: [{ constraintName: 'UQ_Email', constraintType: 'UQ', columnName: 'Email', keyOrdinal: 1 }],
  });
  const meta = await getTableMetadata(`s${++idCounter}`, pool, 'dbo', 'Contacts', 'table', 0);
  assert.deepEqual(meta.keyColumns, []);
  assert.equal(meta.writable, false);
});

test('getTableMetadata groups a composite foreign key by constraint name, ordered by column sequence', async () => {
  const pool = makeMetadataPool({
    columns: [
      { name: 'OrderId', sqlType: 'int', isNullable: 'NO', defaultValue: null, ordinal: 1 },
      { name: 'LineId', sqlType: 'int', isNullable: 'NO', defaultValue: null, ordinal: 2 },
    ],
    flags: [
      { columnName: 'OrderId', isIdentity: false, isComputed: false },
      { columnName: 'LineId', isIdentity: false, isComputed: false },
    ],
    keyConstraints: [
      { constraintName: 'PK_Lines', constraintType: 'PK', columnName: 'OrderId', keyOrdinal: 1 },
      { constraintName: 'PK_Lines', constraintType: 'PK', columnName: 'LineId', keyOrdinal: 2 },
    ],
    foreignKeys: [
      { fkName: 'FK_Lines_Orders', refTable: 'Orders', fromColumn: 'OrderId', toColumn: 'Id', seq: 1 },
    ],
  });
  const meta = await getTableMetadata(`s${++idCounter}`, pool, 'dbo', 'OrderLines', 'table', 0);
  assert.equal(meta.foreignKeys.length, 1);
  assert.equal(meta.foreignKeys[0].table, 'Orders');
  assert.deepEqual(meta.foreignKeys[0].columns, [{ from: 'OrderId', to: 'Id' }]);
});

test('getTableMetadata marks a view read-only even with a usable key', async () => {
  const pool = makeMetadataPool({
    columns: [{ name: 'Id', sqlType: 'int', isNullable: 'NO', defaultValue: null, ordinal: 1 }],
    flags: [{ columnName: 'Id', isIdentity: false, isComputed: false }],
    keyConstraints: [{ constraintName: 'PK_View', constraintType: 'PK', columnName: 'Id', keyOrdinal: 1 }],
  });
  const meta = await getTableMetadata(`s${++idCounter}`, pool, 'dbo', 'SomeView', 'view', 0);
  assert.equal(meta.writable, false);
  assert.match(meta.readOnlyReason, /read-only/i);
});

test('getTableMetadata caches per source ID', async () => {
  const pool = makeMetadataPool({
    columns: [{ name: 'Id', sqlType: 'int', isNullable: 'NO', defaultValue: null, ordinal: 1 }],
    flags: [{ columnName: 'Id', isIdentity: true, isComputed: false }],
    keyConstraints: [{ constraintName: 'PK_X', constraintType: 'PK', columnName: 'Id', keyOrdinal: 1 }],
  });
  const first = await getTableMetadata('cache-source', pool, 'dbo', 'X', 'table', 60_000);
  const second = await getTableMetadata('cache-source', pool, 'dbo', 'X', 'table', 60_000);
  assert.equal(first, second, 'same object identity - served from cache');
});
