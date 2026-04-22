/**
 * DevChef Web Components Library
 *
 * Reusable UI components for DevChef tools with modern CSS animations,
 * @starting-style entry transitions, color-mix() theming, and CSS spinners.
 *
 * @version 2.0.0
 */

// =============================================================================
// Base Component Class
// =============================================================================

class DevChefComponent extends HTMLElement {
  constructor() {
    super();
    this._internals = {};
  }

  getThemeVars() {
    return getComputedStyle(document.documentElement);
  }

  emit(eventName, detail = {}) {
    this.dispatchEvent(new CustomEvent(eventName, {
      detail,
      bubbles: true,
      composed: true
    }));
  }

  $(selector) {
    return this.querySelector(selector);
  }

  $$(selector) {
    return this.querySelectorAll(selector);
  }
}

// =============================================================================
// 1. ToolButton
// =============================================================================

/**
 * Smart button with states, variants, CSS spinner, and ripple effect.
 *
 * @element tool-button
 * @attr {string} variant - primary | secondary | danger | success
 * @attr {string} label   - Button text
 * @attr {string} icon    - Optional leading icon (emoji / text)
 * @attr {boolean} disabled
 * @attr {boolean} loading - Shows CSS spinner, disables click
 * @fires tool-click
 *
 * @example
 * <tool-button variant="primary" label="Copy" icon="📋"></tool-button>
 */
class ToolButton extends DevChefComponent {
  static get observedAttributes() {
    return ['variant', 'label', 'disabled', 'loading', 'icon'];
  }

  constructor() {
    super();
    this._clickHandler = this._handleClick.bind(this);
  }

  connectedCallback() {
    this.render();
    this._attachEventListeners();
  }

  disconnectedCallback() {
    this._detachEventListeners();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) this.render();
  }

  render() {
    const variant  = this.getAttribute('variant') || 'primary';
    const label    = this.getAttribute('label')   || 'Button';
    const disabled = this.hasAttribute('disabled');
    const loading  = this.hasAttribute('loading');
    const icon     = this.getAttribute('icon')    || '';

    const cls = variant === 'primary' ? 'tool-btn' : `tool-btn ${variant}`;

    this.innerHTML = `
      <button class="${cls}" ${disabled || loading ? 'disabled' : ''} aria-busy="${loading}">
        ${loading ? '<span class="btn-spinner" aria-hidden="true"></span>' : ''}
        ${icon && !loading ? `<span class="icon" aria-hidden="true">${icon}</span>` : ''}
        <span class="label">${label}</span>
      </button>
    `;
  }

  _attachEventListeners() {
    this.$('button')?.addEventListener('click', this._clickHandler);
  }

  _detachEventListeners() {
    this.$('button')?.removeEventListener('click', this._clickHandler);
  }

  _handleClick(e) {
    if (!this.hasAttribute('disabled') && !this.hasAttribute('loading')) {
      this.emit('tool-click', { originalEvent: e });
    }
  }

  // Public API
  setLoading(isLoading) {
    isLoading ? this.setAttribute('loading', '') : this.removeAttribute('loading');
  }

  setDisabled(isDisabled) {
    isDisabled ? this.setAttribute('disabled', '') : this.removeAttribute('disabled');
  }

  setLabel(label) {
    this.setAttribute('label', label);
  }
}

// =============================================================================
// 2. ToolTextarea
// =============================================================================

/**
 * Enhanced textarea with field-sizing, autoresize, and monospace mode.
 *
 * @element tool-textarea
 * @attr {string}  placeholder
 * @attr {number}  rows         - Minimum rows (default 6)
 * @attr {boolean} monospace
 * @attr {boolean} readonly
 * @attr {boolean} autoresize   - JS fallback for browsers without field-sizing
 * @fires input, change
 *
 * @example
 * <tool-textarea placeholder="Paste JSON..." monospace autoresize></tool-textarea>
 */
class ToolTextarea extends DevChefComponent {
  static get observedAttributes() {
    return ['placeholder', 'rows', 'monospace', 'readonly', 'autoresize', 'value'];
  }

  connectedCallback() {
    this.render();
    this._attachEventListeners();
  }

