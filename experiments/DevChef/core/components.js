/**
 * DevChef Web Components Library
 *
 * Reusable UI components for DevChef tools to eliminate duplication
 * and enforce consistent design patterns across all tools.
 *
 * @version 1.0.0
 * @author DevChef
 */

// =============================================================================
// Base Component Class
// =============================================================================

/**
 * Base class for all DevChef components with shared functionality
 */
class DevChefComponent extends HTMLElement {
  constructor() {
    super();
    this._internals = {};
  }

  /**
   * Get theme-aware CSS custom properties
   */
  getThemeVars() {
    return getComputedStyle(document.documentElement);
  }

  /**
   * Dispatch custom event with detail
   */
  emit(eventName, detail = {}) {
    this.dispatchEvent(new CustomEvent(eventName, {
      detail,
      bubbles: true,
      composed: true
    }));
  }

  /**
   * Query selector helper
   */
  $(selector) {
    return this.querySelector(selector);
  }

  /**
   * Query selector all helper
   */
  $$(selector) {
    return this.querySelectorAll(selector);
  }
}

// =============================================================================
// 1. ToolButton Component
// =============================================================================

/**
 * Smart button component with built-in states and variants
 *
 * @element tool-button
 *
 * @attr {string} variant - Button style: primary, secondary, danger (default: primary)
 * @attr {string} label - Button text label
 * @attr {boolean} disabled - Disabled state
 * @attr {boolean} loading - Loading state with spinner
 * @attr {string} icon - Optional icon (emoji or text)
 *
 * @fires tool-click - Emitted when button is clicked
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
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    const variant = this.getAttribute('variant') || 'primary';
    const label = this.getAttribute('label') || 'Button';
    const disabled = this.hasAttribute('disabled');
    const loading = this.hasAttribute('loading');
    const icon = this.getAttribute('icon') || '';

    const variantClass = variant === 'primary' ? '' : variant;

    this.innerHTML = `
      <button
        class="tool-btn ${variantClass}"
        ${disabled || loading ? 'disabled' : ''}
      >
        ${loading ? '<span class="spinner">⟳</span>' : ''}
        ${icon ? `<span class="icon">${icon}</span>` : ''}
        <span class="label">${label}</span>
      </button>
    `;
  }

  _attachEventListeners() {
    const btn = this.$('button');
    if (btn) {
      btn.addEventListener('click', this._clickHandler);
    }
  }

  _detachEventListeners() {
    const btn = this.$('button');
    if (btn) {
      btn.removeEventListener('click', this._clickHandler);
    }
  }

  _handleClick(e) {
    if (!this.hasAttribute('disabled') && !this.hasAttribute('loading')) {
      this.emit('tool-click', { originalEvent: e });
    }
  }

  // Public API
  setLoading(isLoading) {
    if (isLoading) {
      this.setAttribute('loading', '');
    } else {
      this.removeAttribute('loading');
    }
  }

  setDisabled(isDisabled) {
    if (isDisabled) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }

  setLabel(label) {
    this.setAttribute('label', label);
  }
}

// =============================================================================
// 2. ToolTextarea Component
// =============================================================================

/**
 * Enhanced textarea with auto-resize and monospace options
 *
 * @element tool-textarea
 *
 * @attr {string} placeholder - Placeholder text
 * @attr {number} rows - Initial number of rows (default: 8)
 * @attr {boolean} monospace - Use monospace font
 * @attr {boolean} readonly - Read-only state
 * @attr {boolean} autoresize - Auto-resize to fit content
 * @attr {boolean} linenumbers - Show line numbers (not yet implemented)
 *
 * @fires input - Emitted when content changes
 * @fires change - Emitted when content changes and loses focus
 *
 * @example
 * <tool-textarea placeholder="Enter text..." monospace autoresize></tool-textarea>
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
    if (oldValue !== newValue && this.$('textarea')) {
      if (name === 'value') {
        this.$('textarea').value = newValue || '';
        if (this.hasAttribute('autoresize')) {
          this._autoResize();
        }
      } else {
        this.render();
      }
    }
  }

  render() {
    const placeholder = this.getAttribute('placeholder') || '';
    const rows = this.getAttribute('rows') || '8';
    const monospace = this.hasAttribute('monospace');
    const readonly = this.hasAttribute('readonly');
    const value = this.getAttribute('value') || '';

    this.innerHTML = `
      <textarea
        class="tool-textarea ${monospace ? 'monospace' : ''}"
        placeholder="${placeholder}"
        rows="${rows}"
        ${readonly ? 'readonly' : ''}
      >${value}</textarea>
    `;
  }

  _attachEventListeners() {
    const textarea = this.$('textarea');
    if (textarea) {
      textarea.addEventListener('input', this._handleInput.bind(this));
      textarea.addEventListener('change', this._handleChange.bind(this));

      if (this.hasAttribute('autoresize')) {
        textarea.addEventListener('input', this._autoResize.bind(this));
        // Initial resize
        this._autoResize();
      }
    }
  }

  _detachEventListeners() {
    const textarea = this.$('textarea');
    if (textarea) {
      textarea.removeEventListener('input', this._handleInput);
      textarea.removeEventListener('change', this._handleChange);
    }
  }

  _handleInput(e) {
    this.emit('input', { value: e.target.value });
  }

  _handleChange(e) {
    this.emit('change', { value: e.target.value });
  }

  _autoResize() {
    const textarea = this.$('textarea');
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }

  // Public API
  getValue() {
    const textarea = this.$('textarea');
    return textarea ? textarea.value : '';
  }

  setValue(value) {
    const textarea = this.$('textarea');
    if (textarea) {
      textarea.value = value;
      if (this.hasAttribute('autoresize')) {
        this._autoResize();
      }
      this.emit('change', { value });
    }
  }

  clear() {
    this.setValue('');
  }

  focus() {
    const textarea = this.$('textarea');
    if (textarea) textarea.focus();
  }
}

// =============================================================================
// 3. ToolInput Component
// =============================================================================

/**
 * Enhanced text input with validation support
 *
 * @element tool-input
 *
 * @attr {string} placeholder - Placeholder text
 * @attr {string} type - Input type (text, number, email, url, etc.)
 * @attr {string} value - Input value
 * @attr {boolean} readonly - Read-only state
 * @attr {string} pattern - Validation pattern (regex)
 *
 * @fires input - Emitted when content changes
 * @fires change - Emitted when content changes and loses focus
 *
 * @example
 * <tool-input placeholder="Enter email..." type="email"></tool-input>
 */
