import { HttpError } from '../http/errors.js';
import { getConnection as sqliteGetConnection } from '../providers/sqlite/connections.js';
import * as sqliteMeta from '../providers/sqlite/metadata.js';
import * as sqliteCrud from '../providers/sqlite/crud.js';
import * as sqliteTypes from '../providers/sqlite/types.js';
import { quoteIdentifier as sqliteQuoteIdentifier } from '../providers/sqlite/quoting.js';
import * as sqliteRawQuery from '../providers/sqlite/rawQuery.js';
import { getConnection as sqlserverGetConnection } from '../providers/sqlserver/connections.js';
import * as sqlserverMeta from '../providers/sqlserver/metadata.js';
import * as sqlserverCrud from '../providers/sqlserver/crud.js';
import * as sqlserverTypes from '../providers/sqlserver/types.js';
import { quoteIdentifier as sqlserverQuoteIdentifier } from '../providers/sqlserver/quoting.js';
import * as sqlserverRawQuery from '../providers/sqlserver/rawQuery.js';

const SQLITE_SCHEMA = 'main';

export function findSqlSource(sources, sourceId) {
  const source = sources.find((s) => s.id === sourceId);
  if (!source) throw new HttpError(404, 'Source not found.');
  if (source.provider !== 'sqlite' && source.provider !== 'sqlserver') {
    throw new HttpError(404, 'That source is not a database.');
  }
  return source;
}

/**
 * Returns a narrow, uniform (and always-awaitable, even for SQLite's
 * synchronous calls) adapter for a SQL source's provider. This is the seam
 * explorer routes are written against - every method takes/returns a real
 * schema name, so SQLite (fixed at "main") and SQL Server (real schemas)
 * share one interface with no per-provider branching outside this file.
 */
export function getSqlAdapter(source, settings) {
  if (source.provider === 'sqlite') {
    const db = sqliteGetConnection(source);
    return {
      provider: 'sqlite',
      defaultSchema: SQLITE_SCHEMA,
      listTablesAndViews: async () => sqliteMeta.listTablesAndViews(db).map((t) => ({ schema: SQLITE_SCHEMA, ...t })),
      getTableMetadata: async (schema, table, kind, ttlMs) => sqliteMeta.getTableMetadata(source.id, db, table, kind, ttlMs),
      classifyType: sqliteTypes.classifySqliteType,
      operatorsByType: sqliteTypes.OPERATORS_BY_LOGICAL_TYPE,
      coerceFormValue: sqliteTypes.coerceFormValue,
      quoteIdentifier: sqliteQuoteIdentifier,
      queryRows: async (schema, table, opts) => sqliteCrud.queryRows(db, table, opts),
      getRowByKey: async (schema, table, keyColumns, keyValues) => sqliteCrud.getRowByKey(db, table, keyColumns, keyValues),
      insertRow: async (schema, table, metadata, values) => sqliteCrud.insertRow(db, table, metadata, values),
      updateRow: async (schema, table, metadata, keyValues, newValues, originalValues) =>
        sqliteCrud.updateRow(db, table, metadata, keyValues, newValues, originalValues),
      deleteRow: async (schema, table, metadata, keyValues, originalValues) =>
        sqliteCrud.deleteRow(db, table, metadata, keyValues, originalValues),
      ConcurrencyConflictError: sqliteCrud.ConcurrencyConflictError,
      RecordNotFoundError: sqliteCrud.RecordNotFoundError,
      runSelectQuery: async (sqlText, params) => sqliteRawQuery.runSelectQuery(db, sqlText, params),
      runWriteQuery: async (sqlText, params) => sqliteRawQuery.runWriteQuery(db, sqlText, params),
      describeTableBlockColumns: async (sqlText, innerParams) => sqliteRawQuery.describeColumns(db, sqlText, innerParams),
      runTableBlockQuery: async (opts) => sqliteRawQuery.runTableBlockQuery(db, opts),
    };
  }

  const poolPromise = sqlserverGetConnection(source, settings?.sqlCommandTimeoutMs);
  return {
    provider: 'sqlserver',
    defaultSchema: 'dbo',
    listTablesAndViews: async () => sqlserverMeta.listTablesAndViews(await poolPromise),
    getTableMetadata: async (schema, table, kind, ttlMs) =>
      sqlserverMeta.getTableMetadata(source.id, await poolPromise, schema, table, kind, ttlMs),
    classifyType: sqlserverTypes.classifySqlServerType,
    operatorsByType: sqlserverTypes.OPERATORS_BY_LOGICAL_TYPE,
    coerceFormValue: sqlserverTypes.coerceFormValue,
    quoteIdentifier: sqlserverQuoteIdentifier,
    queryRows: async (schema, table, opts) => sqlserverCrud.queryRows(await poolPromise, schema, table, opts),
    getRowByKey: async (schema, table, keyColumns, keyValues) =>
      sqlserverCrud.getRowByKey(await poolPromise, schema, table, keyColumns, keyValues),
    insertRow: async (schema, table, metadata, values) => sqlserverCrud.insertRow(await poolPromise, schema, table, metadata, values),
    updateRow: async (schema, table, metadata, keyValues, newValues, originalValues) =>
      sqlserverCrud.updateRow(await poolPromise, schema, table, metadata, keyValues, newValues, originalValues),
    deleteRow: async (schema, table, metadata, keyValues, originalValues) =>
      sqlserverCrud.deleteRow(await poolPromise, schema, table, metadata, keyValues, originalValues),
    ConcurrencyConflictError: sqlserverCrud.ConcurrencyConflictError,
    RecordNotFoundError: sqlserverCrud.RecordNotFoundError,
    runSelectQuery: async (sqlText, params) => sqlserverRawQuery.runSelectQuery(await poolPromise, sqlText, params),
    runWriteQuery: async (sqlText, params) => sqlserverRawQuery.runWriteQuery(await poolPromise, sqlText, params),
    describeTableBlockColumns: async (sqlText, innerParams) =>
      sqlserverRawQuery.describeColumns(await poolPromise, sqlText, innerParams),
    runTableBlockQuery: async (opts) => sqlserverRawQuery.runTableBlockQuery(await poolPromise, opts),
  };
}

export async function findTable(adapter, schema, tableName) {
  const table = (await adapter.listTablesAndViews()).find((t) => t.schema === schema && t.name === tableName);
  if (!table) throw new HttpError(404, 'Table not found.');
  return table;
}
