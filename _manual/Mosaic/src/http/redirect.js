/**
 * Validates that `target` is a safe local redirect destination: a path
 * beginning with a single "/" (never "//" or "/\" which browsers treat as
 * protocol-relative), containing no scheme, and no CR/LF (header injection).
 */
export function isSafeLocalRedirect(target) {
  if (typeof target !== 'string' || target.length === 0) return false;
  if (!target.startsWith('/')) return false;
  if (target.startsWith('//') || target.startsWith('/\\')) return false;
  if (/[\r\n]/.test(target)) return false;
  try {
    // A relative path parsed against any base must stay same-origin.
    const url = new URL(target, 'http://mosaic.invalid');
    return url.origin === 'http://mosaic.invalid';
  } catch {
    return false;
  }
}

export function redirect(res, target, status = 303) {
  if (!isSafeLocalRedirect(target)) {
    throw new Error(`Refusing to redirect to unsafe target: ${target}`);
  }
  res.statusCode = status;
  res.setHeader('Location', target);
  res.end();
}
