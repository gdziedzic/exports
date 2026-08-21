import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { validateSources, parseSqliteDataSource, sourcesById } from '../../src/config/sources.js';
import { CONTENT_DIR } from '../../src/config/paths.js';

test('validateSources accepts the checked-in default sources.json shape', () => {
  const config = {
    sources: [
      { id: 'a', name: 'A', provider: 'sqlite', connectionString: 'Data Source=data/a.db', allowWrites: true },
      { id: 'b', name: 'B', provider: 'csv', path: 'data/products.csv' },
    ],
  };
  const issues = validateSources(config, { env: {} });
  assert.ok(issues.ok, JSON.stringify(issues.issues));
});

test('validateSources rejects duplicate ids', () => {
  const config = {
    sources: [
      { id: 'dup', name: 'A', provider: 'sqlite', connectionString: 'Data Source=data/a.db' },
      { id: 'dup', name: 'B', provider: 'sqlite', connectionString: 'Data Source=data/b.db' },
    ],
  };
  const issues = validateSources(config, { env: {} });
  assert.ok(!issues.ok);
  assert.ok(issues.issues.some((i) => i.message.includes('duplicate')));
});

test('validateSources requires exactly one of connectionString / connectionStringEnvironmentVariable', () => {
  const both = {
    sources: [
      {
        id: 'x',
        name: 'X',
        provider: 'sqlserver',
        connectionString: 'Server=.;',
        connectionStringEnvironmentVariable: 'FOO',
      },
    ],
  };
  assert.ok(!validateSources(both, { env: { FOO: 'y' } }).ok);

  const neither = { sources: [{ id: 'x', name: 'X', provider: 'sqlserver' }] };
  assert.ok(!validateSources(neither, { env: {} }).ok);
});

test('validateSources requires the referenced env var to be set', () => {
  const config = {
    sources: [
      { id: 'x', name: 'X', provider: 'sqlserver', connectionStringEnvironmentVariable: 'MOSAIC_TEST_UNSET' },
    ],
  };
  const issues = validateSources(config, { env: {} });
  assert.ok(!issues.ok);
});

test('validateSources rejects an unknown provider', () => {
  const config = { sources: [{ id: 'x', name: 'X', provider: 'mongodb' }] };
  assert.ok(!validateSources(config, { env: {} }).ok);
});

test('validateSources rejects a file source path that escapes the content root', () => {
  const config = { sources: [{ id: 'x', name: 'X', provider: 'csv', path: '../../etc/passwd' }] };
  const issues = validateSources(config, { env: {} });
  assert.ok(!issues.ok);
});

test('validateSources rejects a file source path that does not exist', () => {
  const config = { sources: [{ id: 'x', name: 'X', provider: 'json', path: 'data/does-not-exist.json' }] };
  const issues = validateSources(config, { env: {} });
  assert.ok(!issues.ok);
  assert.ok(issues.issues.some((i) => i.message.includes('does not exist')));
});

test('validateSources requires xml sources to declare recordPath', () => {
  const config = { sources: [{ id: 'x', name: 'X', provider: 'xml', path: 'data/catalog.xml' }] };
  const issues = validateSources(config, { env: {} });
  assert.ok(!issues.ok);
  assert.ok(issues.issues.some((i) => i.path.endsWith('recordPath')));
});

test('validateSources accepts a well-formed xml source', () => {
  const config = {
    sources: [{ id: 'x', name: 'X', provider: 'xml', path: 'data/catalog.xml', recordPath: 'Catalog/Products/Product' }],
  };
  const issues = validateSources(config, { env: {} });
  assert.ok(issues.ok, JSON.stringify(issues.issues));
});

test('parseSqliteDataSource resolves a Data Source connection string within the content root', () => {
  const resolved = parseSqliteDataSource('Data Source=data/reference.db');
  assert.ok(resolved.startsWith(CONTENT_DIR));
  assert.ok(resolved.endsWith(path.join('data', 'reference.db')));
});

test('parseSqliteDataSource rejects a path escaping the content root', () => {
  assert.throws(() => parseSqliteDataSource('Data Source=../../outside.db'));
});

test('parseSqliteDataSource rejects a malformed connection string', () => {
  assert.throws(() => parseSqliteDataSource('Server=.;Database=x'));
});

test('sourcesById builds a lookup map keyed by id', () => {
  const map = sourcesById([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  assert.equal(map.get('a').name, 'A');
  assert.equal(map.size, 2);
});

test('no cross-source leakage: sourcesById never merges same-provider sources', () => {
  const sources = [
    { id: 'sql-1', name: 'One', provider: 'sqlite', connectionString: 'Data Source=data/one.db' },
    { id: 'sql-2', name: 'Two', provider: 'sqlite', connectionString: 'Data Source=data/two.db' },
  ];
  const map = sourcesById(sources);
  assert.notEqual(map.get('sql-1'), map.get('sql-2'));
  assert.equal(map.get('sql-1').connectionString, 'Data Source=data/one.db');
  assert.equal(map.get('sql-2').connectionString, 'Data Source=data/two.db');
});

