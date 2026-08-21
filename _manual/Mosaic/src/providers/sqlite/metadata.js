import { createTtlCache } from '../cache.js';
import { quoteIdentifier } from './quoting.js';

const cache = createTtlCache();

export function listTablesAndViews(db) {
  return db
    .prepare(
      "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((row) => ({ name: row.name, kind: row.type }));
}

function probeHasRowid(db, tableName) {
  try {
    db.prepare(`SELECT rowid FROM ${quoteIdentifier(tableName)} LIMIT 0`).all();
    return true;
  } catch {
    return false; // WITHOUT ROWID table
  }
}

function buildColumns(xinfoRows) {
  return xinfoRows.map((row) => {
    const sqlType = (row.type ?? '').trim();
    const isGenerated = row.hidden === 2 || row.hidden === 3;
    return {
      name: row.name,
      sqlType,
      nullable: row.notnull === 0,
      defaultValue: row.dflt_value,
      isPrimaryKey: row.pk > 0,
      primaryKeyOrder: row.pk,
      isGenerated,
      generatedKind: row.hidden === 2 ? 'virtual' : row.hidden === 3 ? 'stored' : null,
      isIdentity: false, // filled in below once we know the full PK shape
      writable: !isGenerated,
    };
  });
}

function loadTableMetadata(db, tableName, kind) {
  const xinfo = db.prepare(`PRAGMA table_xinfo(${quoteIdentifier(tableName)})`).all();
  const columns = buildColumns(xinfo);

  const primaryKeyColumns = columns
    .filter((c) => c.isPrimaryKey)
    .sort((a, b) => a.primaryKeyOrder - b.primaryKeyOrder)
    .map((c) => c.name);

  if (primaryKeyColumns.length === 1) {
    const col = columns.find((c) => c.name === primaryKeyColumns[0]);
    if (col && /^integer$/i.test(col.sqlType)) {
      col.isIdentity = true;
    }
  }

  const indexList = kind === 'table' ? db.prepare(`PRAGMA index_list(${quoteIdentifier(tableName)})`).all() : [];
  const uniqueConstraints = [];
  for (const idx of indexList) {
    if (idx.unique !== 1 || idx.origin === 'pk') continue;
    const info = db.prepare(`PRAGMA index_info(${quoteIdentifier(idx.name)})`).all();
    uniqueConstraints.push({
      name: idx.name,
      columns: info.sort((a, b) => a.seqno - b.seqno).map((r) => r.name),
    });
  }

  const fkRows = kind === 'table' ? db.prepare(`PRAGMA foreign_key_list(${quoteIdentifier(tableName)})`).all() : [];
  const fkById = new Map();
  for (const row of fkRows) {
    if (!fkById.has(row.id)) {
      fkById.set(row.id, { table: row.table, onDelete: row.on_delete, onUpdate: row.on_update, columns: [] });
    }
    fkById.get(row.id).columns.push({ from: row.from, to: row.to, seq: row.seq });
  }
  const foreignKeys = [...fkById.values()].map((fk) => ({
    ...fk,
    columns: fk.columns.sort((a, b) => a.seq - b.seq).map(({ from, to }) => ({ from, to })),
  }));

  let keyColumns = primaryKeyColumns;
  let readOnlyReason = null;
  if (keyColumns.length === 0) {
    if (kind === 'view') {
      readOnlyReason = 'Views are read-only.';
    } else if (probeHasRowid(db, tableName)) {
      keyColumns = ['rowid'];
    } else {
      readOnlyReason = 'This table has no primary key and no usable rowid, so rows cannot be uniquely addressed for editing.';
    }
  } else if (kind === 'view') {
    readOnlyReason = 'Views are read-only.';
  }

  const writable = kind === 'table' && keyColumns.length > 0;

  return {
    name: tableName,
    kind,
    columns,
    primaryKeyColumns,
    uniqueConstraints,
    foreignKeys,
    keyColumns,
    writable,
    readOnlyReason: writable ? null : readOnlyReason,
  };
}

export function getTableMetadata(sourceId, db, tableName, kind, ttlMs) {
  const cacheKey = `${sourceId}::${tableName}`;
  const cached = cache.get(cacheKey, ttlMs);
  if (cached) return cached;
  const metadata = loadTableMetadata(db, tableName, kind);
  cache.set(cacheKey, metadata);
  return metadata;
}

export function invalidateMetadataCache(sourceId) {
  cache.deleteBySourceId(sourceId);
}

export function getRowCount(db, tableName, whereClause = '', params = []) {
  const sql = `SELECT COUNT(*) AS c FROM ${quoteIdentifier(tableName)}${whereClause ? ` WHERE ${whereClause}` : ''}`;
  const row = db.prepare(sql).get(...params);
  return Number(row.c);
}
