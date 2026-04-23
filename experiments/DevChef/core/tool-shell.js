/**
 * DevChef Tool Shell
 *
 * Small helpers for the repeated input/output/action patterns used by tools.
 * The shell is optional and sits above core/components.js and tool-utils.js.
 */

import {
  copyToClipboard,
  downloadAsFile
} from './tool-utils.js';
import {
  hasRunnableExampleData,
  normalizeToolExamples
} from './tool-presets.js';

const DEFAULT_SELECTORS = {
  input: '#input',
  output: '#output',
  status: '#status',
  process: '#process-btn',
  copy: '#copy-btn',
  clear: '#clear-btn',
  reset: '#reset-btn',
  import: '#import-file',
  export: '#export-btn',
  examples: '[data-example-id]'
};

const STATUS_TYPES = new Set(['success', 'error', 'warning', 'info']);

/**
 * Normalize common validator return shapes into status-friendly messages.
 *
 * Accepted validator return values:
 * - true, null, undefined: valid
 * - false: generic invalid message
 * - string: one error message
 * - string[]: many error messages
 * - { valid, message, messages, type }: object form
 */
export function normalizeValidationResult(result) {
  if (result === true || result == null) {
    return { valid: true, messages: [], type: 'success' };
  }

  if (result === false) {
    return { valid: false, messages: ['Input is not valid.'], type: 'error' };
  }

  if (typeof result === 'string') {
    const message = result.trim();
    return {
      valid: !message,
      messages: message ? [message] : [],
      type: message ? 'error' : 'success'
    };
  }

  if (Array.isArray(result)) {
    const messages = result.map(String).map(message => message.trim()).filter(Boolean);
    return { valid: messages.length === 0, messages, type: messages.length ? 'error' : 'success' };
  }

  if (typeof result === 'object') {
    const explicitMessages = Array.isArray(result.messages)
      ? result.messages
      : result.message
        ? [result.message]
        : [];
    const messages = explicitMessages.map(String).map(message => message.trim()).filter(Boolean);
    const valid = typeof result.valid === 'boolean' ? result.valid : messages.length === 0;
    const type = STATUS_TYPES.has(result.type) ? result.type : valid ? 'success' : 'error';
    return { valid, messages, type };
  }

  return { valid: true, messages: [], type: 'success' };
}

/**
 * Create a small storage adapter for persisted tool settings.
 * Accepts localStorage-compatible storage so tests can pass a memory store.
 */
export function createPersistedSettingsStore(toolId, storage = getDefaultStorage()) {
  const key = toolId ? `devchef-tool-shell-${toolId}` : '';

  return {
    key,
    read(defaults = {}) {
      if (!key || !storage) return { ...defaults };

      try {
        const raw = storage.getItem(key);
        if (!raw) return { ...defaults };
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object'
          ? { ...defaults, ...parsed }
          : { ...defaults };
      } catch (error) {
        console.error(`Failed to load shell settings for ${toolId}:`, error);
        return { ...defaults };
      }
    },
    write(settings = {}) {
      if (!key || !storage) return false;

      try {
        storage.setItem(key, JSON.stringify(settings));
        return true;
      } catch (error) {
        console.error(`Failed to save shell settings for ${toolId}:`, error);
        return false;
      }
    },
    clear() {
      if (!key || !storage) return false;

      try {
        storage.removeItem(key);
        return true;
      } catch (error) {
        console.error(`Failed to clear shell settings for ${toolId}:`, error);
        return false;
      }
    }
  };
}

/**
 * Build a standard shell template for simple text-in/text-out tools.
 * More complex tools can still use createToolShell() with custom markup.
 */