class ToolInput extends DevChefComponent {
  static get observedAttributes() {
    return ['placeholder', 'type', 'value', 'readonly', 'pattern'];
  }

  connectedCallback() {
    this.render();
    this._attachEventListeners();
  }

  disconnectedCallback() {
    this._detachEventListeners();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.$('input')) {
      if (name === 'value') {
        this.$('input').value = newValue || '';
      } else {
        this.render();
      }
    }
  }

  render() {
    const placeholder = this.getAttribute('placeholder') || '';
    const type = this.getAttribute('type') || 'text';
    const value = this.getAttribute('value') || '';
    const readonly = this.hasAttribute('readonly');
    const pattern = this.getAttribute('pattern') || '';

    this.innerHTML = `
      <input
        type="${type}"
        class="tool-input"
        placeholder="${placeholder}"
        value="${value}"
        ${readonly ? 'readonly' : ''}
        ${pattern ? `pattern="${pattern}"` : ''}
      />
    `;
  }

  _attachEventListeners() {
    const input = this.$('input');
    if (input) {
      input.addEventListener('input', this._handleInput.bind(this));
      input.addEventListener('change', this._handleChange.bind(this));
    }
  }

  _detachEventListeners() {
    const input = this.$('input');
    if (input) {
      input.removeEventListener('input', this._handleInput);
      input.removeEventListener('change', this._handleChange);
    }
  }

  _handleInput(e) {
    this.emit('input', { value: e.target.value });
  }

  _handleChange(e) {
    this.emit('change', { value: e.target.value });
  }

  // Public API
  getValue() {
    const input = this.$('input');
    return input ? input.value : '';
  }

  setValue(value) {
    const input = this.$('input');
    if (input) {
      input.value = value;
      this.emit('change', { value });
    }
  }

  clear() {
    this.setValue('');
  }

  focus() {
    const input = this.$('input');
    if (input) input.focus();
  }

  isValid() {
    const input = this.$('input');
    return input ? input.checkValidity() : true;
  }
}

// =============================================================================
// 4. ToolSelect Component
// =============================================================================

