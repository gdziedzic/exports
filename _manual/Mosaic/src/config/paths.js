import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The application content directory is always resolved relative to this
// module's own location (two levels up: src/config/ -> project root), never
// to process.cwd(). This keeps behavior identical whether Mosaic is started
// via `node server.js`, `npm start`, a Task Scheduler entry, or from any
// other working directory.
const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
export const CONTENT_DIR = path.resolve(thisDir, '..', '..');

export function contentPath(...segments) {
  return path.resolve(CONTENT_DIR, ...segments);
}

/**
 * Resolve `relativePath` beneath `rootDir` and verify the canonical result
 * stays within it (rejects .. traversal and symlink escapes). Returns the
 * resolved absolute path, or throws PathEscapeError.
 */
export class PathEscapeError extends Error {
  constructor(relativePath) {
    super(`Path escapes allowed root: ${relativePath}`);
    this.name = 'PathEscapeError';
    this.relativePath = relativePath;
  }
}

export function resolveWithinRoot(rootDir, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new PathEscapeError(String(relativePath));
  }
  // Reject absolute paths, UNC paths, and device paths outright - only
  // plain relative paths beneath the configured root are ever accepted.
  if (
    path.isAbsolute(relativePath) ||
    relativePath.startsWith('\\\\') ||
    relativePath.startsWith('//') ||
    /^[a-zA-Z]:/.test(relativePath) ||
    relativePath.startsWith('\\\\?\\') ||
    relativePath.includes('\0')
  ) {
    throw new PathEscapeError(relativePath);
  }

  const resolvedRoot = path.resolve(rootDir);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relativeFromRoot = path.relative(resolvedRoot, resolved);

  if (
    relativeFromRoot === '' ||
    relativeFromRoot.startsWith('..') ||
    path.isAbsolute(relativeFromRoot)
  ) {
    throw new PathEscapeError(relativePath);
  }

  return resolved;
}

/**
 * Same as resolveWithinRoot, but also resolves symlinks (realpath) and
 * re-checks containment, so a symlink inside the root that points outside
 * it is rejected. The target must already exist on disk.
 */
export async function resolveRealPathWithinRoot(rootDir, relativePath, fsModule) {
  const fs = fsModule ?? (await import('node:fs/promises'));
  const resolved = resolveWithinRoot(rootDir, relativePath);
  const real = await fs.realpath(resolved);
  const resolvedRoot = path.resolve(rootDir);
  const realRoot = await fs.realpath(resolvedRoot);
  const relativeFromRoot = path.relative(realRoot, real);
  if (
    relativeFromRoot === '' ||
    relativeFromRoot.startsWith('..') ||
    path.isAbsolute(relativeFromRoot)
  ) {
    throw new PathEscapeError(relativePath);
  }
  return real;
}
