// Opt-in integration tests against a real SQL Server instance. Skipped
// entirely unless MOSAIC_TEST_SQLSERVER_CONNECTION is set to a working
// mssql/tedious connection string, e.g.:
//
//   MOSAIC_TEST_SQLSERVER_CONNECTION="Server=localhost,1433;Database=tempdb;User Id=sa;Password=...;Encrypt=true;TrustServerCertificate=true" \
//     node --test tests/providers/sqlserver/integration.test.js
//
// Never run against a production database - this creates and drops a
// scratch table in the target database on every run.
import test from 'node:test';
import assert from 'node:assert/strict';
import sql from 'mssql';
import { getTableMetadata, listTablesAndViews } from '../../../src/providers/sqlserver/metadata.js';
import { queryRows, insertRow, updateRow, deleteRow, ConcurrencyConflictError } from '../../../src/providers/sqlserver/crud.js';

const connectionString = process.env.MOSAIC_TEST_SQLSERVER_CONNECTION;
const TABLE = 'MosaicIntegrationTest_Widgets';

test('SQL Server integration suite', { skip: !connectionString && 'set MOSAIC_TEST_SQLSERVER_CONNECTION to run' }, async (t) => {
  const pool = await new sql.ConnectionPool(connectionString).connect();
  await pool.request().query(`IF OBJECT_ID('dbo.${TABLE}', 'U') IS NOT NULL DROP TABLE dbo.${TABLE}`);
  await pool.request().query(`
    CREATE TABLE dbo.${TABLE} (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL,
      Price DECIMAL(10,2) NOT NULL DEFAULT 0,
      RowVer ROWVERSION
    )
  `);

  t.after(async () => {
    await pool.request().query(`IF OBJECT_ID('dbo.${TABLE}', 'U') IS NOT NULL DROP TABLE dbo.${TABLE}`);
    await pool.close();
  });

  await t.test('listTablesAndViews finds the scratch table', async () => {
    const tables = await listTablesAndViews(pool);
    assert.ok(tables.some((tbl) => tbl.schema === 'dbo' && tbl.name === TABLE));
  });

  await t.test('getTableMetadata detects identity PK and rowversion', async () => {
    const meta = await getTableMetadata('it', pool, 'dbo', TABLE, 'table', 0);
    assert.deepEqual(meta.keyColumns, ['Id']);
    assert.equal(meta.rowversionColumn, 'RowVer');
    assert.equal(meta.columns.find((c) => c.name === 'Id').isIdentity, true);
  });

  let insertedId;
  await t.test('insertRow auto-assigns identity and returns the full row', async () => {
    const meta = await getTableMetadata('it', pool, 'dbo', TABLE, 'table', 0);
    const row = await insertRow(pool, 'dbo', TABLE, meta, { Name: 'Widget', Price: 9.99 });
    assert.ok(row.Id > 0);
    assert.equal(row.Name, 'Widget');
    assert.ok(row.RowVer instanceof Uint8Array);
    insertedId = row.Id;
  });

  await t.test('queryRows filters and paginates', async () => {
    const { rows, total } = await queryRows(pool, 'dbo', TABLE, {
      filters: [{ column: 'Name', op: 'eq', value: 'Widget' }],
      sort: { column: 'Id', direction: 'ASC' },
      offset: 0,
      limit: 10,
    });
    assert.equal(total, 1);
    assert.equal(rows[0].Id, insertedId);
  });

  await t.test('updateRow uses the rowversion as the concurrency token', async () => {
    const meta = await getTableMetadata('it', pool, 'dbo', TABLE, 'table', 0);
    const [current] = (await queryRows(pool, 'dbo', TABLE, { filters: [], sort: null, offset: 0, limit: 1 })).rows;
    const updated = await updateRow(pool, 'dbo', TABLE, meta, { Id: insertedId }, { Price: 19.99 }, { RowVer: current.RowVer });
    assert.equal(Number(updated.Price), 19.99);

    // Reusing the stale RowVer must now conflict.
    await assert.rejects(
      () => updateRow(pool, 'dbo', TABLE, meta, { Id: insertedId }, { Price: 29.99 }, { RowVer: current.RowVer }),
      ConcurrencyConflictError,
    );
  });

  await t.test('deleteRow removes the row', async () => {
    const meta = await getTableMetadata('it', pool, 'dbo', TABLE, 'table', 0);
    const [current] = (await queryRows(pool, 'dbo', TABLE, { filters: [], sort: null, offset: 0, limit: 1 })).rows;
    await deleteRow(pool, 'dbo', TABLE, meta, { Id: insertedId }, { RowVer: current.RowVer });
    const { total } = await queryRows(pool, 'dbo', TABLE, { filters: [], sort: null, offset: 0, limit: 1 });
    assert.equal(total, 0);
  });
});
