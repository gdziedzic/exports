import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadPages, validatePageConfig, referencedParamNames } from '../../src/config/pages.js';

function makePagesDir(pages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-pages-'));
  for (const [dirName, files] of Object.entries(pages)) {
    for (const [relPath, content] of Object.entries(files)) {
      const filePath = path.join(dir, dirName, relPath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content));
    }
  }
  return dir;
}

const sources = [
  { id: 'sqlite-a', provider: 'sqlite', allowWrites: true },
  { id: 'sqlite-b', provider: 'sqlite', allowWrites: false },
  { id: 'csv-a', provider: 'csv' },
];

test('referencedParamNames finds @Name tokens', () => {
  assert.deepEqual([...referencedParamNames('SELECT * FROM t WHERE a=@Foo AND b=@Bar')].sort(), ['Bar', 'Foo']);
});

test('loads a valid single-block page', () => {
  const dir = makePagesDir({
    'ops': {
      'page.json': { id: 'ops', title: 'Ops', blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'table' }] },
      'q.sql': 'SELECT 1',
    },
  });
  const { pages, invalid } = loadPages(sources, { pagesDir: dir });
  assert.equal(invalid.size, 0);
  assert.equal(pages.size, 1);
  assert.ok(pages.has('ops'));
});

test('isolates a page whose block references a nonexistent source, without throwing', () => {
  const dir = makePagesDir({
    'bad': {
      'page.json': { id: 'bad', title: 'Bad', blocks: [{ id: 'b1', title: 'B1', sourceId: 'nope', query: 'q.sql', presentation: 'table' }] },
      'q.sql': 'SELECT 1',
    },
  });
  const { pages, invalid } = loadPages(sources, { pagesDir: dir });
  assert.equal(pages.size, 0);
  assert.ok(invalid.has('bad'));
});

test('isolates a page whose block references a file source instead of a SQL source', () => {
  const dir = makePagesDir({
    'bad': {
      'page.json': { id: 'bad', title: 'Bad', blocks: [{ id: 'b1', title: 'B1', sourceId: 'csv-a', query: 'q.sql', presentation: 'table' }] },
      'q.sql': 'SELECT 1',
    },
  });
  const { invalid } = loadPages(sources, { pagesDir: dir });
  assert.ok(invalid.has('bad'));
});

test('isolates a page whose SQL file is missing', () => {
  const dir = makePagesDir({
    'bad': { 'page.json': { id: 'bad', title: 'Bad', blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: 'missing.sql', presentation: 'table' }] } },
  });
  const { invalid } = loadPages(sources, { pagesDir: dir });
  assert.ok(invalid.has('bad'));
});

test('isolates a page whose SQL file escapes the page directory', () => {
  const dir = makePagesDir({
    'bad': { 'page.json': { id: 'bad', title: 'Bad', blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: '../../../etc/passwd', presentation: 'table' }] } },
  });
  const { invalid } = loadPages(sources, { pagesDir: dir });
  assert.ok(invalid.has('bad'));
});

test('isolates a page with an invalid presentation value', () => {
  const dir = makePagesDir({
    'bad': {
      'page.json': { id: 'bad', title: 'Bad', blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'chart' }] },
      'q.sql': 'SELECT 1',
    },
  });
  const { invalid } = loadPages(sources, { pagesDir: dir });
  assert.ok(invalid.has('bad'));
});

test('isolates a page whose SQL references an undeclared parameter', () => {
  const dir = makePagesDir({
    'bad': {
      'page.json': { id: 'bad', title: 'Bad', blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'table' }] },
      'q.sql': 'SELECT * FROM t WHERE x = @Undeclared',
    },
  });
  const { invalid } = loadPages(sources, { pagesDir: dir });
  assert.ok(invalid.has('bad'));
});

test('accepts @Offset and @PageSize on a scalar/single-record block without requiring them to be declared as parameters', () => {
  const dir = makePagesDir({
    'ops': {
      'page.json': { id: 'ops', title: 'Ops', blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'scalar' }] },
      'q.sql': 'SELECT COUNT(*) FROM t LIMIT @PageSize OFFSET @Offset',
    },
  });
  const { invalid, pages } = loadPages(sources, { pagesDir: dir });
  assert.equal(invalid.size, 0);
  assert.equal(pages.size, 1);
});

test('rejects a "table" block whose query references @Offset or @PageSize - the engine supplies pagination automatically', () => {
  const dir = makePagesDir({
    'bad': {
      'page.json': { id: 'bad', title: 'Bad', blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'table' }] },
      'q.sql': 'SELECT * FROM t LIMIT @PageSize OFFSET @Offset',
    },
  });
  const { invalid } = loadPages(sources, { pagesDir: dir });
  assert.ok(invalid.has('bad'));
});

test('rejects a "table" block whose query hand-writes ORDER BY/LIMIT/OFFSET/TOP', () => {
  const casesSql = [
    'SELECT * FROM t ORDER BY id',
    'SELECT * FROM t LIMIT 10',
    'SELECT * FROM t OFFSET 5',
    'SELECT TOP (10) * FROM t',
    'SELECT TOP 10 * FROM t',
  ];
  for (const sql of casesSql) {
    const dir = makePagesDir({
      'bad': {
        'page.json': { id: 'bad', title: 'Bad', blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'table' }] },
        'q.sql': sql,
      },
    });
    const { invalid } = loadPages(sources, { pagesDir: dir });
    assert.ok(invalid.has('bad'), `expected "${sql}" to be rejected`);
  }
});

test('accepts a plain SELECT ... FROM ... WHERE ... "table" block with no ordering/pagination of its own', () => {
  const dir = makePagesDir({
    'ops': {
      'page.json': { id: 'ops', title: 'Ops', blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'table' }] },
      'q.sql': 'SELECT * FROM t WHERE active = 1',
    },
  });
  const { invalid, pages } = loadPages(sources, { pagesDir: dir });
  assert.equal(invalid.size, 0);
  assert.equal(pages.size, 1);
});