export function createToolShellTemplate({
  title,
  description = '',
  inputLabel = 'Input',
  outputLabel = 'Output',
  inputPlaceholder = '',
  inputRows = 8,
  outputRows = 8,
  actions = {},
  examples = [],
  includeImport = false,
  includeExport = true,
  includeReset = true
} = {}) {
  const normalizedExamples = normalizeToolExamples(examples);
  const actionConfig = {
    process: 'Process',
    copy: 'Copy Result',
    clear: 'Clear',
    reset: includeReset ? 'Reset' : '',
    export: includeExport ? 'Export' : '',
    ...actions
  };

  const actionMarkup = [
    actionConfig.process ? `<tool-button id="process-btn" variant="primary" label="${escapeAttribute(actionConfig.process)}"></tool-button>` : '',
    actionConfig.copy ? `<tool-button id="copy-btn" variant="secondary" label="${escapeAttribute(actionConfig.copy)}"></tool-button>` : '',
    actionConfig.clear ? `<tool-button id="clear-btn" variant="secondary" label="${escapeAttribute(actionConfig.clear)}"></tool-button>` : '',
    actionConfig.reset ? `<tool-button id="reset-btn" variant="secondary" label="${escapeAttribute(actionConfig.reset)}"></tool-button>` : '',
    actionConfig.export ? `<tool-button id="export-btn" variant="secondary" label="${escapeAttribute(actionConfig.export)}"></tool-button>` : ''
  ].filter(Boolean).join('\n        ');

  const examplesMarkup = normalizedExamples.length ? `
    <div class="tool-section tool-shell-examples">
      <label class="section-label">Examples</label>
      <div class="tool-shell-action-row">
        ${normalizedExamples.map(example => `
        <tool-button
          variant="secondary"
          label="${escapeAttribute(example.label || example.id || 'Example')}"
          ${example.description ? `title="${escapeAttribute(example.description)}"` : ''}
          ${hasRunnableExampleData(example) ? '' : 'disabled'}
          data-example-id="${escapeAttribute(example.id || example.label || '')}">
        </tool-button>`).join('')}
      </div>
    </div>` : '';

  const importMarkup = includeImport ? `
    <div class="tool-section">
      <label class="section-label">Import</label>
      <tool-file-input id="import-file" label="Import File"></tool-file-input>
    </div>` : '';

  return `
  <div class="tool-container tool-shell">
    <div class="tool-header">
      <h2 class="tool-title">${escapeHtml(title || 'Tool')}</h2>
      ${description ? `<p class="tool-description">${escapeHtml(description)}</p>` : ''}
    </div>

    ${examplesMarkup}
    ${importMarkup}

    <div class="tool-section tool-shell-panel">
      <label class="section-label" for="input">${escapeHtml(inputLabel)}</label>
      <tool-textarea id="input" placeholder="${escapeAttribute(inputPlaceholder)}" rows="${inputRows}" monospace></tool-textarea>
    </div>

    <div class="tool-section tool-shell-actions">
      <div class="tool-shell-action-row">
        ${actionMarkup}
      </div>
    </div>

    <div class="tool-section">
      <tool-status id="status"></tool-status>
    </div>

    <div class="tool-section tool-shell-panel">
      <label class="section-label" for="output">${escapeHtml(outputLabel)}</label>
      <tool-textarea id="output" rows="${outputRows}" monospace readonly></tool-textarea>
    </div>
  </div>`.trim();
}

/**
 * Initialize shared shell behavior against existing tool markup.
 */
export function createToolShell(container, context = {}, options = {}) {
  if (!container) {
    throw new Error('createToolShell requires a container element.');
  }

  return new ToolShell(container, context, options).init();
}

export class ToolShell {
  constructor(container, context = {}, options = {}) {
    this.container = container;
    this.context = context;
    this.options = {
      autoProcess: false,
      clearOutputOnInput: false,
      copyEmptyMessage: 'Nothing to copy.',
      exportEmptyMessage: 'Nothing to export.',
      exportFilename: 'devchef-output.txt',
      exportMimeType: 'text/plain',
      resetInput: '',
      selectors: {},
      settings: [],
      examples: [],
      presets: [],
      ...options
    };
    this.options.examples = normalizeToolExamples([
      ...this.options.examples,
      ...this.options.presets
    ]);
    this.selectors = { ...DEFAULT_SELECTORS, ...this.options.selectors };
    this.settingsStore = this.options.persistKey || this.options.toolId
      ? createPersistedSettingsStore(this.options.persistKey || this.options.toolId)
      : null;
    this.listeners = [];
    this.refs = {};
  }

