import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { exportRows } from '../../src/explorer/export.js';

function createFakeRes({ writeReturns = true } = {}) {
  const res = new EventEmitter();
  res.chunks = [];
  res.headers = {};
  res.statusCode = null;
  res.ended = false;
  res.destroyed = false;
  res.setHeader = (key, value) => {
    res.headers[key] = value;
  };
  res.write = (chunk) => {
    res.chunks.push(chunk);
    return writeReturns;
  };
  res.end = () => {
    res.ended = true;
  };
  res.destroy = () => {
    res.destroyed = true;
  };
  return res;
}

function createFakeLogger() {
  const calls = [];
  return {
    calls,
    warn: (message, meta) => calls.push(['warn', message, meta]),
    info: (message, meta) => calls.push(['info', message, meta]),
  };
}

const ROWS = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];
const SETTINGS = { exportLimits: { maxRows: 1000, maxBytes: 1_000_000 } };

test('streams CSV rows with a header line, ending the response normally', async () => {
  const res = createFakeRes();
  await exportRows(res, { format: 'csv', filenameBase: 'people', settings: SETTINGS, fetchRows: async () => ({ rows: ROWS }) });

  assert.equal(res.headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.match(res.headers['Content-Disposition'], /people\.csv/);
  const body = res.chunks.join('');
  assert.equal(body, 'id,name\r\n1,Alice\r\n2,Bob\r\n');
  assert.ok(res.ended);
  assert.ok(!res.destroyed);
});

test('streams a JSON array without buffering the whole body into one chunk', async () => {
  const res = createFakeRes();
  await exportRows(res, { format: 'json', filenameBase: 'people', settings: SETTINGS, fetchRows: async () => ({ rows: ROWS }) });

  assert.equal(res.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.ok(res.chunks.length > 1, 'expected multiple chunks (streamed, not one buffered write)');
  const body = res.chunks.join('');
  assert.deepEqual(JSON.parse(body), ROWS);
  assert.ok(res.ended);
});

test('an empty result set still produces a valid (empty) CSV/JSON body', async () => {
  const csvRes = createFakeRes();
  await exportRows(csvRes, { format: 'csv', filenameBase: 'empty', settings: SETTINGS, fetchRows: async () => ({ rows: [] }) });
  assert.equal(csvRes.chunks.join(''), '\r\n');

  const jsonRes = createFakeRes();
  await exportRows(jsonRes, { format: 'json', filenameBase: 'empty', settings: SETTINGS, fetchRows: async () => ({ rows: [] }) });
  assert.deepEqual(JSON.parse(jsonRes.chunks.join('')), []);
});

test('write() returning false makes exportRows wait for drain before writing the next chunk', async () => {
  const res = createFakeRes({ writeReturns: false });
  const chunkCountAtFirstWrite = [];
  const originalWrite = res.write;
  let writeCalls = 0;
  res.write = (chunk) => {
    writeCalls++;
    chunkCountAtFirstWrite.push(writeCalls);
    return originalWrite(chunk);
  };

  const promise = exportRows(res, { format: 'csv', filenameBase: 'people', settings: SETTINGS, fetchRows: async () => ({ rows: ROWS }) });

  // Only the header line should have been written so far - exportRows is
  // now awaiting 'drain' rather than writing the remaining rows.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(res.chunks.length, 1);
  assert.ok(!res.ended);

  // Draining once per pending write lets the export proceed to completion.
  res.emit('drain');
  await new Promise((resolve) => setImmediate(resolve));
  res.emit('drain');
  await new Promise((resolve) => setImmediate(resolve));
  res.emit('drain');
  await promise;

  assert.ok(res.ended);
  assert.equal(res.chunks.join(''), 'id,name\r\n1,Alice\r\n2,Bob\r\n');
});

test('exceeding the configured byte cap aborts the connection instead of emitting a silently-truncated file', async () => {
  const res = createFakeRes();
  const logger = createFakeLogger();
  const manyRows = Array.from({ length: 100 }, (_, i) => ({ id: i, name: 'x'.repeat(50) }));
  const tinyLimitSettings = { exportLimits: { maxRows: 1000, maxBytes: 200 } };

  await exportRows(res, { format: 'csv', filenameBase: 'big', settings: tinyLimitSettings, fetchRows: async () => ({ rows: manyRows }), logger, requestId: 'req-1' });

  assert.ok(res.destroyed, 'connection should be aborted, not silently ended');
  assert.ok(!res.ended);
  assert.ok(logger.calls.some(([level, message]) => level === 'warn' && message === 'export_truncated'));
});

test('the client disconnecting mid-export (close before drain) aborts gracefully without throwing', async () => {
  const res = createFakeRes({ writeReturns: false });
  const logger = createFakeLogger();

  const promise = exportRows(res, { format: 'csv', filenameBase: 'people', settings: SETTINGS, fetchRows: async () => ({ rows: ROWS }), logger, requestId: 'req-2' });

  await new Promise((resolve) => setImmediate(resolve));
  res.emit('close');
  await assert.doesNotReject(promise);

  assert.ok(res.destroyed);
  assert.ok(logger.calls.some(([level, message]) => level === 'info' && message === 'export_aborted'));
});

test('binary values are hex-encoded consistently in both CSV and JSON output', async () => {
  const rows = [{ id: 1, blob: Buffer.from([0xde, 0xad, 0xbe, 0xef]) }];

  const csvRes = createFakeRes();
  await exportRows(csvRes, { format: 'csv', filenameBase: 'bin', settings: SETTINGS, fetchRows: async () => ({ rows }) });
  assert.match(csvRes.chunks.join(''), /0xdeadbeef/);

  const jsonRes = createFakeRes();
  await exportRows(jsonRes, { format: 'json', filenameBase: 'bin', settings: SETTINGS, fetchRows: async () => ({ rows }) });
  assert.deepEqual(JSON.parse(jsonRes.chunks.join('')), [{ id: 1, blob: '0xdeadbeef' }]);
});

test('CSV fields containing commas, quotes, or newlines are RFC 4180 quoted', async () => {
  const rows = [{ note: 'has, comma' }, { note: 'has "quote"' }, { note: 'has\nnewline' }];
  const res = createFakeRes();
  await exportRows(res, { format: 'csv', filenameBase: 'notes', settings: SETTINGS, fetchRows: async () => ({ rows }) });
  const body = res.chunks.join('');
  assert.match(body, /"has, comma"/);
  assert.match(body, /"has ""quote"""/);
  assert.match(body, /"has\nnewline"/);
});
