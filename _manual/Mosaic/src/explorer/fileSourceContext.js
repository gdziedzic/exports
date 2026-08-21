import fs from 'node:fs';
import { HttpError } from '../http/errors.js';
import { parseJsonFile } from '../providers/files/json.js';
import { parseJsonlFile } from '../providers/files/jsonl.js';
import { parseCsvFile } from '../providers/files/csv.js';
import { parseXmlFile } from '../providers/files/xml.js';
import { resolveWithinRoot, CONTENT_DIR } from '../config/paths.js';
import { createTtlCache } from '../providers/cache.js';

const FILE_PROVIDERS = ['json', 'jsonl', 'csv', 'xml'];
const cache = createTtlCache();

export function findFileSource(sources, sourceId) {
  const source = sources.find((s) => s.id === sourceId);
  if (!source) throw new HttpError(404, 'Source not found.');
  if (!FILE_PROVIDERS.includes(source.provider)) throw new HttpError(404, 'That source is not a file source.');
  return source;
}

async function parseBySource(source, filePath, settings) {
  const opts = {
    maxFileSizeBytes: settings.fileLimits.maxFileSizeBytes,
    maxRecordCount: settings.fileLimits.maxRecordCount,
    encoding: source.encoding ?? 'utf8',
  };
  switch (source.provider) {
    case 'json':
      return parseJsonFile(filePath, { ...opts, rootProperty: source.rootProperty });
    case 'jsonl':
      return parseJsonlFile(filePath, opts);
    case 'csv':
      return parseCsvFile(filePath, {
        ...opts,
        delimiter: source.delimiter ?? ',',
        quote: source.quote ?? '"',
        hasHeader: source.hasHeader ?? true,
      });
    case 'xml':
      return parseXmlFile(filePath, { ...opts, recordPath: source.recordPath, attributePrefix: source.attributePrefix ?? '@' });
    default:
      throw new HttpError(500, 'Unknown file provider.');
  }
}

/**
 * Parses (and caches, keyed by source ID + file mtime, so an edited file is
 * picked up automatically) a file source into { columns, records, truncated,
 * warnings }. Never mutates the source file - these providers are read-only.
 */
export async function loadFileSource(source, settings) {
  const filePath = resolveWithinRoot(CONTENT_DIR, source.path);
  const stat = fs.statSync(filePath);
  const cacheKey = `${source.id}::${stat.mtimeMs}`;

  const cached = cache.get(cacheKey, settings.metadataCacheTtlMs);
  if (cached) return cached;

  const result = await parseBySource(source, filePath, settings);
  cache.deleteBySourceId(source.id);
  cache.set(cacheKey, result);
  return result;
}
