import { encodeRowKey } from './rowKey.js';

/** Best-effort map of column name -> {sourceId, schema, table, rowKey(value)} for single-column FKs whose target has a matching single-column key. */
export async function buildForeignKeyLinks(adapter, source, metadata) {
  const map = new Map();
  const tables = await adapter.listTablesAndViews();
  for (const fk of metadata.foreignKeys) {
    if (fk.columns.length !== 1) continue;
    try {
      const targetTable = tables.find((t) => t.name === fk.table && (fk.schema ? t.schema === fk.schema : true));
      if (!targetTable) continue;
      const targetMeta = await adapter.getTableMetadata(targetTable.schema, fk.table, targetTable.kind, Infinity);
      if (targetMeta.keyColumns.length !== 1 || targetMeta.keyColumns[0] !== fk.columns[0].to) continue;
      map.set(fk.columns[0].from, {
        sourceId: source.id,
        schema: targetTable.schema,
        table: fk.table,
        rowKey: (value) => encodeRowKey(targetMeta.keyColumns, { [targetMeta.keyColumns[0]]: value }),
      });
    } catch {
      // best-effort - a broken FK target just means no link, not an error
    }
  }
  return map;
}
