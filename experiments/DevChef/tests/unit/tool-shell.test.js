import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { Window } from 'happy-dom';
import {
  createToolShell,
  createPersistedSettingsStore,
  createToolShellTemplate,
  getControlValue,
  normalizeValidationResult,
  setControlValue
} from '../../core/tool-shell.js';

let testWindow;

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

function createShellFixture() {
  document.body.innerHTML = `
    <div id="fixture">
      <textarea id="input"></textarea>
      <select id="mode">
        <option value="upper">Upper</option>
        <option value="lower">Lower</option>
      </select>
      <input id="prefix" value="">
      <input id="enabled" type="checkbox" checked>
      <button id="process-btn"></button>
      <button id="copy-btn"></button>
      <button id="clear-btn"></button>
      <button id="reset-btn"></button>
      <button id="export-btn"></button>
      <button data-example-id="basic"></button>
      <div id="status"></div>
      <textarea id="output"></textarea>
    </div>
  `;

  const context = {
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

  return {
    container: document.querySelector('#fixture'),
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
  localStorage.clear();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  localStorage.clear();
  testWindow?.close();
});

function setWritableGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true
  });
}

describe('normalizeValidationResult', () => {
  it('treats true, null, and undefined as valid', () => {
    expect(normalizeValidationResult(true)).toEqual({ valid: true, messages: [], type: 'success' });
    expect(normalizeValidationResult(null).valid).toBe(true);
    expect(normalizeValidationResult(undefined).valid).toBe(true);
  });

  it('normalizes false to a generic error', () => {
    expect(normalizeValidationResult(false)).toEqual({
      valid: false,
      messages: ['Input is not valid.'],
      type: 'error'
    });
  });

  it('normalizes strings and arrays into trimmed messages', () => {
    expect(normalizeValidationResult('  Required  ')).toEqual({
      valid: false,
      messages: ['Required'],
      type: 'error'
    });
    expect(normalizeValidationResult([' One ', '', 'Two'])).toEqual({
      valid: false,
      messages: ['One', 'Two'],
      type: 'error'
    });
  });

  it('accepts object validation results', () => {
    expect(normalizeValidationResult({ valid: false, message: 'Bad input', type: 'warning' })).toEqual({
      valid: false,
      messages: ['Bad input'],
      type: 'warning'
    });
    expect(normalizeValidationResult({ messages: [] })).toEqual({
      valid: true,
      messages: [],
      type: 'success'
    });
  });
});

