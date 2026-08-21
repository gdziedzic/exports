import crypto from 'node:crypto';
import { parseCookies, serializeCookie, appendSetCookie } from './cookies.js';

export const CSRF_COOKIE_NAME = 'mosaic_csrf';
export const CSRF_FIELD_NAME = '_csrf';
const TOKEN_BYTES = 32;
const HEX_TOKEN_LENGTH = TOKEN_BYTES * 2;

function isValidTokenFormat(token) {
  return typeof token === 'string' && /^[0-9a-f]{64}$/.test(token) && token.length === HEX_TOKEN_LENGTH;
}

function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Returns the CSRF token to embed in any form rendered for this request,
 * reusing the existing cookie token if present and well-formed, otherwise
 * minting a new one and queuing a Set-Cookie on `res`.
 */
export function ensureCsrfToken(req, res, { secure = false } = {}) {
  const cookies = parseCookies(req.headers.cookie);
  const existing = cookies[CSRF_COOKIE_NAME];
  if (isValidTokenFormat(existing)) {
    return existing;
  }
  const token = generateToken();
  appendSetCookie(
    res,
    serializeCookie(CSRF_COOKIE_NAME, token, { httpOnly: true, sameSite: 'Strict', secure }),
  );
  return token;
}

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length) {
    // Compare against a same-length dummy so the operation is still
    // constant-time relative to the (public) expected token length.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export class CsrfError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CsrfError';
  }
}

/**
 * Validates a state-changing (POST) request: the submitted form token must
 * match the request's CSRF cookie via constant-time comparison, and the
 * request's source must be verified as same-origin.
 *
 * Same-origin verification prefers the `Sec-Fetch-Site` Fetch Metadata
 * header when the browser sends it (every evergreen browser, for several
 * years now): it's set by the browser itself from information no page
 * script or extension can influence, so `same-origin`/`none` is stronger
 * proof than Origin/Referer - and unlike Origin/Referer, it can't come back
 * missing or spec-legally opaque ("null") for a same-origin request, which
 * Origin can for reasons outside this app's control (privacy extensions,
 * redirect bounces, etc). Falls back to Origin (then Referer) only when
 * Sec-Fetch-Site is absent, for older clients. Throws CsrfError on any
 * failure.
 */
export function verifyCsrf(req, formToken, { trustedHost } = {}) {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE_NAME];

  if (!isValidTokenFormat(cookieToken)) {
    throw new CsrfError('Missing or malformed CSRF cookie');
  }
  if (!isValidTokenFormat(formToken)) {
    throw new CsrfError('Missing or malformed CSRF form token');
  }
  if (!timingSafeEqualStrings(cookieToken, formToken)) {
    throw new CsrfError('CSRF token mismatch');
  }

  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite === 'same-origin' || secFetchSite === 'none') {
    return;
  }
  if (secFetchSite) {
    throw new CsrfError(`Cross-site request (Sec-Fetch-Site: ${secFetchSite})`);
  }

  const host = trustedHost ?? req.headers.host;
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  let sourceHost = null;
  if (origin) {
    try {
      sourceHost = new URL(origin).host;
    } catch {
      throw new CsrfError('Malformed Origin header');
    }
  } else if (referer) {
    try {
      sourceHost = new URL(referer).host;
    } catch {
      throw new CsrfError('Malformed Referer header');
    }
  } else {
    throw new CsrfError('Missing Origin and Referer headers on state-changing request');
  }

  if (!host || sourceHost !== host) {
    throw new CsrfError(`Origin/Referer host "${sourceHost}" does not match request Host "${host}"`);
  }
}
