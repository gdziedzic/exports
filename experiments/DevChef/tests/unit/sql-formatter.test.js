import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';

let testWindow;
let tool;
let context;

function setWritableGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true
  });
}

async function loadSqlFormatter() {
  const fullPath = path.resolve('tools/sql-formatter.html');
  const source = readFileSync(fullPath, 'utf8');
  const templateMatch = source.match(/<template id="tool-ui">([\s\S]*?)<\/template>/);
  const scriptMatch = source.match(/<script type="module">([\s\S]*?)<\/script>/);

  document.body.innerHTML = templateMatch[1];

  const moduleCode = `
    const __state = new Map();
    const copyToClipboard = () => Promise.resolve();
    const saveToolState = (id, state) => __state.set(id, state);
    const loadToolState = (id) => __state.get(id) ?? null;
    ${scriptMatch[1].replace(/^import .*$/gm, '')}
    export default DevChefTool;
  `;

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleCode).toString('base64')}`;
  const mod = await import(moduleUrl);

  context = {
    input: '',
    output: '',
    setInput(value) { this.input = value; },
    setOutput(value) { this.output = value; },
    getInput() { return this.input; },
    getOutput() { return this.output; }
  };

  mod.default.init(document.body, context);
  return mod.default;
}

/** Sets the SQL input, presses Format, and returns the result. */
function format(sql) {
  document.querySelector('#input').value = sql;
  document.querySelector('#format-btn').click();
  return context.getOutput();
}

function setOption(id, value) {
  const el = document.querySelector(`#${id}`);
  if (el.type === 'checkbox') el.checked = value;
  else el.value = String(value);
}

beforeEach(async () => {
  testWindow = new Window({ url: 'http://localhost/' });
  setWritableGlobal('window', testWindow);
  setWritableGlobal('document', testWindow.document);
  setWritableGlobal('navigator', testWindow.navigator);
  setWritableGlobal('localStorage', testWindow.localStorage);
  setWritableGlobal('Event', testWindow.Event);
  window.DevChef = {};
  document.body.innerHTML = '';
  tool = await loadSqlFormatter();
});

afterEach(() => {
  document.body.innerHTML = '';
  testWindow?.close();
});

describe('sql formatter layout options', () => {
  it('stacks clause bodies under uppercased keywords by default', () => {
    expect(format('select a, b from t where x = 1')).toBe(
      [
        'SELECT',
        '    a,',
        '    b',
        'FROM',
        '    t',
        'WHERE',
        '    x = 1'
      ].join('\n')
    );
  });

  it('keeps the clause body beside the keyword in inline layout', () => {
    setOption('keyword-layout', 'inline');
    expect(format('select a, b from t')).toBe('SELECT a,\n    b\nFROM t');
  });

  it('right-aligns keywords in river layout', () => {
    setOption('keyword-layout', 'river');
    const lines = format('select a from t where x = 1').split('\n');
    expect(lines).toEqual([
      'SELECT a',
      '  FROM t',
      ' WHERE x = 1'
    ]);
  });

  it('supports leading commas', () => {
    setOption('comma-position', 'leading');
    expect(format('select a, b, c from t')).toBe(
      'SELECT\n    a\n  , b\n  , c\nFROM\n    t'
    );
  });

  it('keeps column lists inline when asked', () => {
    setOption('list-style', 'inline');
    expect(format('select a, b, c from t')).toBe('SELECT\n    a, b, c\nFROM\n    t');
  });

  it('honours the indentation setting', () => {
    setOption('indent-size', 'tab');
    expect(format('select a from t')).toBe('SELECT\n\ta\nFROM\n\tt');
  });

  it('produces a single flowing statement when keyword breaks are off', () => {
    setOption('new-line-before-keyword', false);
    expect(format('select a,\n b\nfrom t')).toBe('SELECT a, b FROM t');
  });

  it('indents subqueries and closes them at the opening indent', () => {
    expect(format('select * from (select id from users) x')).toBe(
      [
        'SELECT',
        '    *',
        'FROM',
        '    (',
        '        SELECT',
        '            id',
        '        FROM',
        '            users',
        '    ) x'
      ].join('\n')
    );
  });

  it('leaves subqueries inline when subquery indenting is off', () => {
    setOption('indent-subqueries', false);
    expect(format('select * from (select id from users) x')).toContain('(SELECT id FROM users) x');
  });

  it('keeps a join and its table on one line', () => {
    const out = format('select a from t inner join u on u.id = t.id');
    expect(out).toContain('    INNER JOIN u ON u.id = t.id');
  });

  it('moves ON to its own line when requested', () => {
    setOption('on-new-line', true);
    const out = format('select a from t inner join u on u.id = t.id');
    expect(out).toContain('    INNER JOIN u\n        ON u.id = t.id');
  });

  it('breaks before AND / OR but not inside BETWEEN', () => {
    const out = format('select a from t where x between 1 and 10 and y = 2 or z = 3');
    expect(out).toContain('    x BETWEEN 1 AND 10\n    AND y = 2\n    OR z = 3');
  });

  it('keeps AND / OR inline when logical breaks are off', () => {
    setOption('break-logical', false);
    expect(format('select a from t where x = 1 and y = 2')).toContain('    x = 1 AND y = 2');
  });

  it('expands CASE expressions and dedents END', () => {
    const out = format("select case when a = 1 then 'x' else 'y' end from t");
    expect(out).toContain(
      [
        '    CASE',
        "        WHEN a = 1 THEN 'x'",
        "        ELSE 'y'",
        '    END'
      ].join('\n')
    );
  });

  it('keeps CASE inline when expansion is off', () => {
    setOption('expand-case', false);
    expect(format("select case when a = 1 then 'x' end from t"))
      .toContain("    CASE WHEN a = 1 THEN 'x' END");
  });
});