describe('createPersistedSettingsStore', () => {
  it('round-trips settings through compatible storage', () => {
    const storage = createMemoryStorage();
    const store = createPersistedSettingsStore('formatter', storage);

    expect(store.write({ indent: '2', sortKeys: true })).toBe(true);
    expect(store.read({ indent: '4', mode: 'json' })).toEqual({
      indent: '2',
      mode: 'json',
      sortKeys: true
    });
  });

  it('falls back to defaults when saved JSON is invalid', () => {
    const storage = createMemoryStorage();
    storage.setItem('devchef-tool-shell-bad', '{');
    const store = createPersistedSettingsStore('bad', storage);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(store.read({ mode: 'safe' })).toEqual({ mode: 'safe' });
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it('clears saved settings', () => {
    const storage = createMemoryStorage();
    const store = createPersistedSettingsStore('clear-me', storage);

    store.write({ enabled: true });
    expect(store.clear()).toBe(true);
    expect(store.read({ enabled: false })).toEqual({ enabled: false });
  });
});

describe('control value helpers', () => {
  it('uses component getValue and setValue APIs when available', () => {
    const control = {
      value: '',
      getValue() {
        return this.value;
      },
      setValue(value) {
        this.value = value;
      }
    };

    setControlValue(control, 'abc');
    expect(getControlValue(control)).toBe('abc');
  });

  it('handles checkbox controls', () => {
    const control = { type: 'checkbox', checked: false };

    setControlValue(control, true);
    expect(getControlValue(control)).toBe(true);
  });

  it('handles radio controls', () => {
    const control = { type: 'radio', checked: false };

    setControlValue(control, true);
    expect(getControlValue(control)).toBe(true);
  });
});

describe('createToolShellTemplate', () => {
  it('creates standard shell markup with actions and examples', () => {
    const html = createToolShellTemplate({
      title: 'JSON Formatter',
      description: 'Format JSON input.',
      examples: [{ id: 'basic', label: 'Basic', description: 'Small payload', input: '{"ok":true}' }],
      includeImport: true
    });

    expect(html).toContain('class="tool-container tool-shell"');
    expect(html).toContain('<tool-textarea id="input"');
    expect(html).toContain('<tool-textarea id="output"');
    expect(html).toContain('id="copy-btn"');
    expect(html).toContain('id="import-file"');
    expect(html).toContain('data-example-id="basic"');
    expect(html).toContain('title="Small payload"');
  });

  it('renders catalog-only examples as disabled buttons', () => {
    const html = createToolShellTemplate({
      title: 'JSON Formatter',
      examples: ['Format an API payload']
    });

    expect(html).toContain('data-example-id="format-an-api-payload"');
    expect(html).toContain('disabled');
  });

  it('escapes provided text', () => {
    const html = createToolShellTemplate({
      title: '<Unsafe>',
      inputPlaceholder: '"quoted"'
    });

    expect(html).toContain('&lt;Unsafe&gt;');
    expect(html).toContain('&quot;quoted&quot;');
  });
});

describe('createToolShell DOM wiring', () => {
  it('processes input from the process action and writes output/context/status', async () => {
    const { container, context } = createShellFixture();
    const shell = createToolShell(container, context, {
      process(input) {
        return { output: input.toUpperCase(), message: 'Done.' };
      }
    });

    container.querySelector('#input').value = 'abc';
    container.querySelector('#process-btn').dispatchEvent(new CustomEvent('tool-click'));
    await Promise.resolve();

    expect(container.querySelector('#output').value).toBe('ABC');
    expect(context.output).toBe('ABC');
    expect(container.querySelector('#status').textContent).toBe('Done.');

    shell.cleanup();
  });

  it('shows validation messages without processing invalid input', async () => {
    const { container } = createShellFixture();
    const process = vi.fn();
    const shell = createToolShell(container, {}, {
      validate: () => 'Input is required.',
      process
    });

    container.querySelector('#process-btn').dispatchEvent(new CustomEvent('tool-click'));
    await Promise.resolve();

    expect(process).not.toHaveBeenCalled();
    expect(container.querySelector('#status').textContent).toBe('Input is required.');

    shell.cleanup();
  });

  it('loads examples and clears/resets values', () => {
    const { container, context } = createShellFixture();
    const shell = createToolShell(container, context, {
      resetInput: 'seed',
      examples: [{ id: 'basic', label: 'Basic', input: 'example', output: 'EXAMPLE' }]
    });

    container.querySelector('[data-example-id="basic"]').click();
    expect(container.querySelector('#input').value).toBe('example');
    expect(container.querySelector('#output').value).toBe('EXAMPLE');

    container.querySelector('#clear-btn').dispatchEvent(new CustomEvent('tool-click'));
    expect(container.querySelector('#input').value).toBe('');
    expect(container.querySelector('#output').value).toBe('');
    expect(context.output).toBe('');

    container.querySelector('#reset-btn').dispatchEvent(new CustomEvent('tool-click'));
    expect(container.querySelector('#input').value).toBe('seed');

    shell.cleanup();
  });

  it('persists and restores settings', () => {
    const first = createShellFixture();
    const firstShell = createToolShell(first.container, first.context, {
      toolId: 'dom-settings',
      settings: [
        { key: 'mode', selector: '#mode', defaultValue: 'upper' },
        { key: 'prefix', selector: '#prefix', defaultValue: '' },
        { key: 'enabled', selector: '#enabled', defaultValue: true }
      ]
    });

    first.container.querySelector('#mode').value = 'lower';
    first.container.querySelector('#prefix').value = '>';
    first.container.querySelector('#enabled').checked = false;
    first.container.querySelector('#mode').dispatchEvent(new Event('change'));
    first.container.querySelector('#prefix').dispatchEvent(new Event('change'));
    first.container.querySelector('#enabled').dispatchEvent(new Event('change'));
    firstShell.cleanup();

    const second = createShellFixture();
    const secondShell = createToolShell(second.container, second.context, {
      toolId: 'dom-settings',
      settings: [
        { key: 'mode', selector: '#mode', defaultValue: 'upper' },
        { key: 'prefix', selector: '#prefix', defaultValue: '' },
        { key: 'enabled', selector: '#enabled', defaultValue: true }
      ]
    });

    expect(second.container.querySelector('#mode').value).toBe('lower');
    expect(second.container.querySelector('#prefix').value).toBe('>');
    expect(second.container.querySelector('#enabled').checked).toBe(false);

    secondShell.cleanup();
  });

  it('copies and exports output through shared actions', async () => {
    const { container } = createShellFixture();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const shell = createToolShell(container, {}, {
      exportFilename: 'result.txt'
    });

    container.querySelector('#output').value = 'copy me';
    container.querySelector('#copy-btn').dispatchEvent(new CustomEvent('tool-click'));
    await Promise.resolve();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copy me');

    container.querySelector('#export-btn').dispatchEvent(new CustomEvent('tool-click'));
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');

    shell.cleanup();
  });
});
