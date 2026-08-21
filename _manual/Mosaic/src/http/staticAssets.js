import fs from 'node:fs';
import path from 'node:path';
import { resolveWithinRoot, PathEscapeError } from '../config/paths.js';
import { cacheStaticAsset } from './securityHeaders.js';
import { HttpError } from './errors.js';

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/**
 * Serves a single static asset from `publicDir`. `relativeName` must be a
 * plain filename/relative path with no traversal, verified via
 * resolveWithinRoot. Only extensions in CONTENT_TYPES are ever served.
 */
export function serveStaticAsset(res, publicDir, relativeName) {
  const ext = path.extname(relativeName).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    throw new HttpError(404, 'Not found.');
  }

  let resolved;
  try {
    resolved = resolveWithinRoot(publicDir, relativeName);
  } catch (err) {
    if (err instanceof PathEscapeError) throw new HttpError(404, 'Not found.');
    throw err;
  }

  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    throw new HttpError(404, 'Not found.');
  }
  if (!stat.isFile()) {
    throw new HttpError(404, 'Not found.');
  }

  const etag = `"${stat.size}-${stat.mtimeMs}"`;
  res.setHeader('ETag', etag);
  cacheStaticAsset(res);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stat.size);
  res.statusCode = 200;

  const stream = fs.createReadStream(resolved);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}