describe('sql formatter casing options', () => {
  it('lowercases keywords and uppercases identifiers independently', () => {
    setOption('keyword-case', 'lower');
    setOption('identifier-case', 'upper');
    expect(format('SELECT a FROM t')).toBe('select\n    A\nfrom\n    T');
  });

  it('cases functions and data types separately from identifiers', () => {
    setOption('function-case', 'lower');
    setOption('datatype-case', 'lower');
    expect(format('select cast(x as INT), COUNT(*) from t'))
      .toContain('    cast(x AS int),\n    count(*)');
  });

  it('never re-cases text inside string literals or quoted identifiers', () => {
    setOption('keyword-case', 'upper');
    const out = format(`select 'select a from b', [select], "from" from t`);
    expect(out).toContain("'select a from b'");
    expect(out).toContain('[select]');
    expect(out).toContain('"from"');
  });
});

describe('sql formatter statements and comments', () => {
  it('separates statements with a blank line', () => {
    expect(format('select 1; select 2;')).toBe('SELECT\n    1;\n\nSELECT\n    2;');
  });

  it('drops the blank separator when the option is off', () => {
    setOption('blank-line-between-statements', false);
    expect(format('select 1; select 2;')).toBe('SELECT\n    1;\nSELECT\n    2;');
  });

  it('keeps statements inside a BEGIN block indented', () => {
    const out = format('begin set nocount on; select a from t; end');
    expect(out).toBe(
      [
        'BEGIN',
        '    SET NOCOUNT ON;',
        '',
        '    SELECT',
        '        a',
        '    FROM',
        '        t;',
        'END'
      ].join('\n')
    );
  });

  it('treats UPDATE ... SET as a column list but SET NOCOUNT as a statement', () => {
    expect(format('update t set a = 1, b = 2 where id = 3')).toContain(
      'SET\n    a = 1,\n    b = 2'
    );
    expect(format('set nocount on')).toBe('SET NOCOUNT ON');
  });

  it('keeps a trailing comment on the line it annotated', () => {
    expect(format('select a from t; -- done')).toBe(
      'SELECT\n    a\nFROM\n    t; -- done'
    );
  });

  it('keeps a leading comment at statement indent', () => {
    expect(format('-- header\nselect a from t')).toBe(
      '-- header\nSELECT\n    a\nFROM\n    t'
    );
  });

  it('removes comments when asked', () => {
    setOption('strip-comments', true);
    expect(format('-- header\nselect a /* mid */ from t')).toBe('SELECT\n    a\nFROM\n    t');
  });

  it('appends a trailing semicolon when asked', () => {
    setOption('trailing-semicolon', true);
    expect(format('select a from t').endsWith(';')).toBe(true);
  });
});