  init() {
    this.refs = {
      input: this.find(this.selectors.input),
      output: this.find(this.selectors.output),
      status: this.find(this.selectors.status),
      process: this.find(this.selectors.process),
      copy: this.find(this.selectors.copy),
      clear: this.find(this.selectors.clear),
      reset: this.find(this.selectors.reset),
      import: this.find(this.selectors.import),
      export: this.find(this.selectors.export),
      examples: Array.from(this.container.querySelectorAll(this.selectors.examples))
    };

    this.loadSettings();
    this.bindEvents();
    return this;
  }

  find(selector) {
    return selector ? this.container.querySelector(selector) : null;
  }

  bindEvents() {
    this.on(this.refs.input, 'input', event => {
      const value = event.detail?.value ?? getControlValue(this.refs.input);
      this.context.setInput?.(value);
      if (this.options.clearOutputOnInput) this.setOutput('');
      if (this.options.autoProcess) this.process();
    });

    this.on(this.refs.process, 'tool-click', () => this.process());
    this.on(this.refs.copy, 'tool-click', () => this.copyOutput());
    this.on(this.refs.clear, 'tool-click', () => this.clear());
    this.on(this.refs.reset, 'tool-click', () => this.reset());
    this.on(this.refs.export, 'tool-click', () => this.exportOutput());
    this.on(this.refs.import, 'file-loaded', event => {
      const loaded = event.detail?.contents?.[0];
      if (loaded) this.importText(loaded.content);
    });

    this.refs.examples.forEach(exampleEl => {
      const eventName = exampleEl.tagName?.toLowerCase() === 'tool-button' ? 'tool-click' : 'click';
      this.on(exampleEl, eventName, () => this.applyExample(exampleEl.dataset.exampleId));
    });

    this.options.settings.forEach(setting => {
      const element = this.find(setting.selector);
      if (!element) return;
      this.on(element, setting.event || 'change', () => this.saveSettings());
    });
  }

  async process() {
    const input = this.getInput();
    const validation = normalizeValidationResult(this.options.validate?.(input, this) ?? true);

    if (!validation.valid) {
      this.showStatus(validation.messages.join(' '), validation.type);
      this.setOutput('');
      return { output: '', errors: validation.messages };
    }

    try {
      const result = this.options.process
        ? await this.options.process(input, this)
        : input;
      const output = result?.output !== undefined ? result.output : result;
      this.setOutput(output ?? '');

      if (result?.message) {
        this.showStatus(result.message, result.type || 'success', result.duration);
      }

      return { output };
    } catch (error) {
      const message = error?.message || 'Processing failed.';
      this.showStatus(message, 'error', 5000);
      this.setOutput('');
      return { output: '', errors: [message] };
    }
  }

  async copyOutput() {
    const output = this.getOutput();
    if (!output) {
      this.showStatus(this.options.copyEmptyMessage, 'warning', 2000);
      return false;
    }

    await copyToClipboard(output, {
      onSuccess: () => this.showStatus('Copied to clipboard.', 'success', 2000),
      onError: () => this.showStatus('Failed to copy.', 'error', 3000)
    });
    return true;
  }

  exportOutput(filename = this.options.exportFilename) {
    const output = this.getOutput();
    if (!output) {
      this.showStatus(this.options.exportEmptyMessage, 'warning', 2000);
      return false;
    }

    downloadAsFile(output, filename, this.options.exportMimeType);
    this.showStatus('Exported file.', 'success', 2000);
    return true;
  }

  importText(text) {
    this.setInput(text ?? '');
    this.context.setInput?.(this.getInput());
    if (this.options.autoProcess) this.process();
    this.showStatus('Imported file.', 'success', 2000);
  }

  applyExample(exampleId) {
    const example = this.options.examples.find(item => item.id === exampleId);
    if (!example) return false;

    if (!hasRunnableExampleData(example)) {
      this.showStatus(`${example.label || example.id} is a catalog example only.`, 'info', 2000);
      return false;
    }

    this.applyExampleSettings(example);

    if (example.input !== undefined) {
      this.setInput(example.input ?? '');
      this.context.setInput?.(this.getInput());
    }

    if (example.output !== undefined) {
      this.setOutput(example.output);
    } else if (this.options.autoProcess) {
      this.process();
    }
    this.showStatus(`Loaded example: ${example.label || example.id}`, 'info', 2000);
    return true;
  }