/**
 * Enhanced select dropdown
 *
 * @element tool-select
 *
 * @attr {string} options - JSON array of options [{value, label}, ...]
 * @attr {string} value - Selected value
 * @attr {string} placeholder - Placeholder option
 *
 * @fires change - Emitted when selection changes
 *
 * @example
 * <tool-select
 *   options='[{"value":"2","label":"2 spaces"},{"value":"4","label":"4 spaces"}]'
 *   value="2">
 * </tool-select>
 */
class ToolSelect extends DevChefComponent {
  static get observedAttributes() {
    return ['options', 'value', 'placeholder'];
  }

  connectedCallback() {
    this.render();
    this._attachEventListeners();
  }

  disconnectedCallback() {
    this._detachEventListeners();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    const placeholder = this.getAttribute('placeholder') || '';
    const value = this.getAttribute('value') || '';
    let options = [];

    try {
      const optionsAttr = this.getAttribute('options');
      if (optionsAttr) {
        options = JSON.parse(optionsAttr);
      }
    } catch (e) {
      console.error('Invalid options JSON:', e);
    }

    this.innerHTML = `
      <select class="tool-select">
        ${placeholder ? `<option value="" disabled ${!value ? 'selected' : ''}>${placeholder}</option>` : ''}
        ${options.map(opt => `
          <option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>
            ${opt.label || opt.value}
          </option>
        `).join('')}
      </select>
    `;
  }

  _attachEventListeners() {
    const select = this.$('select');
    if (select) {
      select.addEventListener('change', this._handleChange.bind(this));
    }
  }

  _detachEventListeners() {
    const select = this.$('select');
    if (select) {
      select.removeEventListener('change', this._handleChange);
    }
  }

  _handleChange(e) {
    this.setAttribute('value', e.target.value);
    this.emit('change', { value: e.target.value });
  }

  // Public API
  getValue() {
    const select = this.$('select');
    return select ? select.value : '';
  }

  setValue(value) {
    const select = this.$('select');
    if (select) {
      select.value = value;
      this.setAttribute('value', value);
      this.emit('change', { value });
    }
  }

  setOptions(options) {
    this.setAttribute('options', JSON.stringify(options));
  }
}

// =============================================================================
// 5. ToolFileInput Component
// =============================================================================

/**
 * File input with drag-drop support
 *
 * @element tool-file-input
 *
 * @attr {string} accept - Accepted file types (e.g., ".json,.csv")
 * @attr {boolean} multiple - Allow multiple files
 * @attr {string} label - Button label
 *
 * @fires file-loaded - Emitted when file(s) are loaded with {files, contents}
 *
 * @example
 * <tool-file-input accept=".json" label="Load JSON"></tool-file-input>
 */
class ToolFileInput extends DevChefComponent {
  static get observedAttributes() {
    return ['accept', 'multiple', 'label'];
  }

  connectedCallback() {
    this.render();
    this._attachEventListeners();
  }

  disconnectedCallback() {
    this._detachEventListeners();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    const accept = this.getAttribute('accept') || '';
    const multiple = this.hasAttribute('multiple');
    const label = this.getAttribute('label') || 'Choose File';

    this.innerHTML = `
      <div class="tool-file-input">
        <input
          type="file"
          id="file-input-${Date.now()}"
          accept="${accept}"
          ${multiple ? 'multiple' : ''}
          style="display: none;"
        />
        <label for="file-input-${Date.now()}" class="file-input-label">
          <button type="button" class="tool-btn secondary">${label}</button>
        </label>
        <div class="file-drop-zone" style="display: none;">
          <p>Drop files here or click to browse</p>
        </div>
        <div class="file-preview"></div>
      </div>
    `;
  }

  _attachEventListeners() {
    const input = this.$('input[type="file"]');
    const dropZone = this.$('.file-drop-zone');
    const label = this.$('.file-input-label button');

    if (input && label) {
      label.addEventListener('click', () => input.click());
      input.addEventListener('change', this._handleFileSelect.bind(this));
    }

    if (dropZone) {
      dropZone.addEventListener('dragover', this._handleDragOver.bind(this));
      dropZone.addEventListener('drop', this._handleDrop.bind(this));
    }
  }

  _detachEventListeners() {
    // Cleanup handled by component removal
  }

  async _handleFileSelect(e) {
    const files = Array.from(e.target.files);
    await this._processFiles(files);
  }