  disconnectedCallback() {
    this._detachEventListeners();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    const ta = this.$('textarea');
    if (!ta) { this.render(); return; }

    if (name === 'value') {
      ta.value = newValue || '';
      this._maybeResize(ta);
    } else {
      this.render();
    }
  }

  render() {
    const placeholder = this.getAttribute('placeholder') || '';
    const rows        = this.getAttribute('rows')        || '6';
    const monospace   = this.hasAttribute('monospace');
    const readonly    = this.hasAttribute('readonly');
    const value       = this.getAttribute('value')       || '';

    this.innerHTML = `
      <textarea
        class="tool-textarea${monospace ? ' monospace' : ''}"
        placeholder="${placeholder}"
        rows="${rows}"
        ${readonly ? 'readonly' : ''}
        spellcheck="false"
        autocomplete="off"
        autocorrect="off"
      >${value}</textarea>
    `;
  }

  _attachEventListeners() {
    const ta = this.$('textarea');
    if (!ta) return;

    ta.addEventListener('input',  this._handleInput.bind(this));
    ta.addEventListener('change', this._handleChange.bind(this));

    if (this.hasAttribute('autoresize')) {
      ta.addEventListener('input', () => this._maybeResize(ta));
      this._maybeResize(ta);
    }
  }

  _detachEventListeners() {}

  _handleInput(e)  { this.emit('input',  { value: e.target.value }); }
  _handleChange(e) { this.emit('change', { value: e.target.value }); }

  _maybeResize(ta) {
    // field-sizing: content handles this natively; JS fallback for older browsers
    if (CSS.supports('field-sizing', 'content')) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  // Public API
  getValue()      { return this.$('textarea')?.value ?? ''; }
  setValue(value) {
    const ta = this.$('textarea');
    if (!ta) return;
    ta.value = value;
    this._maybeResize(ta);
    this.emit('change', { value });
  }
  clear()  { this.setValue(''); }
  focus()  { this.$('textarea')?.focus(); }
}

// =============================================================================
// 3. ToolInput
// =============================================================================

/**
 * Enhanced text input with validation support.
 *
 * @element tool-input
 * @attr {string}  placeholder
 * @attr {string}  type      - text | number | email | url | search | password
 * @attr {string}  value
 * @attr {boolean} readonly
 * @attr {string}  pattern   - Regex validation pattern
 * @fires input, change
 */
class ToolInput extends DevChefComponent {
  static get observedAttributes() {
    return ['placeholder', 'type', 'value', 'readonly', 'pattern'];
  }

  connectedCallback() {
    this.render();
    this._attachEventListeners();
  }

  disconnectedCallback() {}

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    const inp = this.$('input');
    if (name === 'value' && inp) {
      inp.value = newValue || '';
    } else {
      this.render();
    }
  }

  render() {
    const placeholder = this.getAttribute('placeholder') || '';
    const type        = this.getAttribute('type')        || 'text';
    const value       = this.getAttribute('value')       || '';
    const readonly    = this.hasAttribute('readonly');
    const pattern     = this.getAttribute('pattern')     || '';

    this.innerHTML = `
      <input
        type="${type}"
        class="tool-input"
        placeholder="${placeholder}"
        value="${value}"
        ${readonly  ? 'readonly'          : ''}
        ${pattern   ? `pattern="${pattern}"` : ''}
        autocomplete="off"
      />
    `;
  }

  _attachEventListeners() {
    const inp = this.$('input');
    if (!inp) return;
    inp.addEventListener('input',  e => this.emit('input',  { value: e.target.value }));
    inp.addEventListener('change', e => this.emit('change', { value: e.target.value }));
  }

  // Public API
  getValue()      { return this.$('input')?.value ?? ''; }
  setValue(value) {
    const inp = this.$('input');
    if (!inp) return;
    inp.value = value;
    this.emit('change', { value });
  }
  clear()    { this.setValue(''); }
  focus()    { this.$('input')?.focus(); }
  isValid()  { return this.$('input')?.checkValidity() ?? true; }
}

// =============================================================================
// 4. ToolSelect
// =============================================================================

/**
 * Enhanced select dropdown with custom arrow styling.
 *
 * @element tool-select
 * @attr {string} options     - JSON: [{value, label}, ...]
 * @attr {string} value       - Selected value
 * @attr {string} placeholder - Empty placeholder option
 * @fires change
 */