  applyExampleSettings(example) {
    const settings = {
      ...(example.settings || {}),
      ...(example.controls || {})
    };

    Object.entries(settings).forEach(([key, value]) => {
      const descriptor = this.options.settings.find(setting => setting.key === key);
      const element = descriptor
        ? this.find(descriptor.selector)
        : this.find(key);

      if (!element) return;
      if (descriptor?.set) descriptor.set(element, value);
      else setControlValue(element, value);
    });

    if (Object.keys(settings).length && this.settingsStore) {
      this.saveSettings();
    }
  }

  clear() {
    this.setInput('');
    this.setOutput('');
    this.context.setInput?.('');
    this.context.setOutput?.('');
    this.showStatus('', 'info', 0);
  }

  reset() {
    this.setInput(this.options.resetInput ?? '');
    this.setOutput('');
    this.loadSettings(true);
    this.context.setInput?.(this.getInput());
    this.context.setOutput?.('');
    this.showStatus('Reset tool.', 'info', 2000);
  }

  getInput() {
    return getControlValue(this.refs.input);
  }

  setInput(value) {
    setControlValue(this.refs.input, value);
  }

  getOutput() {
    return getControlValue(this.refs.output);
  }

  setOutput(value) {
    const normalized = value == null ? '' : String(value);
    setControlValue(this.refs.output, normalized);
    this.context.setOutput?.(normalized);
  }

  showStatus(message, type = 'info', duration = 3000) {
    if (!this.refs.status) return;
    if (typeof this.refs.status.show === 'function') {
      if (message) this.refs.status.show(message, type, duration);
      else this.refs.status.hide?.();
      return;
    }

    this.refs.status.textContent = message || '';
    this.refs.status.dataset.type = type;
  }

  getSettingsDefaults() {
    return this.options.settings.reduce((defaults, setting) => {
      defaults[setting.key] = setting.defaultValue ?? '';
      return defaults;
    }, {});
  }

  readSettingsFromControls() {
    return this.options.settings.reduce((settings, setting) => {
      const element = this.find(setting.selector);
      if (element) {
        settings[setting.key] = setting.get
          ? setting.get(element)
          : getControlValue(element);
      }
      return settings;
    }, {});
  }

  applySettings(settings = {}) {
    this.options.settings.forEach(setting => {
      const element = this.find(setting.selector);
      if (!element) return;
      const value = settings[setting.key] ?? setting.defaultValue ?? '';
      if (setting.set) setting.set(element, value);
      else setControlValue(element, value);
    });
  }

  loadSettings(useDefaults = false) {
    if (!this.options.settings.length) return {};
    const defaults = this.getSettingsDefaults();
    const settings = useDefaults || !this.settingsStore
      ? defaults
      : this.settingsStore.read(defaults);

    this.applySettings(settings);
    return settings;
  }

  saveSettings() {
    if (!this.options.settings.length || !this.settingsStore) return false;
    return this.settingsStore.write(this.readSettingsFromControls());
  }

  cleanup() {
    this.listeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this.listeners = [];
  }

  on(element, type, handler) {
    if (!element || !type || !handler) return;
    element.addEventListener(type, handler);
    this.listeners.push({ element, type, handler });
  }
}

export function getControlValue(element) {
  if (!element) return '';
  if (typeof element.getValue === 'function') return element.getValue();
  if (element.type === 'checkbox' || element.type === 'radio') return Boolean(element.checked);
  if ('value' in element) return element.value ?? '';
  return element.textContent ?? '';
}

export function setControlValue(element, value) {
  if (!element) return;
  if (typeof element.setValue === 'function') {
    element.setValue(value);
  } else if (element.type === 'checkbox') {
    element.checked = Boolean(value);
  } else if (element.type === 'radio') {
    element.checked = Boolean(value);
  } else if ('value' in element) {
    element.value = value ?? '';
  } else {
    element.textContent = value ?? '';
  }
}

function getDefaultStorage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttribute(value) {
  return escapeHtml(value)
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