describe('sql formatter dialects', () => {
  it('reads MySQL backticks, # comments and backslash escapes', () => {
    setOption('dialect', 'mysql');
    const out = format("select `id` from `t` # note\nwhere a = 'it\\'s'");
    expect(out).toContain('`id`');
    expect(out).toContain("a = 'it\\'s'");
    expect(out).toContain('# note');
  });

  it('reads PostgreSQL casts and positional parameters', () => {
    setOption('dialect', 'postgres');
    const out = format('select id::text from t where id = $1');
    expect(out).toContain('id::TEXT');
    expect(out).toContain('id = $1');
  });
});

describe('sql formatter stability', () => {
  const samples = [
    'select a, b from t inner join u on u.id = t.id where a = 1 and b = 2 order by a desc',
    "select case when a = 1 then 'x' else 'y' end as v from t",
    'with cte as (select id from a) select * from cte join b on b.id = cte.id',
    'create procedure dbo.p @id int as begin set nocount on; select a from t where id = @id; end',
    'insert into dbo.T (a, b) values (1, 2);'
  ];

  it('is idempotent', () => {
    for (const sql of samples) {
      const once = format(sql);
      expect(format(once), sql).toBe(once);
    }
  });

  it('preserves every token when whitespace is ignored', () => {
    for (const sql of samples) {
      const strip = (s) => s.replace(/\s+/g, '').toLowerCase();
      expect(strip(format(sql)), sql).toBe(strip(sql));
    }
  });

  it('leaves unbalanced input intact instead of throwing', () => {
    expect(() => format('select * from (select a from b')).not.toThrow();
    expect(format("select 'unterminated from t")).toContain("'unterminated from t");
  });
});

describe('sql formatter minify', () => {
  it('collapses whitespace without touching string contents', () => {
    document.querySelector('#input').value = "select a,   b from t where s = 'a  b'";
    document.querySelector('#minify-btn').click();
    expect(context.getOutput()).toBe("SELECT a,b FROM t WHERE s='a  b'");
  });

  it('drops comments by default and keeps them on request', () => {
    document.querySelector('#input').value = 'select a /* note */ from t';
    document.querySelector('#minify-btn').click();
    expect(context.getOutput()).toBe('SELECT a FROM t');

    setOption('minify-keep-comments', true);
    document.querySelector('#minify-btn').click();
    expect(context.getOutput()).toBe('SELECT a/* note */FROM t');
  });

  it('terminates a line comment so following code survives', () => {
    document.querySelector('#input').value = 'select a -- note\nfrom t';
    setOption('minify-keep-comments', true);
    document.querySelector('#minify-btn').click();
    expect(context.getOutput()).toBe('SELECT a -- note\nFROM t');
  });
});

describe('sql formatter presets and controls', () => {
  it('applies preset values to the controls', () => {
    document.querySelector('[data-preset="river"]').click();
    expect(document.querySelector('#keyword-layout').value).toBe('river');

    document.querySelector('[data-preset="comma-first"]').click();
    expect(document.querySelector('#comma-position').value).toBe('leading');
    expect(document.querySelector('#keyword-layout').value).toBe('stacked');
  });

  it('restores defaults after a reset', () => {
    setOption('keyword-case', 'lower');
    setOption('expand-case', false);
    document.querySelector('#reset-options-btn').click();
    expect(document.querySelector('#keyword-case').value).toBe('upper');
    expect(document.querySelector('#expand-case').checked).toBe(true);
  });

  it('reports statement and line stats after formatting', () => {
    format('select a from t; select b from u;');
    const stats = document.querySelector('#stats').textContent;
    expect(stats).toContain('Statements');
    expect(stats).toContain('Longest line');
  });

  it('feeds the result back into the input', () => {
    format('select a from t');
    document.querySelector('#use-output-btn').click();
    expect(document.querySelector('#input').value).toBe('SELECT\n    a\nFROM\n    t');
  });

  it('still fills the input from a template button', () => {
    document.querySelector('[data-template="select"]').click();
    expect(document.querySelector('#input').value).toContain('SELECT');
    expect(context.getInput()).toContain('ORDER BY');
  });
});