class ToolSelect extends DevChefComponent {
  static get observedAttributes() {
    return ['options', 'value', 'placeholder'];
  }

  connectedCallback() {
    this.render();
    this._attachEventListeners();
  }

  disconnectedCallback() {}

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) this.render();
  }

  render() {
    const placeholder = this.getAttribute('placeholder') || '';
    const value       = this.getAttribute('value')       || '';
    let options = [];

    try {
      const raw = this.getAttribute('options');
      if (raw) options = JSON.parse(raw);
    } catch (e) {
      console.error('ToolSelect: invalid options JSON', e);
    }

    this.innerHTML = `
      <select class="tool-select">
        ${placeholder ? `<option value="" disabled ${!value ? 'selected' : ''}>${placeholder}</option>` : ''}
        ${options.map(o => `
          <option value="${o.value}" ${o.value === value ? 'selected' : ''}>
            ${o.label ?? o.value}
          </option>
        `).join('')}
      </select>
    `;
  }

  _attachEventListeners() {
    this.$('select')?.addEventListener('change', e => {
      this.setAttribute('value', e.target.value);
      this.emit('change', { value: e.target.value });
    });
  }

  // Public API
  getValue()        { return this.$('select')?.value ?? ''; }
  setValue(value)   {
    const sel = this.$('select');
    if (!sel) return;
    sel.value = value;
    this.setAttribute('value', value);
    this.emit('change', { value });
  }
  setOptions(opts)  { this.setAttribute('options', JSON.stringify(opts)); }
}

// =============================================================================
// 5. ToolFileInput
// =============================================================================

/**
 * File input with drag-drop support and visual drag-over feedback.
 *
 * @element tool-file-input
 * @attr {string}  accept   - Accepted MIME / extension types
 * @attr {boolean} multiple
 * @attr {string}  label    - Button label
 * @fires file-loaded — { files, contents }
 */
class ToolFileInput extends DevChefComponent {
  static get observedAttributes() {
    return ['accept', 'multiple', 'label'];
  }

  connectedCallback() {
    this.render();
    this._attachEventListeners();
  }

  disconnectedCallback() {}

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) this.render();
  }

  render() {
    const accept   = this.getAttribute('accept')   || '';
    const multiple = this.hasAttribute('multiple');
    const label    = this.getAttribute('label')    || 'Choose File';
    const uid      = `file-${Math.random().toString(36).slice(2, 9)}`;

    this.innerHTML = `
      <div class="tool-file-input">
        <input
          type="file"
          id="${uid}"
          accept="${accept}"
          ${multiple ? 'multiple' : ''}
          style="display:none"
        />
        <button type="button" class="tool-btn secondary" data-trigger="${uid}">
          <span class="icon" aria-hidden="true">📂</span>
          ${label}
        </button>
        <div class="file-drop-zone" aria-label="Drop files here">
          Drop files here or click the button
        </div>
        <div class="file-preview" aria-live="polite"></div>
      </div>
    `;
  }

  _attachEventListeners() {
    const input    = this.$('input[type="file"]');
    const trigger  = this.$('button[data-trigger]');
    const dropZone = this.$('.file-drop-zone');

    trigger?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', e => this._processFiles(Array.from(e.target.files)));

    if (dropZone) {
      dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
      dropZone.addEventListener('dragleave', e => { dropZone.classList.remove('drag-over'); });
      dropZone.addEventListener('drop',      e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        this._processFiles(Array.from(e.dataTransfer.files));
      });
    }
  }

  async _processFiles(files) {
    const contents = await Promise.all(
      files.map(f => this._readFile(f).then(content => ({ file: f, content })))
    );
    this._renderPreview(files);
    this.emit('file-loaded', { files, contents });
  }

  _readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = e => resolve(e.target.result);
      r.onerror = reject;
      r.readAsText(file);
    });
  }

  _renderPreview(files) {
    const preview = this.$('.file-preview');
    if (!preview) return;
    preview.innerHTML = files.map(f => `
      <div class="file-item">
        <span class="file-name">${f.name}</span>
        <span class="file-size">${(f.size / 1024).toFixed(1)} KB</span>
      </div>
    `).join('');
  }
}

