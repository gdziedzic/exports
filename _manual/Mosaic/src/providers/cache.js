/**
 * Small TTL-keyed cache. Callers pass ttlMs on every get/set so the
 * configured metadataCacheTtlMs can change without recreating caches.
 * ttlMs <= 0 means "always expired" (effectively no caching - every get
 * misses). Pass Infinity for "never expire".
 */
export function createTtlCache() {
  const store = new Map();

  return {
    get(key, ttlMs) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (ttlMs <= 0 || Date.now() - entry.at > ttlMs) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      store.set(key, { value, at: Date.now() });
    },
    delete(key) {
      store.delete(key);
    },
    deleteBySourceId(sourceId) {
      for (const key of store.keys()) {
        if (key.startsWith(`${sourceId}::`)) store.delete(key);
      }
    },
    clear() {
      store.clear();
    },
  };
}
