import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_APPSETTINGS,
  loadAppSettings,
  validateAppSettings,
  isLoopbackHost,
} from '../../src/config/appsettings.js';
import { ConfigValidationError } from '../../src/config/errors.js';

function tmpFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-test-'));
  const filePath = path.join(dir, 'appsettings.json');
  fs.writeFileSync(filePath, content);
  return filePath;
}

test('loadAppSettings returns full defaults when file is empty object', () => {
  const filePath = tmpFile('{}');
  const settings = loadAppSettings({ filePath, env: {} });
  assert.equal(settings.host, DEFAULT_APPSETTINGS.host);
  assert.equal(settings.port, DEFAULT_APPSETTINGS.port);
  assert.deepEqual(settings.pageSize, { ...DEFAULT_APPSETTINGS.pageSize });
});

test('loadAppSettings merges partial overrides with defaults', () => {
  const filePath = tmpFile(JSON.stringify({ port: 9000, logging: { level: 'debug' } }));
  const settings = loadAppSettings({ filePath, env: {} });
  assert.equal(settings.port, 9000);
  assert.equal(settings.logging.level, 'debug');
  assert.equal(settings.logging.directory, DEFAULT_APPSETTINGS.logging.directory);
});

test('loadAppSettings applies MOSAIC_* env overrides on top of the file', () => {
  const filePath = tmpFile(JSON.stringify({ port: 9000 }));
  const settings = loadAppSettings({
    filePath,
    env: { MOSAIC_PORT: '9100', MOSAIC_DEV_MODE: 'true', MOSAIC_PAGE_SIZE_MAX: '1000' },
  });
  assert.equal(settings.port, 9100);
  assert.equal(settings.developmentMode, true);
  assert.equal(settings.pageSize.max, 1000);
});

test('loadAppSettings throws ConfigValidationError on malformed JSON', () => {
  const filePath = tmpFile('{ not json');
  assert.throws(() => loadAppSettings({ filePath, env: {} }), ConfigValidationError);
});

test('loadAppSettings throws on invalid port', () => {
  const filePath = tmpFile(JSON.stringify({ port: 999999 }));
  assert.throws(() => loadAppSettings({ filePath, env: {} }), (err) => {
    assert.ok(err instanceof ConfigValidationError);
    assert.ok(err.issues.some((i) => i.path === 'port'));
    return true;
  });
});

test('loadAppSettings throws on malformed env override', () => {
  const filePath = tmpFile('{}');
  assert.throws(() => loadAppSettings({ filePath, env: { MOSAIC_PORT: 'not-a-number' } }));
});

test('loadAppSettings fails fast when pageSize.default exceeds pageSize.max', () => {
  const filePath = tmpFile(JSON.stringify({ pageSize: { default: 100, max: 50 } }));
  assert.throws(() => loadAppSettings({ filePath, env: {} }), ConfigValidationError);
});

test('missing appsettings.json file falls back to full defaults', () => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-test-')), 'does-not-exist.json');
  const settings = loadAppSettings({ filePath, env: {} });
  assert.equal(settings.host, DEFAULT_APPSETTINGS.host);
});

test('validateAppSettings rejects unknown log level', () => {
  const settings = { ...DEFAULT_APPSETTINGS, logging: { level: 'verbose', directory: 'logs' } };
  const issues = validateAppSettings(settings);
  assert.ok(!issues.ok);
});

test('isLoopbackHost', () => {
  assert.equal(isLoopbackHost('127.0.0.1'), true);
  assert.equal(isLoopbackHost('localhost'), true);
  assert.equal(isLoopbackHost('::1'), true);
  assert.equal(isLoopbackHost('0.0.0.0'), false);
  assert.equal(isLoopbackHost('192.168.1.5'), false);
});