// =============================================================================
// 6. ToolStatus
// =============================================================================

/**
 * Status / notification bar with CSS-animated entry via @starting-style.
 *
 * Keeps DOM structure persistent across updates so CSS transitions fire
 * instead of replacing the element on each show() call.
 *
 * @element tool-status
 * @attr {string} message  - Status text (empty = hidden)
 * @attr {string} type     - success | error | warning | info
 * @attr {number} duration - Auto-hide after N ms (0 = stay)
 *
 * @method show(message, type?, duration?)
 * @method hide()
 *
 * @example
 * <tool-status id="status"></tool-status>
 * statusEl.show('Copied!', 'success', 2000);
 */
class ToolStatus extends DevChefComponent {
  static get observedAttributes() {
    return ['message', 'type', 'duration'];
  }

  constructor() {
    super();
    this._timer = null;
  }

  connectedCallback() {
    // Create persistent DOM structure once
    if (!this.$('.tool-status')) {
      this.innerHTML = `
        <div class="tool-status" role="status" aria-live="polite">
          <span class="status-icon" aria-hidden="true"></span>
          <span class="status-message"></span>
        </div>
      `;
    }
    this._sync();
  }

  disconnectedCallback() {
    this._clearTimer();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this._sync();
      if (name === 'message' || name === 'duration') {
        this._scheduleHide();
      }
    }
  }

  _sync() {
    const bar     = this.$('.tool-status');
    const iconEl  = this.$('.status-icon');
    const msgEl   = this.$('.status-message');
    if (!bar || !iconEl || !msgEl) return;

    const message = this.getAttribute('message') || '';
    const type    = this.getAttribute('type')    || 'info';

    const icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' };

    // Update type class
    bar.className = `tool-status ${type}`;
    iconEl.textContent = icons[type] ?? icons.info;
    msgEl.textContent  = message;

    // Toggle visibility — @starting-style handles the entry animation
    if (message) {
      bar.classList.add('visible');
    } else {
      bar.classList.remove('visible');
    }
  }

  _scheduleHide() {
    this._clearTimer();
    const duration = parseInt(this.getAttribute('duration')) || 0;
    if (duration > 0) {
      this._timer = setTimeout(() => this.hide(), duration);
    }
  }

  _clearTimer() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  // Public API
  show(message, type = 'info', duration = 3000) {
    this.setAttribute('type',    type);
    this.setAttribute('message', message);
    if (duration) this.setAttribute('duration', String(duration));
  }

  hide() {
    this._clearTimer();
    this.setAttribute('message', '');
  }
}

// =============================================================================
// 7. ToolContainer
// =============================================================================

/**
 * Responsive layout container.
 *
 * @element tool-container
 * @attr {string} layout - single | split | grid
 * @slot header, main (default), footer
 */
class ToolContainer extends DevChefComponent {
  static get observedAttributes() {
    return ['layout'];
  }

  connectedCallback()                        { this.render(); }
  attributeChangedCallback(n, o, v)          { if (o !== v) this.render(); }

  render() {
    const layout = this.getAttribute('layout') || 'single';
    this.className = `tool-container layout-${layout}`;
    this.innerHTML = `
      <div class="tool-layout">
        <div class="tool-slot-header"><slot name="header"></slot></div>
        <div class="tool-slot-main"><slot name="main"></slot><slot></slot></div>
        <div class="tool-slot-footer"><slot name="footer"></slot></div>
      </div>
    `;
  }
}

// =============================================================================
// Register
// =============================================================================

export function registerComponents() {
  if (customElements.get('tool-button')) return;

  customElements.define('tool-button',     ToolButton);
  customElements.define('tool-textarea',   ToolTextarea);
  customElements.define('tool-input',      ToolInput);
  customElements.define('tool-select',     ToolSelect);
  customElements.define('tool-file-input', ToolFileInput);
  customElements.define('tool-status',     ToolStatus);
  customElements.define('tool-container',  ToolContainer);
}

if (typeof window !== 'undefined') {
  registerComponents();
}

export {
  DevChefComponent,
  ToolButton,
  ToolTextarea,
  ToolInput,
  ToolSelect,
  ToolFileInput,
  ToolStatus,
  ToolContainer
};
