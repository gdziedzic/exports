import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { Window } from 'happy-dom';
import { escapeHtml, unescapeHtml } from '../../core/tool-utils.js';

let testWindow;

beforeEach(() => {
  testWindow = new Window({ url: 'http://localhost/' });
  setWritableGlobal('window', testWindow);
  setWritableGlobal('document', testWindow.document);
});

afterEach(() => {
  testWindow?.close();
});

function setWritableGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true
  });
}

describe('escapeHtml', () => {
  it('escapes &, <, and >', () => {
    expect(escapeHtml('<b>a & b</b>')).toBe('&lt;b&gt;a &amp; b&lt;/b&gt;');
  });

  it('treats null and undefined as empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('coerces non-string input to string', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('unescapeHtml', () => {
  it('reverses escapeHtml for the standard entities', () => {
    const original = '<b>a & b</b>';
    expect(unescapeHtml(escapeHtml(original))).toBe(original);
  });
});
