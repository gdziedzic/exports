import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';

let testWindow;

function setWritableGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true
  });
}

function createContext() {
  return {
    input: '',
    output: '',
    setInput(value) {
      this.input = value;
    },
    setOutput(value) {
      this.output = value;
    },
    getInput() {
      return this.input;
    },
    getOutput() {
      return this.output;
    }
  };
}

async function loadHtmlTool(relativePath) {
  const fullPath = path.resolve(relativePath);
  const source = readFileSync(fullPath, 'utf8');
  const templateMatch = source.match(/<template id="tool-ui">([\s\S]*?)<\/template>/);
  const scriptMatch = source.match(/<script type="module">([\s\S]*?)<\/script>/);

  if (!templateMatch || !scriptMatch) {
    throw new Error(`Unable to load tool module from ${relativePath}`);
  }

  document.body.innerHTML = templateMatch[1];

  const moduleCode = `
    const copyToClipboard = () => Promise.resolve();
    ${scriptMatch[1].replace(/^import .*$/gm, '')}
    export default typeof DevChefTool !== 'undefined' ? DevChefTool : null;
  `;

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleCode).toString('base64')}`;
  const mod = await import(moduleUrl);
  if (!mod.default) {
    throw new Error(`Tool module did not export DevChefTool for ${relativePath}`);
  }

  const context = createContext();
  mod.default.init(document.body, context);

  return {
    tool: mod.default,
    context
  };
}

beforeEach(() => {
  testWindow = new Window({ url: 'http://localhost/' });
  setWritableGlobal('window', testWindow);
  setWritableGlobal('document', testWindow.document);
  setWritableGlobal('navigator', testWindow.navigator);
  setWritableGlobal('localStorage', testWindow.localStorage);
  setWritableGlobal('CustomEvent', testWindow.CustomEvent);
  setWritableGlobal('Event', testWindow.Event);
  setWritableGlobal('Blob', testWindow.Blob);
  setWritableGlobal('HTMLAnchorElement', testWindow.HTMLAnchorElement);
  setWritableGlobal('URL', testWindow.URL);
  window.DevChef = {};
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  testWindow?.close();
});

describe('builder import paths', () => {
  it('imports an existing cURL command into the cURL builder', async () => {
    await loadHtmlTool('tools/curl-builder.html');

    document.querySelector('#existing-curl-input').value = 'curl -X POST "https://api.example.com/v1/users" -H "Content-Type: application/json" -H "Authorization: Bearer token123" --max-time 30 -L -d "{\\"name\\":\\"Jane\\"}"';
    document.querySelector('#import-curl-btn').click();

    expect(document.querySelector('#http-method').value).toBe('POST');
    expect(document.querySelector('#url-input').value).toBe('https://api.example.com/v1/users');
    expect(document.querySelector('#body-type').value).toBe('json');
    expect(document.querySelector('#body-data').value).toBe('{"name":"Jane"}');
    expect(document.querySelector('#auth-type').value).toBe('bearer');
    expect(document.querySelector('#auth-token').value).toBe('token123');
    expect(document.querySelector('#opt-follow-redirects').checked).toBe(true);
    expect(document.querySelector('#opt-timeout').value).toBe('30');

    const headerKeys = Array.from(document.querySelectorAll('.header-key')).map(input => input.value);
    const headerValues = Array.from(document.querySelectorAll('.header-value')).map(input => input.value);
    expect(headerKeys).toContain('Content-Type');
    expect(headerValues).toContain('application/json');
  });

  it('imports an existing connection string into the connection string builder', async () => {
    await loadHtmlTool('tools/connection-string-builder.html');

    document.querySelector('#existing-connection-string').value = 'Server=myserver,1433;Database=MyDb;User Id=sa;Password=pass123;Encrypt=true;TrustServerCertificate=true;MultipleActiveResultSets=true;Connection Timeout=15;Application Name=DevChef;';
    document.querySelector('#import-connection-string-btn').click();

    expect(document.querySelector('#server').value).toBe('myserver');
    expect(document.querySelector('#port').value).toBe('1433');
    expect(document.querySelector('#database').value).toBe('MyDb');
    expect(document.querySelector('#username').value).toBe('sa');
    expect(document.querySelector('#password').value).toBe('pass123');
    expect(document.querySelector('#encrypt').checked).toBe(true);
    expect(document.querySelector('#trust-server-certificate').checked).toBe(true);
    expect(document.querySelector('#multiple-active-result-sets').checked).toBe(true);
    expect(document.querySelector('#connection-timeout').value).toBe('15');
    expect(document.querySelector('#application-name').value).toBe('DevChef');
    expect(document.querySelector('#sql-auth-btn').classList.contains('active')).toBe(true);
    expect(document.querySelector('#connection-string').value).toContain('Server=myserver,1433;');
  });

  it('imports a SQL query into the SQL join helper', async () => {
    const { tool } = await loadHtmlTool('tools/sql-join-helper.html');

    document.querySelector('#existing-query-input').value = "SELECT u.*, o.OrderId FROM [dbo].[Users] u INNER JOIN [sales].[Orders] o ON u.Id = o.UserId WHERE o.Status = 'Open' AND o.IsDeleted IS NULL;";
    document.querySelector('#import-query-btn').click();

    expect(tool.tables).toHaveLength(2);
    expect(tool.tables[0]).toMatchObject({ name: 'Users', schema: 'dbo', alias: 'u' });
    expect(tool.tables[1]).toMatchObject({ name: 'Orders', schema: 'sales', alias: 'o' });
    expect(tool.joins).toHaveLength(1);
    expect(tool.joins[0]).toMatchObject({
      joinType: 'INNER JOIN',
      leftTable: 'Users',
      leftColumn: 'Id',
      rightTable: 'Orders',
      rightColumn: 'UserId'
    });
    expect(tool.conditions).toHaveLength(2);
    expect(tool.conditions[0]).toMatchObject({
      table: 'Orders',
      column: 'Status',
      operator: '=',
      value: "'Open'"
    });
    expect(tool.conditions[1]).toMatchObject({
      table: 'Orders',
      column: 'IsDeleted',
      operator: 'IS NULL'
    });
    expect(document.querySelector('#select-mode').value).toBe('explicit');
    expect(document.querySelector('#column-list').value).toBe('u.*, o.OrderId');
  });
});
