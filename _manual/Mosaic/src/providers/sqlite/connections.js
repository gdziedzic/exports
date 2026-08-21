import { DatabaseSync } from 'node:sqlite';
import { parseSqliteDataSource, resolveConnectionString } from '../../config/sources.js';

// One isolated DatabaseSync per source ID - never shared, never keyed by
// anything else, so nothing can leak across two SQLite sources even if they
// happen to point at similarly-named tables.
const connections = new Map();

export function getConnection(source) {
  let db = connections.get(source.id);
  if (!db) {
    const dbPath = parseSqliteDataSource(resolveConnectionString(source));
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec('PRAGMA foreign_keys = ON');
    connections.set(source.id, db);
  }
  return db;
}

export function closeConnection(sourceId) {
  const db = connections.get(sourceId);
  if (db) {
    try {
      db.close();
    } catch {
      // already closed / never opened - fine during shutdown
    }
    connections.delete(sourceId);
  }
}

export function closeAllConnections() {
  for (const sourceId of [...connections.keys()]) {
    closeConnection(sourceId);
  }
}
