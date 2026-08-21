import test from 'node:test';
import assert from 'node:assert/strict';
import { Router } from '../../src/http/router.js';

test('matches a static route', () => {
  const router = new Router();
  router.get('/health/live', () => 'live');
  const match = router.match('GET', '/health/live');
  assert.ok(match && !match.methodNotAllowed);
  assert.equal(match.handler(), 'live');
});

test('matches a route with named params and decodes them', () => {
  const router = new Router();
  router.get('/sources/:sourceId/:schema/:table', () => {});
  const match = router.match('GET', '/sources/sales-primary/dbo/My%20Orders');
  assert.deepEqual(match.params, { sourceId: 'sales-primary', schema: 'dbo', table: 'My Orders' });
});

test('does not match when segment counts differ', () => {
  const router = new Router();
  router.get('/sources/:sourceId', () => {});
  assert.equal(router.match('GET', '/sources/a/b'), null);
});

test('returns methodNotAllowed with the allowed method list on a known path/wrong method', () => {
  const router = new Router();
  router.get('/sources/:sourceId', () => {});
  router.post('/sources/:sourceId', () => {});
  const match = router.match('DELETE', '/sources/a');
  assert.ok(match.methodNotAllowed);
  assert.deepEqual(match.allowedMethods.sort(), ['GET', 'POST']);
});

test('returns null for a completely unknown path', () => {
  const router = new Router();
  router.get('/known', () => {});
  assert.equal(router.match('GET', '/unknown'), null);
});

test('static segments must match literally, not just by param-fallback', () => {
  const router = new Router();
  router.get('/pages/:pageId/export.csv', () => 'csv');
  router.get('/pages/:pageId/export.json', () => 'json');
  const csv = router.match('GET', '/pages/ops/export.csv');
  assert.equal(csv.handler(), 'csv');
  const json = router.match('GET', '/pages/ops/export.json');
  assert.equal(json.handler(), 'json');
});

test('rejects malformed percent-encoding rather than throwing', () => {
  const router = new Router();
  router.get('/sources/:sourceId', () => {});
  assert.equal(router.match('GET', '/sources/%'), null);
});

test('method matching is case-insensitive on the declared method', () => {
  const router = new Router();
  router.add('get', '/x', () => 'ok');
  const match = router.match('GET', '/x');
  assert.ok(match && !match.methodNotAllowed);
});
