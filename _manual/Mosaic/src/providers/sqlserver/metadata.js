import { createTtlCache } from '../cache.js';
import { quoteIdentifier } from './quoting.js';

const cache = createTtlCache();

async function query(pool, sqlText, params = {}) {
  const request = pool.request();
  for (const [name, value] of Object.entries(params)) request.input(name, value);
  const result = await request.query(sqlText);
  return result.recordset;
}

export async function listTablesAndViews(pool) {
  const rows = await query(
    pool,
    `SELECT s.name AS schemaName, t.name AS tableName, 'table' AS kind
       FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
      WHERE t.is_ms_shipped = 0
     UNION ALL
     SELECT s.name AS schemaName, v.name AS tableName, 'view' AS kind
       FROM sys.views v JOIN sys.schemas s ON s.schema_id = v.schema_id
      WHERE v.is_ms_shipped = 0
     ORDER BY schemaName, tableName`,
  );
  return rows.map((r) => ({ schema: r.schemaName, name: r.tableName, kind: r.kind }));
}

async function loadColumns(pool, schema, table) {
  const base = await query(
    pool,
    `SELECT COLUMN_NAME AS name, DATA_TYPE AS sqlType, IS_NULLABLE AS isNullable,
            COLUMN_DEFAULT AS defaultValue, ORDINAL_POSITION AS ordinal
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
      ORDER BY ORDINAL_POSITION`,
    { schema, table },
  );

  const flags = await query(
    pool,
    `SELECT c.name AS columnName, c.is_identity AS isIdentity, c.is_computed AS isComputed
       FROM sys.columns c
       JOIN sys.objects o ON o.object_id = c.object_id
       JOIN sys.schemas s ON s.schema_id = o.schema_id
      WHERE s.name = @schema AND o.name = @table`,
    { schema, table },
  );
  const flagsByName = new Map(flags.map((f) => [f.columnName, f]));

  return base.map((col) => {
    const flag = flagsByName.get(col.name) ?? {};
    const isRowversion = col.sqlType === 'timestamp';
    return {
      name: col.name,
      sqlType: col.sqlType,
      nullable: col.isNullable === 'YES',
      defaultValue: col.defaultValue,
      isIdentity: !!flag.isIdentity,
      isGenerated: !!flag.isComputed,
      generatedKind: flag.isComputed ? 'computed' : null,
      isRowversion,
      // Rowversion/timestamp columns are DB-maintained on every write, like a
      // computed column, and identity columns are never explicitly insertable
      // here (no IDENTITY_INSERT support) - both are excluded from writes.
      writable: !flag.isComputed && !flag.isIdentity && !isRowversion,
    };
  });
}

async function loadKeyConstraints(pool, schema, table) {
  const rows = await query(
    pool,
    `SELECT kc.name AS constraintName, kc.type AS constraintType, col.name AS columnName, ic.key_ordinal AS keyOrdinal
       FROM sys.key_constraints kc
       JOIN sys.objects o ON o.object_id = kc.parent_object_id
       JOIN sys.schemas s ON s.schema_id = o.schema_id
       JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
       JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
      WHERE s.name = @schema AND o.name = @table
      ORDER BY kc.name, ic.key_ordinal`,
    { schema, table },
  );

  const byConstraint = new Map();
  for (const row of rows) {
    if (!byConstraint.has(row.constraintName)) {
      byConstraint.set(row.constraintName, { type: row.constraintType, columns: [] });
    }
    byConstraint.get(row.constraintName).columns.push(row.columnName);
  }

  let primaryKeyColumns = [];
  const uniqueConstraints = [];
  for (const [name, info] of byConstraint) {
    if (info.type === 'PK') {
      primaryKeyColumns = info.columns;
    } else {
      uniqueConstraints.push({ name, columns: info.columns });
    }
  }
  return { primaryKeyColumns, uniqueConstraints };
}

async function loadForeignKeys(pool, schema, table) {
  const rows = await query(
    pool,
    `SELECT fk.name AS fkName, ro.name AS refTable, pc.name AS fromColumn, rc.name AS toColumn,
            fkc.constraint_column_id AS seq
       FROM sys.foreign_keys fk
       JOIN sys.objects o ON o.object_id = fk.parent_object_id
       JOIN sys.schemas s ON s.schema_id = o.schema_id
       JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
       JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
       JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
       JOIN sys.objects ro ON ro.object_id = fk.referenced_object_id
      WHERE s.name = @schema AND o.name = @table
      ORDER BY fk.name, fkc.constraint_column_id`,
    { schema, table },
  );

  const byName = new Map();
  for (const row of rows) {
    if (!byName.has(row.fkName)) byName.set(row.fkName, { table: row.refTable, columns: [] });
    byName.get(row.fkName).columns.push({ from: row.fromColumn, to: row.toColumn });
  }
  return [...byName.values()];
}

async function loadMetadata(pool, schema, table, kind) {
  const columns = await loadColumns(pool, schema, table);
  const { primaryKeyColumns, uniqueConstraints } = await loadKeyConstraints(pool, schema, table);
  const foreignKeys = kind === 'table' ? await loadForeignKeys(pool, schema, table) : [];

  let keyColumns = primaryKeyColumns;
  let readOnlyReason = null;

  if (keyColumns.length === 0 && kind === 'table') {
    // No primary key - fall back to the first unique constraint whose
    // columns are all NOT NULL, since that's still a reliable row identifier.
    const fallback = uniqueConstraints
      .map((uc) => ({ ...uc, columns: uc.columns.filter((name) => columns.find((c) => c.name === name)) }))
      .filter((uc) => uc.columns.every((name) => columns.find((c) => c.name === name)?.nullable === false))
      .sort((a, b) => a.columns.length - b.columns.length)[0];
    if (fallback) {
      keyColumns = fallback.columns;
    }
  }

  if (keyColumns.length === 0) {
    readOnlyReason =
      kind === 'view'
        ? 'Views are read-only.'
        : 'This table has no primary key and no all-NOT-NULL unique constraint, so rows cannot be uniquely addressed for editing.';
  } else if (kind === 'view') {
    readOnlyReason = 'Views are read-only.';
  }

  const writable = kind === 'table' && keyColumns.length > 0;

  return {
    name: table,
    schema,
    kind,
    columns,
    primaryKeyColumns,
    uniqueConstraints,
    foreignKeys,
    keyColumns,
    rowversionColumn: columns.find((c) => c.isRowversion)?.name ?? null,
    writable,
    readOnlyReason: writable ? null : readOnlyReason,
  };
}

export async function getTableMetadata(sourceId, pool, schema, table, kind, ttlMs) {
  const cacheKey = `${sourceId}::${schema}.${table}`;
  const cached = cache.get(cacheKey, ttlMs);
  if (cached) return cached;
  const metadata = await loadMetadata(pool, schema, table, kind);
  cache.set(cacheKey, metadata);
  return metadata;
}

export function invalidateMetadataCache(sourceId) {
  cache.deleteBySourceId(sourceId);
}

export async function getRowCount(pool, schema, table, whereSql = '', params = {}) {
  const sqlText = `SELECT COUNT(*) AS c FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}${whereSql ? ` WHERE ${whereSql}` : ''}`;
  const rows = await query(pool, sqlText, params);
  return Number(rows[0].c);
}
