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

describe('template transform simplified shell', () => {
  it('loads the default starter recipe into the single data input and output', async () => {
    const { context } = await loadHtmlTool('tools/template-transform.html');

    expect(document.querySelector('#active-recipe-summary').textContent).toBe('Recipe: SQL Insert');
    expect(document.querySelector('#data-format-select').value).toBe('json');
    expect(document.querySelector('#data-input').value).toContain('"table": "Users"');
    expect(document.querySelector('.starter-recipe.active')?.dataset.template).toBe('sql-insert');
    expect(context.getOutput()).toContain('INSERT INTO [Users]');
    expect(document.querySelector('#preview-output').textContent).toContain('INSERT INTO [Users]');
  });

  it('switches recipes from the starter row and keeps the linear recipe -> data -> output flow', async () => {
    const { context } = await loadHtmlTool('tools/template-transform.html');

    document.querySelector('.starter-recipe[data-template="email"]').click();

    expect(document.querySelector('#active-recipe-summary').textContent).toBe('Recipe: Email Template');
    expect(document.querySelector('#data-format-select').value).toBe('json');
    expect(document.querySelector('#data-input').value).toContain('"recipient": "John Doe"');
    expect(document.querySelector('.starter-recipe.active')?.dataset.template).toBe('email');
    expect(context.getOutput()).toContain('Dear John Doe,');
    expect(context.getOutput()).toContain('Premium Plan');
  });

  it('updates placeholders and renders from the shared data input when the format changes', async () => {
    const { context } = await loadHtmlTool('tools/template-transform.html');
    const dataFormatSelect = document.querySelector('#data-format-select');
    const dataInput = document.querySelector('#data-input');
    const templateInput = document.querySelector('#template-input');

    dataFormatSelect.value = 'text';
    dataFormatSelect.dispatchEvent(new Event('change'));
    expect(dataInput.placeholder).toContain('name=John Doe');
    expect(document.querySelector('#data-format-hint').textContent).toContain('key=value');

    dataInput.value = 'name=Alice\ncity=Warsaw';
    templateInput.value = 'Hello {{ name }} from {{ city }}!';
    dataInput.dispatchEvent(new Event('input'));

    expect(context.getOutput()).toBe('Hello Alice from Warsaw!');
    expect(document.querySelector('#preview-output').textContent).toBe('Hello Alice from Warsaw!');
  });

  it('loads CSV recipes from the library drawer into the same data input and clears correctly', async () => {
    const { context } = await loadHtmlTool('tools/template-transform.html');
    const csvRecipe = document.querySelector('.template-card[data-template="csv-to-json"]');

    csvRecipe.click();

    expect(document.querySelector('#active-recipe-summary').textContent).toBe('Recipe: CSV to JSON');
    expect(document.querySelector('#data-format-select').value).toBe('csv');
    expect(document.querySelector('#data-input').value).toContain('name,email,age');
    expect(document.querySelector('.template-card.active')?.dataset.template).toBe('csv-to-json');
    expect(context.getOutput()).toContain('"name": "John Doe"');

    document.querySelector('#clear-all-btn').click();

    expect(document.querySelector('#data-input').value).toBe('');
    expect(document.querySelector('#template-input').value).toBe('');
    expect(document.querySelector('#preview-output').textContent).toBe('');
    expect(context.getOutput()).toBe('');
  });
});
