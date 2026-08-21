import sql from 'mssql';
import { resolveConnectionString } from '../../config/sources.js';

// One lazily-initialized mssql.ConnectionPool per source ID - never shared,
// so nothing can leak across two SQL Server sources even if they happen to
// point at the same physical server.
const pools = new Map();

async function ensureConnected(entry) {
  if (entry.pool.connected) return entry.pool;
  if (!entry.connectPromise) {
    entry.connectPromise = entry.pool.connect().catch((err) => {
      entry.connectPromise = null;
      throw err;
    });
  }
  await entry.connectPromise;
  entry.connectPromise = null;
  return entry.pool;
}

/** A source's own `commandTimeoutMs` wins; otherwise falls back to the app-wide default. */
export function resolveRequestTimeout(source, defaultCommandTimeoutMs) {
  return source.commandTimeoutMs ?? defaultCommandTimeoutMs;
}

/**
 * Returns a connected pool for this source, creating and/or reconnecting it
 * as needed. `defaultCommandTimeoutMs` (the app-wide setting) applies unless
 * this source configures its own `commandTimeoutMs` override.
 */
export async function getConnection(source, defaultCommandTimeoutMs) {
  let entry = pools.get(source.id);
  if (!entry) {
    const connectionString = resolveConnectionString(source);
    const pool = new sql.ConnectionPool(connectionString);
    const requestTimeout = resolveRequestTimeout(source, defaultCommandTimeoutMs);
    if (requestTimeout) pool.config.requestTimeout = requestTimeout;
    // Pool-level errors (e.g. an idle connection dropped by the server) are
    // handled by reconnecting lazily on next use, not by crashing the process.
    pool.on('error', () => {});
    entry = { pool, connectPromise: null };
    pools.set(source.id, entry);
  }
  return ensureConnected(entry);
}

export async function closeConnection(sourceId) {
  const entry = pools.get(sourceId);
  if (entry) {
    pools.delete(sourceId);
    try {
      await entry.pool.close();
    } catch {
      // already closed / never connected - fine during shutdown
    }
  }
}

export async function closeAllConnections() {
  await Promise.all([...pools.keys()].map(closeConnection));
}
