/**
 * Universal Quick Input
 * One input to rule them all - intelligent data processing panel
 *
 * Features:
 * - Single input field with smart detection
 * - Instant transformations display
 * - Real-time preview of all operations
 * - Quick actions with keyboard shortcuts
 * - Command palette integration
 * - Multi-format output
 * - History and favorites
 * - Copy results instantly
 */

class QuickInput {
  constructor() {
    this.panel = null;
    this.input = null;
    this.results = null;
    this.currentData = null;
    this.detection = null;
    this.transformations = [];
    this.selectedIndex = 0;
    this.history = this.loadHistory();
    this.favorites = this.loadFavorites();
    this.isOpen = false;
    this.init();
  }

  /**
   * Initialize quick input
   */
  init() {
    this.registerShortcut();
    console.log('Universal Quick Input initialized');
  }

  /**
   * Register global shortcut
   */
  registerShortcut() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+V (or Cmd+Shift+V) to open quick input
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'v') {
        e.preventDefault();
        this.toggle();
      }

      // Escape to close
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  /**
   * Toggle quick input panel
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open quick input panel
   */
  async open() {
    if (this.isOpen) return;

    this.createPanel();
    this.isOpen = true;

    // Focus input
    setTimeout(() => {
      this.input.focus();
    }, 100);

    // Try to paste from clipboard automatically
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        this.input.value = text;
        this.process(text);
      }
    } catch (e) {
      // Clipboard access denied - user will paste manually
    }
  }

  /**
   * Close quick input panel
   */
  close() {
    if (!this.isOpen) return;

    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }

    this.isOpen = false;
    this.currentData = null;
    this.detection = null;
    this.transformations = [];
    this.selectedIndex = 0;
  }

  /**
   * Create panel UI
   */
  createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'quick-input-panel';
    this.panel.innerHTML = `
      <div class="quick-input-container">
        <div class="quick-input-header">
          <h2>⚡ Universal Quick Input</h2>
          <button class="quick-input-close" title="Close (Esc)">✕</button>
        </div>

        <div class="quick-input-main">
          <textarea
            class="quick-input-field"
            placeholder="Paste or type anything... (Ctrl+Shift+V)"
            rows="5"
          ></textarea>

          <div class="quick-input-detection"></div>

          <div class="quick-input-actions">
            <button id="quick-input-clear">Clear</button>
            <button id="quick-input-history">History</button>
            <button id="quick-input-favorites">Favorites</button>
          </div>
        </div>

        <div class="quick-input-results"></div>

        <div class="quick-input-footer">
          <span class="quick-input-hint">
            ↑↓ Navigate • Enter Execute • Ctrl+C Copy • ⭐ Favorite
          </span>
        </div>
      </div>
    `;

    document.body.appendChild(this.panel);

    // Get references
    this.input = this.panel.querySelector('.quick-input-field');
    this.results = this.panel.querySelector('.quick-input-results');

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Input events
    this.input.addEventListener('input', (e) => {
      this.process(e.target.value);
    });

    this.input.addEventListener('paste', (e) => {
      setTimeout(() => {
        this.process(e.target.value || this.input.value);
      }, 10);
    });

    // Keyboard navigation
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectPrevious();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.executeSelected();
      }
    });

    // Close button
    this.panel.querySelector('.quick-input-close').addEventListener('click', () => {
      this.close();
    });

    // Action buttons
    document.getElementById('quick-input-clear')?.addEventListener('click', () => {
      this.input.value = '';
      this.results.innerHTML = '';
      this.currentData = null;
      this.detection = null;
      this.input.focus();
    });

    document.getElementById('quick-input-history')?.addEventListener('click', () => {
      this.showHistory();
    });

    document.getElementById('quick-input-favorites')?.addEventListener('click', () => {
      this.showFavorites();
    });

    // Click outside to close
    this.panel.addEventListener('click', (e) => {
      if (e.target === this.panel) {
        this.close();
      }
    });
  }

  /**
   * Process input data
   */
  process(text) {
    if (!text || text.trim().length === 0) {
      this.results.innerHTML = '<div class="quick-input-empty">Paste or type data to see transformations...</div>';
      return;
    }

    this.currentData = text;

    // Detect data type
    this.detection = this.detectType(text);

    // Show detection
    this.showDetection();

    // Generate transformations
    this.transformations = this.generateTransformations(text, this.detection);

    // Render transformations
    this.renderTransformations();

    // Add to history
    this.addToHistory(text, this.detection);
  }

  /**
   * Detect data type
   */
  detectType(text) {
    // Use ClipboardDetector if available
    if (window.ClipboardDetector && window.ClipboardDetector.detect) {
      return window.ClipboardDetector.detect(text);
    }

    // Fallback detection
    return this.basicDetection(text);
  }

  /**
   * Basic detection fallback
   */
  basicDetection(text) {
    const detections = [];

    // JSON
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        JSON.parse(text);
        detections.push({ type: 'json', confidence: 0.9 });
      } catch (e) {}
    }

    // URL
    if (/^https?:\/\//i.test(text)) {
      detections.push({ type: 'url', confidence: 0.9 });
    }

    // UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text.trim())) {
      detections.push({ type: 'uuid', confidence: 0.95 });
    }

    // Timestamp
    if (/^\d{10,13}$/.test(text.trim())) {
      detections.push({ type: 'timestamp', confidence: 0.8 });
    }

    // Base64
    if (/^[A-Za-z0-9+/]+=*$/.test(text.trim()) && text.length % 4 === 0) {
      detections.push({ type: 'base64', confidence: 0.7 });
    }

    if (detections.length > 0) {
      detections.sort((a, b) => b.confidence - a.confidence);
      return detections[0];
    }

    return { type: 'text', confidence: 0.5 };
  }

  /**
   * Show detection info
   */
  showDetection() {
    const detectionEl = this.panel.querySelector('.quick-input-detection');
    if (!detectionEl) return;

    if (this.detection) {
      const confidence = Math.round(this.detection.confidence * 100);
      detectionEl.innerHTML = `
        <div class="detection-badge">
          <span class="detection-type">${this.detection.type.toUpperCase()}</span>
          <span class="detection-confidence">${confidence}% confident</span>
        </div>
      `;
    }
  }

  /**
   * Generate transformations
   */
  generateTransformations(text, detection) {
    const transformations = [];
    const type = detection?.type || 'text';

    // Type-specific transformations
    switch (type) {
      case 'json':
        transformations.push(
          { name: 'Format JSON', tool: 'json-formatter', action: () => this.formatJSON(text), icon: '📋' },
          { name: 'Minify JSON', tool: 'json-formatter', action: () => this.minifyJSON(text), icon: '🗜️' },
          { name: 'Convert to CSV', tool: 'csv-json-converter', action: () => 'CSV conversion...', icon: '🔄' },
          { name: 'Extract Keys', action: () => this.extractJSONKeys(text), icon: '🔑' },
          { name: 'Validate JSON', action: () => this.validateJSON(text), icon: '✅' }
        );
        break;

      case 'base64':
        transformations.push(
          { name: 'Decode Base64', tool: 'base64', action: () => this.decodeBase64(text), icon: '🔓' },
          { name: 'Decode to JSON', action: () => this.decodeBase64ToJSON(text), icon: '📋' },
          { name: 'View as Image', action: () => 'Image preview...', icon: '🖼️' }
        );
        break;

      case 'url':
        transformations.push(
          { name: 'Parse URL', action: () => this.parseURL(text), icon: '🔗' },
          { name: 'Encode URL', tool: 'url-encoder', action: () => encodeURIComponent(text), icon: '🔒' },
          { name: 'Decode URL', tool: 'url-encoder', action: () => decodeURIComponent(text), icon: '🔓' },
          { name: 'Build cURL', tool: 'curl-builder', action: () => `curl "${text}"`, icon: '📡' },
          { name: 'Open in Browser', action: () => this.openURL(text), icon: '🌐' }
        );
        break;

      case 'uuid':
        transformations.push(
          { name: 'Format UUID', action: () => text.toLowerCase(), icon: '🆔' },
          { name: 'Uppercase UUID', action: () => text.toUpperCase(), icon: '🆔' },
          { name: 'Remove Dashes', action: () => text.replace(/-/g, ''), icon: '✂️' },
          { name: 'Generate New UUID', tool: 'uuid-generator', action: () => this.generateUUID(), icon: '✨' }
        );
        break;

      case 'timestamp':
        transformations.push(
          { name: 'Convert to Date', tool: 'timestamp-converter', action: () => this.timestampToDate(text), icon: '📅' },
          { name: 'Convert to ISO', action: () => new Date(parseInt(text)).toISOString(), icon: '🕐' },
          { name: 'Relative Time', action: () => this.relativeTime(text), icon: '⏱️' },
          { name: 'Unix (seconds)', action: () => Math.floor(parseInt(text) / 1000).toString(), icon: '🔢' }
        );
        break;

      case 'jwt':
        transformations.push(
          { name: 'Decode JWT', tool: 'jwt-decoder', action: () => this.decodeJWT(text), icon: '🔓' },
          { name: 'Validate JWT', action: () => this.validateJWT(text), icon: '✅' },
          { name: 'Extract Header', action: () => this.extractJWTPart(text, 0), icon: '📄' },
          { name: 'Extract Payload', action: () => this.extractJWTPart(text, 1), icon: '📦' }
        );
        break;

      case 'sql':
        transformations.push(
          { name: 'Format SQL', tool: 'sql-formatter', action: () => 'Formatted SQL...', icon: '🗄️' },
          { name: 'Minify SQL', action: () => text.replace(/\s+/g, ' ').trim(), icon: '🗜️' },
          { name: 'Extract Tables', action: () => this.extractSQLTables(text), icon: '📊' },
          { name: 'Uppercase Keywords', action: () => this.uppercaseSQLKeywords(text), icon: '🔠' }
        );
        break;

      default:
        // Generic text transformations
        transformations.push(
          { name: 'Uppercase', action: () => text.toUpperCase(), icon: '🔠' },
          { name: 'Lowercase', action: () => text.toLowerCase(), icon: '🔡' },
          { name: 'Title Case', action: () => this.toTitleCase(text), icon: '🔤' },
          { name: 'Reverse', action: () => text.split('').reverse().join(''), icon: '↩️' },
          { name: 'Word Count', action: () => `${text.split(/\s+/).length} words`, icon: '🔢' },
          { name: 'Character Count', action: () => `${text.length} characters`, icon: '📏' },
          { name: 'Hash (MD5)', tool: 'hash-generator', action: () => 'Hash...', icon: '🔐' },
          { name: 'Encode Base64', tool: 'base64', action: () => btoa(text), icon: '🔒' }
        );
    }

    return transformations;
  }

  /**
   * Render transformations
   */
  renderTransformations() {
    if (this.transformations.length === 0) {
      this.results.innerHTML = '<div class="quick-input-empty">No transformations available</div>';
      return;
    }

    this.results.innerHTML = this.transformations
      .map((trans, index) => {
        const isSelected = index === this.selectedIndex;
        let preview = '';

        try {
          const result = trans.action();
          preview = typeof result === 'string' ? result : JSON.stringify(result);

          // Truncate long previews
          if (preview.length > 200) {
            preview = preview.substring(0, 200) + '...';
          }
        } catch (e) {
          preview = `Error: ${e.message}`;
        }

        return `
          <div class="quick-input-transformation ${isSelected ? 'selected' : ''}" data-index="${index}">
            <div class="transformation-header">
              <span class="transformation-icon">${trans.icon}</span>
              <span class="transformation-name">${trans.name}</span>
              <div class="transformation-actions">
                <button class="btn-copy" data-index="${index}" title="Copy result">📋</button>
                <button class="btn-favorite" data-index="${index}" title="Add to favorites">⭐</button>
                <button class="btn-execute" data-index="${index}" title="Execute">▶️</button>
              </div>
            </div>
            <div class="transformation-preview">
              <code>${this.escapeHTML(preview)}</code>
            </div>
          </div>
        `;
      })
      .join('');

    // Add click handlers
    this.results.querySelectorAll('.quick-input-transformation').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          const index = parseInt(el.dataset.index);
          this.selectedIndex = index;
          this.renderTransformations();
        }
      });
    });

    this.results.querySelectorAll('.btn-copy').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        this.copyResult(index);
      });
    });

    this.results.querySelectorAll('.btn-favorite').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        this.addToFavorites(index);
      });
    });

    this.results.querySelectorAll('.btn-execute').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        this.executeTransformation(index);
      });
    });
  }

  /**
   * Select next transformation
   */
  selectNext() {
    this.selectedIndex = Math.min(this.selectedIndex + 1, this.transformations.length - 1);
    this.renderTransformations();
  }

  /**
   * Select previous transformation
   */
  selectPrevious() {
    this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    this.renderTransformations();
  }

  /**
   * Execute selected transformation
   */
  executeSelected() {
    if (this.transformations[this.selectedIndex]) {
      this.executeTransformation(this.selectedIndex);
    }
  }

  /**
   * Execute transformation
   */
  executeTransformation(index) {
    const trans = this.transformations[index];
    if (!trans) return;

    try {
      const result = trans.action();

      // If has a tool, open it
      if (trans.tool) {
        window.openTool && window.openTool(trans.tool);
      }

      // Copy result to clipboard
      navigator.clipboard.writeText(typeof result === 'string' ? result : JSON.stringify(result, null, 2));

      // Show notification
      this.showNotification(`✅ Executed: ${trans.name}`);
    } catch (e) {
      this.showNotification(`❌ Error: ${e.message}`);
    }
  }

  /**
   * Copy result to clipboard
   */
  async copyResult(index) {
    const trans = this.transformations[index];
    if (!trans) return;

    try {
      const result = trans.action();
      await navigator.clipboard.writeText(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
      this.showNotification('📋 Copied to clipboard!');
    } catch (e) {
      this.showNotification(`❌ Copy failed: ${e.message}`);
    }
  }

  /**
   * Add transformation to favorites
   */
  addToFavorites(index) {
    const trans = this.transformations[index];
    if (!trans) return;

    this.favorites.push({
      name: trans.name,
      tool: trans.tool,
      data: this.currentData,
      detection: this.detection,
      timestamp: Date.now()
    });

    this.saveFavorites();
    this.showNotification('⭐ Added to favorites!');
  }

  /**
   * Show notification
   */
  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'quick-input-notification';
    notification.textContent = message;
    this.panel.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 2000);
  }

  /**
   * Escape HTML
   */
  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Transformation implementations

  formatJSON(text) {
    return JSON.stringify(JSON.parse(text), null, 2);
  }

  minifyJSON(text) {
    return JSON.stringify(JSON.parse(text));
  }

  extractJSONKeys(text) {
    const obj = JSON.parse(text);
    const keys = this.getAllKeys(obj);
    return keys.join('\n');
  }

  getAllKeys(obj, prefix = '') {
    const keys = [];
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.push(fullKey);
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys.push(...this.getAllKeys(obj[key], fullKey));
      }
    }
    return keys;
  }

  validateJSON(text) {
    try {
      JSON.parse(text);
      return '✅ Valid JSON';
    } catch (e) {
      return `❌ Invalid JSON: ${e.message}`;
    }
  }

  decodeBase64(text) {
    return atob(text);
  }

  decodeBase64ToJSON(text) {
    const decoded = atob(text);
    return JSON.stringify(JSON.parse(decoded), null, 2);
  }

  parseURL(text) {
    const url = new URL(text);
    return JSON.stringify({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      params: Object.fromEntries(url.searchParams)
    }, null, 2);
  }

  openURL(text) {
    window.open(text, '_blank');
    return 'Opening URL in new tab...';
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  timestampToDate(text) {
    const ts = parseInt(text);
    const date = new Date(ts.toString().length === 10 ? ts * 1000 : ts);
    return date.toLocaleString();
  }

  relativeTime(text) {
    const ts = parseInt(text);
    const date = new Date(ts.toString().length === 10 ? ts * 1000 : ts);
    const now = Date.now();
    const diff = now - date.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  }

  decodeJWT(text) {
    const parts = text.split('.');
    if (parts.length !== 3) return 'Invalid JWT';

    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));

    return JSON.stringify({ header, payload }, null, 2);
  }

  validateJWT(text) {
    try {
      const parts = text.split('.');
      if (parts.length !== 3) return '❌ Invalid JWT format';

      JSON.parse(atob(parts[0]));
      JSON.parse(atob(parts[1]));

      return '✅ Valid JWT structure';
    } catch (e) {
      return `❌ Invalid JWT: ${e.message}`;
    }
  }

  extractJWTPart(text, index) {
    const parts = text.split('.');
    return JSON.stringify(JSON.parse(atob(parts[index])), null, 2);
  }

  extractSQLTables(text) {
    const tables = text.match(/from\s+(\w+)/gi) || [];
    return tables.map(t => t.replace(/from\s+/i, '')).join('\n');
  }

  uppercaseSQLKeywords(text) {
    const keywords = ['select', 'from', 'where', 'insert', 'update', 'delete', 'join', 'inner', 'left', 'right', 'outer', 'on', 'and', 'or', 'order', 'by', 'group', 'having'];
    let result = text;

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      result = result.replace(regex, keyword.toUpperCase());
    });

    return result;
  }

  toTitleCase(text) {
    return text.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }

  /**
   * Add to history
   */
  addToHistory(text, detection) {
    this.history.unshift({
      text: text.substring(0, 100),
      detection: detection,
      timestamp: Date.now()
    });

    // Keep last 50 items
    if (this.history.length > 50) {
      this.history = this.history.slice(0, 50);
    }

    this.saveHistory();
  }

  /**
   * Show history
   */
  showHistory() {
    if (this.history.length === 0) {
      alert('No history');
      return;
    }

    const items = this.history
      .slice(0, 10)
      .map((item, i) => `${i}: ${item.text} (${item.detection?.type || 'unknown'})`)
      .join('\n');

    const index = prompt(`Select from history:\n${items}`);
    if (index !== null) {
      const item = this.history[parseInt(index)];
      if (item) {
        this.input.value = item.text;
        this.process(item.text);
      }
    }
  }

  /**
   * Show favorites
   */
  showFavorites() {
    if (this.favorites.length === 0) {
      alert('No favorites');
      return;
    }

    const items = this.favorites
      .slice(0, 10)
      .map((item, i) => `${i}: ${item.name} - ${item.data.substring(0, 50)}`)
      .join('\n');

    const index = prompt(`Select favorite:\n${items}`);
    if (index !== null) {
      const item = this.favorites[parseInt(index)];
      if (item) {
        this.input.value = item.data;
        this.process(item.data);
      }
    }
  }

  /**
   * Load history from storage
   */
  loadHistory() {
    try {
      const stored = localStorage.getItem('devchef-quick-input-history');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save history to storage
   */
  saveHistory() {
    try {
      localStorage.setItem('devchef-quick-input-history', JSON.stringify(this.history));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }

  /**
   * Load favorites from storage
   */
  loadFavorites() {
    try {
      const stored = localStorage.getItem('devchef-quick-input-favorites');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save favorites to storage
   */
  saveFavorites() {
    try {
      localStorage.setItem('devchef-quick-input-favorites', JSON.stringify(this.favorites));
    } catch (e) {
      console.error('Failed to save favorites:', e);
    }
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
    localStorage.removeItem('devchef-quick-input-history');
  }

  /**
   * Clear favorites
   */
  clearFavorites() {
    this.favorites = [];
    localStorage.removeItem('devchef-quick-input-favorites');
  }
}

// Create and export singleton
export const quickInput = new QuickInput();
export { QuickInput };
