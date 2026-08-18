import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';

let testWindow;

function setWritableGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true
  });
}

async function loadComponentsModule() {
  vi.resetModules();
  return import('../../core/components.js');
}

beforeEach(() => {
  testWindow = new Window({ url: 'http://localhost/' });
  setWritableGlobal('window', testWindow);
  setWritableGlobal('document', testWindow.document);
  setWritableGlobal('navigator', testWindow.navigator);
  setWritableGlobal('CustomEvent', testWindow.CustomEvent);
  setWritableGlobal('HTMLElement', testWindow.HTMLElement);
  setWritableGlobal('HTMLTemplateElement', testWindow.HTMLTemplateElement);
  setWritableGlobal('MutationObserver', testWindow.MutationObserver);
  setWritableGlobal('customElements', testWindow.customElements);
  setWritableGlobal('CSS', {
    supports() {
      return false;
    }
  });
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
  testWindow?.close();
});

describe('shared controls compatibility bridge', () => {
  it('analyzes shared and legacy control usage inside tool templates', async () => {
    const { analyzeSharedControlUsage } = await loadComponentsModule();
    const template = document.createElement('template');
    template.innerHTML = `
      <div>
        <tool-button label="Shared"></tool-button>
        <button>Legacy</button>
        <textarea></textarea>
        <tool-status></tool-status>
      </div>
    `;

    const usage = analyzeSharedControlUsage(template);

    expect(usage.shared.button).toBe(1);
    expect(usage.shared.status).toBe(1);
    expect(usage.legacy.button).toBe(1);
    expect(usage.legacy.textarea).toBe(1);
  });

  it('upgrades compatible legacy controls and preserves basic native APIs', async () => {
    const { upgradeLegacyControls } = await loadComponentsModule();

    document.body.innerHTML = `
      <div id="fixture">
        <button id="copy-btn" class="secondary">📋 Copy Result</button>
        <input id="name-input" type="text" value="Alice">
        <textarea id="output" rows="4">hello</textarea>
        <select id="mode-select">
          <option value="">Choose mode</option>
          <option value="upper" selected>Upper</option>
        </select>
      </div>
    `;

    const fixture = document.querySelector('#fixture');
    upgradeLegacyControls(fixture);

    const button = document.querySelector('#copy-btn');
    const input = document.querySelector('#name-input');
    const textarea = document.querySelector('#output');
    const select = document.querySelector('#mode-select');

    expect(button.tagName.toLowerCase()).toBe('tool-button');
    expect(button.getAttribute('variant')).toBe('secondary');
    expect(input.tagName.toLowerCase()).toBe('tool-input');
    expect(input.value).toBe('Alice');
    expect(textarea.tagName.toLowerCase()).toBe('tool-textarea');
    expect(textarea.value).toBe('hello');
    expect(select.tagName.toLowerCase()).toBe('tool-select');
    expect(select.value).toBe('upper');

    input.value = 'Bob';
    textarea.value = 'updated';
    select.value = '';

    expect(input.getValue()).toBe('Bob');
    expect(textarea.getValue()).toBe('updated');
    expect(select.getValue()).toBe('');
  });
});
