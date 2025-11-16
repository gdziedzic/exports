/**
 * DevChef Debug Console
 * Captures and displays debugging information
 */

class DebugConsole {
  constructor() {
    this.logs = [];
    this.maxLogs = 500;
    this.consoleElement = null;
    this.isVisible = false;
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };

    this.initialize();
  }

  initialize() {
    // Intercept console methods
    const self = this;

    console.log = function(...args) {
      self.originalConsole.log.apply(console, args);
      self.addLog('log', args);
    };

    console.warn = function(...args) {
      self.originalConsole.warn.apply(console, args);
      self.addLog('warn', args);
    };

    console.error = function(...args) {
      self.originalConsole.error.apply(console, args);
      self.addLog('error', args);
    };

    console.info = function(...args) {
      self.originalConsole.info.apply(console, args);
      self.addLog('info', args);
    };
  }

  addLog(type, args) {
    const timestamp = new Date().toLocaleTimeString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    this.logs.push({ type, message, timestamp });

    // Limit log size
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Update UI if console is visible
    if (this.isVisible && this.consoleElement) {
      this.renderLogs();
    }
  }

  createConsoleUI() {
    const consoleDiv = document.createElement('div');
    consoleDiv.id = 'debug-console';
    consoleDiv.className = 'debug-console hidden';
    consoleDiv.innerHTML = `
      <div class="console-header">
        <div class="console-title">
          <span class="console-icon">🐛</span>
          <span>Debug Console</span>
          <span class="console-count">${this.logs.length}</span>
        </div>
        <div class="console-actions">
          <button id="console-clear" class="console-btn" title="Clear logs">
            <span>🗑️</span>
          </button>
          <button id="console-export" class="console-btn" title="Export logs">
            <span>💾</span>
          </button>
          <button id="console-close" class="console-btn" title="Close console">
            <span>✕</span>
          </button>
        </div>
      </div>
      <div class="console-filters">
        <label class="console-filter">
          <input type="checkbox" class="filter-checkbox" data-type="log" checked>
          <span class="filter-label">Log</span>
        </label>
        <label class="console-filter">
          <input type="checkbox" class="filter-checkbox" data-type="info" checked>
          <span class="filter-label">Info</span>
        </label>
        <label class="console-filter">
          <input type="checkbox" class="filter-checkbox" data-type="warn" checked>
          <span class="filter-label">Warn</span>
        </label>
        <label class="console-filter">
          <input type="checkbox" class="filter-checkbox" data-type="error" checked>
          <span class="filter-label">Error</span>
        </label>
      </div>
      <div class="console-body" id="console-logs"></div>
    `;

    document.body.appendChild(consoleDiv);
    this.consoleElement = consoleDiv;

    // Set up event handlers
    this.setupEventHandlers();

    return consoleDiv;
  }

  setupEventHandlers() {
    // Clear button
    const clearBtn = this.consoleElement.querySelector('#console-clear');
    clearBtn?.addEventListener('click', () => {
      this.clearLogs();
    });

    // Export button
    const exportBtn = this.consoleElement.querySelector('#console-export');
    exportBtn?.addEventListener('click', () => {
      this.exportLogs();
    });

    // Close button
    const closeBtn = this.consoleElement.querySelector('#console-close');
    closeBtn?.addEventListener('click', () => {
      this.hide();
    });

    // Filter checkboxes
    const filterCheckboxes = this.consoleElement.querySelectorAll('.filter-checkbox');
    filterCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.renderLogs();
      });
    });
  }

  renderLogs() {
    if (!this.consoleElement) return;

    const logsContainer = this.consoleElement.querySelector('#console-logs');
    const countEl = this.consoleElement.querySelector('.console-count');

    // Get active filters
    const activeFilters = new Set();
    this.consoleElement.querySelectorAll('.filter-checkbox:checked').forEach(cb => {
      activeFilters.add(cb.dataset.type);
    });

    // Filter and render logs
    const filteredLogs = this.logs.filter(log => activeFilters.has(log.type));

    logsContainer.innerHTML = filteredLogs.map(log => {
      const icon = {
        log: '📝',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌'
      }[log.type] || '📝';

      return `
        <div class="console-entry console-${log.type}">
          <span class="console-timestamp">${log.timestamp}</span>
          <span class="console-type-icon">${icon}</span>
          <span class="console-message">${this.escapeHtml(log.message)}</span>
        </div>
      `;
    }).join('');

    if (countEl) {
      countEl.textContent = filteredLogs.length;
    }

    // Auto-scroll to bottom
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  show() {
    if (!this.consoleElement) {
      this.createConsoleUI();
    }

    this.consoleElement.classList.remove('hidden');
    this.isVisible = true;
    this.renderLogs();
  }

  hide() {
    if (this.consoleElement) {
      this.consoleElement.classList.add('hidden');
      this.isVisible = false;
    }
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  clearLogs() {
    this.logs = [];
    this.renderLogs();
  }

  exportLogs() {
    const logText = this.logs.map(log => {
      return `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`;
    }).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `devchef-logs-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

// Create and export singleton instance
export const debugConsole = new DebugConsole();
