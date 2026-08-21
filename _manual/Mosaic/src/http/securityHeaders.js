const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

const PERMISSIONS_POLICY = [
  'geolocation=()',
  'camera=()',
  'microphone=()',
  'payment=()',
  'usb=()',
  'interest-cohort=()',
].join(', ');

export function applySecurityHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
}

/** Disables caching for mutation responses and sensitive record pages. */
export function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
}

/** Conservative caching for static/read-mostly assets checked into public/. */
export function cacheStaticAsset(res, maxAgeSeconds = 3600) {
  res.setHeader('Cache-Control', `public, max-age=${maxAgeSeconds}`);
}
