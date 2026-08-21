import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureCsrfToken, verifyCsrf, CsrfError, CSRF_COOKIE_NAME } from '../../src/http/csrf.js';

function fakeRes() {
  const headers = {};
  return {
    getHeader: (name) => headers[name],
    setHeader: (name, value) => {
      headers[name] = value;
    },
    headers,
  };
}

function fakeReq({ cookie, origin, referer, host = 'localhost:4930', secFetchSite } = {}) {
  return { headers: { cookie, origin, referer, host, 'sec-fetch-site': secFetchSite } };
}

test('ensureCsrfToken mints a new token and sets a cookie when none present', () => {
  const req = fakeReq({});
  const res = fakeRes();
  const token = ensureCsrfToken(req, res);
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.ok(res.headers['Set-Cookie'][0].includes(CSRF_COOKIE_NAME));
});

test('ensureCsrfToken reuses an existing well-formed cookie token without re-setting it', () => {
  const existing = 'a'.repeat(64);
  const req = fakeReq({ cookie: `${CSRF_COOKIE_NAME}=${existing}` });
  const res = fakeRes();
  const token = ensureCsrfToken(req, res);
  assert.equal(token, existing);
  assert.equal(res.headers['Set-Cookie'], undefined);
});

test('verifyCsrf succeeds when cookie, form token, and Origin all match', () => {
  const token = 'b'.repeat(64);
  const req = fakeReq({ cookie: `${CSRF_COOKIE_NAME}=${token}`, origin: 'http://localhost:4930' });
  assert.doesNotThrow(() => verifyCsrf(req, token));
});

test('verifyCsrf falls back to Referer when Origin is absent', () => {
  const token = 'c'.repeat(64);
  const req = fakeReq({ cookie: `${CSRF_COOKIE_NAME}=${token}`, referer: 'http://localhost:4930/sources/x' });
  assert.doesNotThrow(() => verifyCsrf(req, token));
});

test('verifyCsrf rejects a missing CSRF cookie', () => {
  const req = fakeReq({ origin: 'http://localhost:4930' });
  assert.throws(() => verifyCsrf(req, 'd'.repeat(64)), CsrfError);
});

test('verifyCsrf rejects a form token that does not match the cookie', () => {
  const token = 'e'.repeat(64);
  const req = fakeReq({ cookie: `${CSRF_COOKIE_NAME}=${token}`, origin: 'http://localhost:4930' });
  assert.throws(() => verifyCsrf(req, 'f'.repeat(64)), CsrfError);
});

test('verifyCsrf rejects when Origin host does not match request Host', () => {
  const token = 'a1'.repeat(32);
  const req = fakeReq({ cookie: `${CSRF_COOKIE_NAME}=${token}`, origin: 'http://evil.example' });
  assert.throws(() => verifyCsrf(req, token), CsrfError);
});

test('verifyCsrf rejects when both Origin and Referer are absent', () => {
  const token = 'a2'.repeat(32);
  const req = fakeReq({ cookie: `${CSRF_COOKIE_NAME}=${token}` });
  assert.throws(() => verifyCsrf(req, token), CsrfError);
});

test('verifyCsrf rejects a malformed (non-hex or wrong-length) token', () => {
  const req = fakeReq({ cookie: `${CSRF_COOKIE_NAME}=not-hex`, origin: 'http://localhost:4930' });
  assert.throws(() => verifyCsrf(req, 'not-hex'), CsrfError);
});

test('verifyCsrf accepts Sec-Fetch-Site: same-origin even with no Origin/Referer at all', () => {
  const token = 'a3'.repeat(32);
  const req = fakeReq({ cookie: `${CSRF_COOKIE_NAME}=${token}`, secFetchSite: 'same-origin' });
  assert.doesNotThrow(() => verifyCsrf(req, token));
});

test('verifyCsrf accepts Sec-Fetch-Site: same-origin even when Origin is a spec-legal opaque "null"', () => {
  // Browsers legitimately send a literal "null" Origin in some situations (opaque origins,
  // certain redirect/privacy cases) that new URL() can't parse - Sec-Fetch-Site sidesteps that.
  const token = 'a4'.repeat(32);
  const req = fakeReq({ cookie: `${CSRF_COOKIE_NAME}=${token}`, origin: 'null', secFetchSite: 'same-origin' });
  assert.doesNotThrow(() => verifyCsrf(req, token));
});

test('verifyCsrf accepts Sec-Fetch-Site: none (direct navigation, no referring page)', () => {
  const token = 'a5'.repeat(32);
  const req = fakeReq({ cookie: `${CSRF_COOKIE_NAME}=${token}`, secFetchSite: 'none' });
  assert.doesNotThrow(() => verifyCsrf(req, token));
});

test('verifyCsrf rejects Sec-Fetch-Site: cross-site even when Origin would otherwise match', () => {
  const token = 'a6'.repeat(32);
  const req = fakeReq({ cookie: `${CSRF_COOKIE_NAME}=${token}`, origin: 'http://localhost:4930', secFetchSite: 'cross-site' });
  assert.throws(() => verifyCsrf(req, token), CsrfError);
});

test('verifyCsrf falls back to Origin/Referer when Sec-Fetch-Site is absent (older browsers)', () => {
  // A malformed Origin with no Sec-Fetch-Site header still fails, as before.
  const token = 'a7'.repeat(32);
  const req = fakeReq({ cookie: `${CSRF_COOKIE_NAME}=${token}`, origin: 'null' });
  assert.throws(() => verifyCsrf(req, token), CsrfError);
});