test('rejects a parameter name starting with "__" as reserved for engine-generated bind parameters', () => {
  const dir = makePagesDir({
    'bad': {
      'page.json': {
        id: 'bad',
        title: 'Bad',
        parameters: [{ name: '__f0', label: 'X', type: 'integer' }],
        blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'table' }],
      },
      'q.sql': 'SELECT 1',
    },
  });
  const { invalid } = loadPages(sources, { pagesDir: dir });
  assert.ok(invalid.has('bad'));
});

test('rejects allowCsvExport/allowJsonExport on a non-"table" block', () => {
  const dir = makePagesDir({
    'bad': {
      'page.json': {
        id: 'bad',
        title: 'Bad',
        blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'scalar', allowCsvExport: true }],
      },
      'q.sql': 'SELECT 1',
    },
  });
  const { invalid } = loadPages(sources, { pagesDir: dir });
  assert.ok(invalid.has('bad'));
});

test('rejects a declared parameter named Offset or PageSize as reserved', () => {
  const dir = makePagesDir({
    'bad': {
      'page.json': {
        id: 'bad',
        title: 'Bad',
        parameters: [{ name: 'Offset', label: 'X', type: 'integer' }],
        blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'table' }],
      },
      'q.sql': 'SELECT 1',
    },
  });
  const { invalid } = loadPages(sources, { pagesDir: dir });
  assert.ok(invalid.has('bad'));
});

test('rejects a write action whose owning block source does not allow writes', () => {
  const dir = makePagesDir({
    'bad': {
      'page.json': {
        id: 'bad',
        title: 'Bad',
        blocks: [
          {
            id: 'b1',
            title: 'B1',
            sourceId: 'sqlite-b',
            query: 'q.sql',
            presentation: 'table',
            writeActions: [{ id: 'a1', label: 'Do it', query: 'w.sql' }],
          },
        ],
      },
      'q.sql': 'SELECT 1',
      'w.sql': 'UPDATE t SET x = 1',
    },
  });
  const { invalid } = loadPages(sources, { pagesDir: dir });
  assert.ok(invalid.has('bad'));
});

test('accepts a write action whose owning block source allows writes, and validates refreshBlockIds', () => {
  const dir = makePagesDir({
    'ops': {
      'page.json': {
        id: 'ops',
        title: 'Ops',
        blocks: [
          {
            id: 'b1',
            title: 'B1',
            sourceId: 'sqlite-a',
            query: 'q.sql',
            presentation: 'table',
            writeActions: [{ id: 'a1', label: 'Do it', query: 'w.sql', refreshBlockIds: ['b1'] }],
          },
        ],
      },
      'q.sql': 'SELECT 1',
      'w.sql': 'UPDATE t SET x = 1',
    },
  });
  const { invalid, pages } = loadPages(sources, { pagesDir: dir });
  assert.equal(invalid.size, 0);
  assert.equal(pages.size, 1);
});

test('rejects a refreshBlockIds entry that references an unknown block', () => {
  const dir = makePagesDir({
    'bad': {
      'page.json': {
        id: 'bad',
        title: 'Bad',
        blocks: [
          {
            id: 'b1',
            title: 'B1',
            sourceId: 'sqlite-a',
            query: 'q.sql',
            presentation: 'table',
            writeActions: [{ id: 'a1', label: 'Do it', query: 'w.sql', refreshBlockIds: ['does-not-exist'] }],
          },
        ],
      },
      'q.sql': 'SELECT 1',
      'w.sql': 'UPDATE t SET x = 1',
    },
  });
  const { invalid } = loadPages(sources, { pagesDir: dir });
  assert.ok(invalid.has('bad'));
});

test('rejects duplicate block ids within one page', () => {
  const dir = makePagesDir({
    'bad': {
      'page.json': {
        id: 'bad',
        title: 'Bad',
        blocks: [
          { id: 'dup', title: 'A', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'table' },
          { id: 'dup', title: 'B', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'table' },
        ],
      },
      'q.sql': 'SELECT 1',
    },
  });
  const { invalid } = loadPages(sources, { pagesDir: dir });
  assert.ok(invalid.has('bad'));
});

test('isolates one bad page while a sibling valid page still loads', () => {
  const dir = makePagesDir({
    'good': {
      'page.json': { id: 'good', title: 'Good', blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'table' }] },
      'q.sql': 'SELECT 1',
    },
    'bad': { 'page.json': '{ not json' },
  });
  const { pages, invalid } = loadPages(sources, { pagesDir: dir });
  assert.ok(pages.has('good'));
  assert.ok(invalid.has('bad'));
});

test('a directory under pages/ with no page.json is silently ignored, not an error', () => {
  const dir = makePagesDir({ 'not-a-page': { 'readme.txt': 'hi' } });
  const { pages, invalid } = loadPages(sources, { pagesDir: dir });
  assert.equal(pages.size, 0);
  assert.equal(invalid.size, 0);
});

test('validatePageConfig requires a select parameter to declare non-empty options', () => {
  const issues = validatePageConfig(
    {
      id: 'x',
      title: 'X',
      parameters: [{ name: 'Region', label: 'Region', type: 'select' }],
      blocks: [{ id: 'b1', title: 'B1', sourceId: 'sqlite-a', query: 'q.sql', presentation: 'table' }],
    },
    { pageDir: makePagesDir({ x: { 'q.sql': 'SELECT 1' } }) + '/x', sqlSourceIds: new Set(['sqlite-a']), writableSourceIds: new Set() },
  );
  assert.ok(!issues.ok);
});