  _handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async _handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    await this._processFiles(files);
  }

  async _processFiles(files) {
    const contents = [];

    for (const file of files) {
      const content = await this._readFile(file);
      contents.push({ file, content });
    }

    this._updatePreview(files);
    this.emit('file-loaded', { files, contents });
  }

  _readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  _updatePreview(files) {
    const preview = this.$('.file-preview');
    if (preview) {
      preview.innerHTML = files.map(f => `
        <div class="file-item">
          <span class="file-name">${f.name}</span>
          <span class="file-size">${(f.size / 1024).toFixed(2)} KB</span>
        </div>
      `).join('');
    }
  }
}

// =============================================================================
// 6. ToolStatus Component
// =============================================================================

/**
 * Status/notification display with auto-dismiss
 *
 * @element tool-status
 *
 * @attr {string} message - Status message
 * @attr {string} type - Status type: success, error, info, warning
 * @attr {number} duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
 *
 * @example
 * <tool-status message="Success!" type="success" duration="3000"></tool-status>
 */
class ToolStatus extends DevChefComponent {
  static get observedAttributes() {
    return ['message', 'type', 'duration'];
  }

  constructor() {
    super();
    this._dismissTimer = null;
  }

  connectedCallback() {
    this.render();
    this._startDismissTimer();
  }

  disconnectedCallback() {
    this._clearDismissTimer();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
      if (name === 'duration' || name === 'message') {
        this._startDismissTimer();
      }
    }
  }

  render() {
    const message = this.getAttribute('message') || '';
    const type = this.getAttribute('type') || 'info';

    if (!message) {
      this.innerHTML = '';
      this.style.display = 'none';
      return;
    }

    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };

    this.style.display = 'block';
    this.innerHTML = `
      <div class="tool-status ${type}">
        <span class="status-icon">${icons[type] || icons.info}</span>
        <span class="status-message">${message}</span>
      </div>
    `;
  }

  _startDismissTimer() {
    this._clearDismissTimer();
    const duration = parseInt(this.getAttribute('duration')) || 0;
    if (duration > 0) {
      this._dismissTimer = setTimeout(() => {
        this.hide();
      }, duration);
    }
  }

  _clearDismissTimer() {
    if (this._dismissTimer) {
      clearTimeout(this._dismissTimer);
      this._dismissTimer = null;
    }
  }

  // Public API
  show(message, type = 'info', duration = 3000) {
    this.setAttribute('message', message);
    this.setAttribute('type', type);
    if (duration) {
      this.setAttribute('duration', duration.toString());
    }
  }

  hide() {
    this.removeAttribute('message');
    this.style.display = 'none';
  }
}

// =============================================================================
// 7. ToolContainer Component
// =============================================================================

/**
 * Layout container with responsive layouts
 *
 * @element tool-container
 *
 * @attr {string} layout - Layout type: single, split, grid
 *
 * @slot header - Header content
 * @slot main - Main content
 * @slot footer - Footer content
 *
 * @example
 * <tool-container layout="split">
 *   <div slot="header">Header</div>
 *   <div slot="main">Content</div>
 * </tool-container>
 */
class ToolContainer extends DevChefComponent {
  static get observedAttributes() {
    return ['layout'];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    const layout = this.getAttribute('layout') || 'single';

    this.className = `tool-container layout-${layout}`;
    this.innerHTML = `
      <div class="tool-layout">
        <div class="tool-slot-header">
          <slot name="header"></slot>
        </div>
        <div class="tool-slot-main">
          <slot name="main"></slot>
          <slot></slot>
        </div>
        <div class="tool-slot-footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `;
  }
}

// =============================================================================
// Register all components
// =============================================================================

/**
 * Register all DevChef components with the browser's custom element registry
 */
export function registerComponents() {
  // Check if already registered
  if (customElements.get('tool-button')) {
    console.log('DevChef components already registered');
    return;
  }

  customElements.define('tool-button', ToolButton);
  customElements.define('tool-textarea', ToolTextarea);
  customElements.define('tool-input', ToolInput);
  customElements.define('tool-select', ToolSelect);
  customElements.define('tool-file-input', ToolFileInput);
  customElements.define('tool-status', ToolStatus);
  customElements.define('tool-container', ToolContainer);

  console.log('DevChef components registered successfully');
}

// Auto-register components when module is loaded
if (typeof window !== 'undefined') {
  registerComponents();
}

// Export component classes for testing and extension
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
