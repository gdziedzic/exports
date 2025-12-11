/**
 * Dev Tools Panel - V6.5
 * Built-in debugging, inspection, and developer experience tools
 *
 * Features:
 * - State inspector (live view of app state)
 * - Performance timeline visualization
 * - Console output capture and display
 * - Network request monitoring
 * - Tool lifecycle event viewer
 * - Local storage inspector
 * - Error log viewer
 * - Keyboard shortcut reference
 * - Quick access to V6/V6.5 features
 * - Export debug reports
 */

class DevTools {
  constructor() {
    this.isOpen = false;
    this.activeTab = 'console';
    this.consoleLogs = [];
    this.networkRequests = [];
    this.lifecycleEvents = [];
    this.maxLogs = 500;
    this.performanceMarks = [];
    this.shortcuts = [];
    this.init();
  }

  /**
   * Initialize DevTools
   */
  init() {
    try {
      this.setupConsoleCapture();
      this.setupNetworkMonitoring();
      this.setupLifecycleTracking();
      this.setupKeyboardShortcuts();
      this.registerShortcuts();
      console.log('🛠️ DevTools Panel initialized - Developer Experience Enhanced');
    } catch (error) {
      console.error('Error initializing DevTools:', error);
    }
  }

  /**
   * Setup console capture
   */
  setupConsoleCapture() {
    try {
      // Capture console.log
      const originalLog = console.log;
      console.log = (...args) => {
        this.addConsoleLog('log', args);
        originalLog.apply(console, args);
      };

      // Capture console.warn
      const originalWarn = console.warn;
      console.warn = (...args) => {
        this.addConsoleLog('warn', args);
        originalWarn.apply(console, args);
      };

      // Capture console.error (careful with ErrorBoundary)
      const originalError = console.error;
      console.error = (...args) => {
        this.addConsoleLog('error', args);
        originalError.apply(console, args);
      };

      // Capture console.info
      const originalInfo = console.info;
      console.info = (...args) => {
        this.addConsoleLog('info', args);
        originalInfo.apply(console, args);
      };
    } catch (error) {
      console.error('Error setting up console capture:', error);
    }
  }

  /**
   * Add console log
   */
  addConsoleLog(level, args) {
    try {
      const log = {
        level,
        message: args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' '),
        timestamp: Date.now(),
        stack: new Error().stack
      };

      this.consoleLogs.unshift(log);

      // Keep last N logs
      if (this.consoleLogs.length > this.maxLogs) {
        this.consoleLogs.pop();
      }

      // Update UI if panel is open
      if (this.isOpen && this.activeTab === 'console') {
        this.updateConsoleView();
      }
    } catch (error) {
      // Avoid infinite loop
    }
  }

  /**
   * Setup network monitoring
   */
  setupNetworkMonitoring() {
    try {
      // Monitor fetch requests
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const startTime = performance.now();
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;

        try {
          const response = await originalFetch(...args);
          const duration = performance.now() - startTime;

          this.addNetworkRequest({
            method: args[1]?.method || 'GET',
            url,
            status: response.status,
            duration,
            timestamp: Date.now(),
            type: 'fetch'
          });

          return response;
        } catch (error) {
          this.addNetworkRequest({
            method: args[1]?.method || 'GET',
            url,
            status: 'Failed',
            error: error.message,
            timestamp: Date.now(),
            type: 'fetch'
          });
          throw error;
        }
      };

      // Monitor XMLHttpRequest
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url) {
        this._devtools = { method, url, startTime: performance.now() };
        return originalOpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function() {
        const xhr = this;
        const devtools = this._devtools;

        xhr.addEventListener('load', () => {
          if (devtools) {
            const duration = performance.now() - devtools.startTime;
            window.devTools?.addNetworkRequest({
              method: devtools.method,
              url: devtools.url,
              status: xhr.status,
              duration,
              timestamp: Date.now(),
              type: 'xhr'
            });
          }
        });

        return originalSend.apply(this, arguments);
      };
    } catch (error) {
      console.error('Error setting up network monitoring:', error);
    }
  }

  /**
   * Add network request
   */
  addNetworkRequest(request) {
    try {
      this.networkRequests.unshift(request);

      // Keep last 100 requests
      if (this.networkRequests.length > 100) {
        this.networkRequests.pop();
      }

      // Update UI if panel is open
      if (this.isOpen && this.activeTab === 'network') {
        this.updateNetworkView();
      }
    } catch (error) {
      console.error('Error adding network request:', error);
    }
  }

  /**
   * Setup lifecycle tracking
   */
  setupLifecycleTracking() {
    try {
      // Hook into Tool Orchestrator events
      if (window.toolOrchestrator) {
        // Track tool mount/unmount
        const originalMount = window.toolOrchestrator.mountTool.bind(window.toolOrchestrator);
        window.toolOrchestrator.mountTool = async (toolId, data) => {
          this.addLifecycleEvent('tool:mount', { toolId, data });
          const result = await originalMount(toolId, data);
          this.addLifecycleEvent('tool:mounted', { toolId });
          return result;
        };

        const originalUnmount = window.toolOrchestrator.unmountTool.bind(window.toolOrchestrator);
        window.toolOrchestrator.unmountTool = async (toolId) => {
          this.addLifecycleEvent('tool:unmount', { toolId });
          const result = await originalUnmount(toolId);
          this.addLifecycleEvent('tool:unmounted', { toolId });
          return result;
        };
      }

      // Track state changes
      if (window.stateManager) {
        window.stateManager.subscribe('*', (path, value) => {
          this.addLifecycleEvent('state:change', { path, value });
        });
      }
    } catch (error) {
      console.error('Error setting up lifecycle tracking:', error);
    }
  }

  /**
   * Add lifecycle event
   */
  addLifecycleEvent(type, data) {
    try {
      const event = {
        type,
        data,
        timestamp: Date.now()
      };

      this.lifecycleEvents.unshift(event);

      // Keep last 200 events
      if (this.lifecycleEvents.length > 200) {
        this.lifecycleEvents.pop();
      }

      // Update UI if panel is open
      if (this.isOpen && this.activeTab === 'lifecycle') {
        this.updateLifecycleView();
      }
    } catch (error) {
      console.error('Error adding lifecycle event:', error);
    }
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    try {
      // Toggle DevTools with F12 or Ctrl+Shift+I
      document.addEventListener('keydown', (e) => {
        // F12
        if (e.key === 'F12') {
          e.preventDefault();
          this.toggle();
        }

        // Ctrl+Shift+I or Cmd+Shift+I
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
          e.preventDefault();
          this.toggle();
        }

        // Ctrl+Shift+C or Cmd+Shift+C (Console)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
          e.preventDefault();
          this.open('console');
        }

        // Ctrl+Shift+P or Cmd+Shift+P (Performance)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
          e.preventDefault();
          this.open('performance');
        }
      });
    } catch (error) {
      console.error('Error setting up keyboard shortcuts:', error);
    }
  }

  /**
   * Register shortcuts
   */
  registerShortcuts() {
    this.shortcuts = [
      { keys: 'F12', description: 'Toggle DevTools' },
      { keys: 'Ctrl+Shift+I', description: 'Toggle DevTools' },
      { keys: 'Ctrl+Shift+C', description: 'Open Console Tab' },
      { keys: 'Ctrl+Shift+P', description: 'Open Performance Tab' },
      { keys: 'Ctrl+K', description: 'Advanced Search' },
      { keys: 'Ctrl+/', description: 'Toggle Command Palette' },
      { keys: 'Ctrl+`', description: 'Toggle Debug Console' },
      { keys: 'Esc', description: 'Close Modals' }
    ];
  }

  /**
   * Toggle DevTools
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open DevTools
   */
  open(tab = 'console') {
    try {
      this.isOpen = true;
      this.activeTab = tab;
      this.render();
    } catch (error) {
      console.error('Error opening DevTools:', error);
    }
  }

  /**
   * Close DevTools
   */
  close() {
    try {
      this.isOpen = false;
      const panel = document.getElementById('devtools-panel');
      if (panel) {
        panel.remove();
      }
    } catch (error) {
      console.error('Error closing DevTools:', error);
    }
  }

  /**
   * Render DevTools panel
   */
  render() {
    try {
      // Remove existing panel
      const existing = document.getElementById('devtools-panel');
      if (existing) {
        existing.remove();
      }

      // Create panel
      const panel = document.createElement('div');
      panel.id = 'devtools-panel';
      panel.className = 'devtools-panel';
      panel.innerHTML = this.getTemplate();

      document.body.appendChild(panel);

      // Setup event listeners
      this.setupEventListeners();

      // Render active tab content
      this.renderTabContent();
    } catch (error) {
      console.error('Error rendering DevTools:', error);
    }
  }

  /**
   * Get panel template
   */
  getTemplate() {
    return `
      <div class="devtools-header">
        <h3>🛠️ DevTools</h3>
        <div class="devtools-tabs">
          <button class="devtools-tab ${this.activeTab === 'console' ? 'active' : ''}" data-tab="console">
            📝 Console
          </button>
          <button class="devtools-tab ${this.activeTab === 'state' ? 'active' : ''}" data-tab="state">
            💾 State
          </button>
          <button class="devtools-tab ${this.activeTab === 'performance' ? 'active' : ''}" data-tab="performance">
            🚀 Performance
          </button>
          <button class="devtools-tab ${this.activeTab === 'network' ? 'active' : ''}" data-tab="network">
            🌐 Network
          </button>
          <button class="devtools-tab ${this.activeTab === 'lifecycle' ? 'active' : ''}" data-tab="lifecycle">
            🔄 Lifecycle
          </button>
          <button class="devtools-tab ${this.activeTab === 'storage' ? 'active' : ''}" data-tab="storage">
            💿 Storage
          </button>
          <button class="devtools-tab ${this.activeTab === 'shortcuts' ? 'active' : ''}" data-tab="shortcuts">
            ⌨️ Shortcuts
          </button>
        </div>
        <button class="devtools-close" id="devtools-close">✕</button>
      </div>
      <div class="devtools-content" id="devtools-content">
        <!-- Content rendered dynamically -->
      </div>
      <div class="devtools-footer">
        <button id="devtools-clear">Clear</button>
        <button id="devtools-export">Export Report</button>
        <span class="devtools-stats"></span>
      </div>
    `;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    try {
      // Tab switching
      document.querySelectorAll('.devtools-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          this.activeTab = tab.dataset.tab;
          this.render();
        });
      });

      // Close button
      const closeBtn = document.getElementById('devtools-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close());
      }

      // Clear button
      const clearBtn = document.getElementById('devtools-clear');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => this.clearActiveTab());
      }

      // Export button
      const exportBtn = document.getElementById('devtools-export');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => this.exportReport());
      }
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }

  /**
   * Render tab content
   */
  renderTabContent() {
    try {
      const content = document.getElementById('devtools-content');
      if (!content) return;

      switch (this.activeTab) {
        case 'console':
          content.innerHTML = this.renderConsoleTab();
          break;
        case 'state':
          content.innerHTML = this.renderStateTab();
          break;
        case 'performance':
          content.innerHTML = this.renderPerformanceTab();
          break;
        case 'network':
          content.innerHTML = this.renderNetworkTab();
          break;
        case 'lifecycle':
          content.innerHTML = this.renderLifecycleTab();
          break;
        case 'storage':
          content.innerHTML = this.renderStorageTab();
          break;
        case 'shortcuts':
          content.innerHTML = this.renderShortcutsTab();
          break;
      }
    } catch (error) {
      console.error('Error rendering tab content:', error);
    }
  }

  /**
   * Render Console tab
   */
  renderConsoleTab() {
    const logs = this.consoleLogs.slice(0, 100); // Show last 100

    return `
      <div class="devtools-console">
        ${logs.map(log => `
          <div class="console-log console-${log.level}">
            <span class="log-timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
            <span class="log-level">[${log.level.toUpperCase()}]</span>
            <span class="log-message">${this.escapeHtml(log.message)}</span>
          </div>
        `).join('')}
        ${logs.length === 0 ? '<p class="devtools-empty">No console logs yet</p>' : ''}
      </div>
    `;
  }

  /**
   * Render State tab
   */
  renderStateTab() {
    try {
      const state = window.stateManager ? window.stateManager.getState() : {};
      const stateJson = JSON.stringify(state, null, 2);

      return `
        <div class="devtools-state">
          <div class="state-controls">
            <button onclick="window.devTools.exportState()">Export State</button>
            <button onclick="window.devTools.resetState()">Reset State</button>
          </div>
          <pre class="state-json">${this.escapeHtml(stateJson)}</pre>
        </div>
      `;
    } catch (error) {
      return `<p class="devtools-error">Error loading state: ${error.message}</p>`;
    }
  }

  /**
   * Render Performance tab
   */
  renderPerformanceTab() {
    try {
      if (!window.performanceMonitor) {
        return '<p class="devtools-info">Performance Monitor not available</p>';
      }

      const metrics = window.performanceMonitor.getMetrics();
      const suggestions = window.performanceMonitor.getOptimizationSuggestions();

      return `
        <div class="devtools-performance">
          <div class="performance-metrics">
            <div class="metric-card">
              <h4>🎯 FPS</h4>
              <div class="metric-value">${metrics.fps?.current || 0}</div>
              <div class="metric-detail">Avg: ${(metrics.fps?.average || 0).toFixed(1)}</div>
            </div>
            <div class="metric-card">
              <h4>💾 Memory</h4>
              <div class="metric-value">${((metrics.memory?.current || 0) / 1024 / 1024).toFixed(1)}MB</div>
              <div class="metric-detail">Peak: ${((metrics.memory?.peak || 0) / 1024 / 1024).toFixed(1)}MB</div>
            </div>
            <div class="metric-card">
              <h4>⚡ Load Time</h4>
              <div class="metric-value">${(metrics.loadTimes?.average || 0).toFixed(0)}ms</div>
              <div class="metric-detail">${metrics.loadTimes?.count || 0} tools</div>
            </div>
          </div>
          ${suggestions.length > 0 ? `
            <div class="performance-suggestions">
              <h4>💡 Optimization Suggestions</h4>
              ${suggestions.map(s => `
                <div class="suggestion-item">
                  <strong>${s.title}</strong>
                  <p>${s.description}</p>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <button onclick="window.performanceMonitor.showPanel()">Open Performance Monitor</button>
        </div>
      `;
    } catch (error) {
      return `<p class="devtools-error">Error loading performance: ${error.message}</p>`;
    }
  }

  /**
   * Render Network tab
   */
  renderNetworkTab() {
    const requests = this.networkRequests.slice(0, 50); // Show last 50

    return `
      <div class="devtools-network">
        <table class="network-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Method</th>
              <th>URL</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(req => `
              <tr class="network-${req.status >= 200 && req.status < 300 ? 'success' : 'error'}">
                <td>${new Date(req.timestamp).toLocaleTimeString()}</td>
                <td>${req.method}</td>
                <td class="network-url" title="${req.url}">${this.truncateUrl(req.url)}</td>
                <td>${req.status}</td>
                <td>${req.duration ? req.duration.toFixed(0) + 'ms' : '-'}</td>
                <td>${req.type}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${requests.length === 0 ? '<p class="devtools-empty">No network requests yet</p>' : ''}
      </div>
    `;
  }

  /**
   * Render Lifecycle tab
   */
  renderLifecycleTab() {
    const events = this.lifecycleEvents.slice(0, 100); // Show last 100

    return `
      <div class="devtools-lifecycle">
        ${events.map(event => `
          <div class="lifecycle-event">
            <span class="event-timestamp">${new Date(event.timestamp).toLocaleTimeString()}</span>
            <span class="event-type">${event.type}</span>
            <span class="event-data">${JSON.stringify(event.data)}</span>
          </div>
        `).join('')}
        ${events.length === 0 ? '<p class="devtools-empty">No lifecycle events yet</p>' : ''}
      </div>
    `;
  }

  /**
   * Render Storage tab
   */
  renderStorageTab() {
    try {
      const localStorage = this.getLocalStorageData();
      const sessionStorage = this.getSessionStorageData();

      return `
        <div class="devtools-storage">
          <div class="storage-section">
            <h4>📦 Local Storage</h4>
            <table class="storage-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                ${localStorage.map(item => `
                  <tr>
                    <td>${item.key}</td>
                    <td class="storage-value">${this.escapeHtml(item.value)}</td>
                    <td>${item.size}B</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="storage-section">
            <h4>🗂️ Session Storage</h4>
            <table class="storage-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                ${sessionStorage.map(item => `
                  <tr>
                    <td>${item.key}</td>
                    <td class="storage-value">${this.escapeHtml(item.value)}</td>
                    <td>${item.size}B</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (error) {
      return `<p class="devtools-error">Error loading storage: ${error.message}</p>`;
    }
  }

  /**
   * Render Shortcuts tab
   */
  renderShortcutsTab() {
    return `
      <div class="devtools-shortcuts">
        <h4>⌨️ Keyboard Shortcuts</h4>
        <table class="shortcuts-table">
          <thead>
            <tr>
              <th>Shortcut</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${this.shortcuts.map(shortcut => `
              <tr>
                <td class="shortcut-keys">${shortcut.keys.replace(/Ctrl/g, navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl')}</td>
                <td>${shortcut.description}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Get localStorage data
   */
  getLocalStorageData() {
    try {
      const data = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        data.push({
          key,
          value: value.length > 100 ? value.substring(0, 100) + '...' : value,
          size: value.length
        });
      }
      return data;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get sessionStorage data
   */
  getSessionStorageData() {
    try {
      const data = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const value = sessionStorage.getItem(key);
        data.push({
          key,
          value: value.length > 100 ? value.substring(0, 100) + '...' : value,
          size: value.length
        });
      }
      return data;
    } catch (error) {
      return [];
    }
  }

  /**
   * Update console view (live update)
   */
  updateConsoleView() {
    try {
      if (this.activeTab === 'console') {
        this.renderTabContent();
      }
    } catch (error) {
      console.error('Error updating console view:', error);
    }
  }

  /**
   * Update network view (live update)
   */
  updateNetworkView() {
    try {
      if (this.activeTab === 'network') {
        this.renderTabContent();
      }
    } catch (error) {
      console.error('Error updating network view:', error);
    }
  }

  /**
   * Update lifecycle view (live update)
   */
  updateLifecycleView() {
    try {
      if (this.activeTab === 'lifecycle') {
        this.renderTabContent();
      }
    } catch (error) {
      console.error('Error updating lifecycle view:', error);
    }
  }

  /**
   * Clear active tab
   */
  clearActiveTab() {
    try {
      switch (this.activeTab) {
        case 'console':
          this.consoleLogs = [];
          break;
        case 'network':
          this.networkRequests = [];
          break;
        case 'lifecycle':
          this.lifecycleEvents = [];
          break;
      }
      this.renderTabContent();
    } catch (error) {
      console.error('Error clearing tab:', error);
    }
  }

  /**
   * Export state
   */
  exportState() {
    try {
      const state = window.stateManager ? window.stateManager.getState() : {};
      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `devchef-state-${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting state:', error);
    }
  }

  /**
   * Reset state
   */
  resetState() {
    try {
      if (window.stateManager && confirm('Are you sure you want to reset all state?')) {
        window.stateManager.reset();
        this.renderTabContent();
      }
    } catch (error) {
      console.error('Error resetting state:', error);
    }
  }

  /**
   * Export debug report
   */
  exportReport() {
    try {
      const report = {
        timestamp: Date.now(),
        consoleLogs: this.consoleLogs.slice(0, 100),
        networkRequests: this.networkRequests.slice(0, 50),
        lifecycleEvents: this.lifecycleEvents.slice(0, 100),
        state: window.stateManager ? window.stateManager.getState() : {},
        performance: window.performanceMonitor ? window.performanceMonitor.generateReport() : {},
        errors: window.errorBoundary ? window.errorBoundary.getStatistics() : {}
      };

      const json = JSON.stringify(report, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `devchef-debug-${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    try {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    } catch (error) {
      return String(text);
    }
  }

  /**
   * Truncate URL
   */
  truncateUrl(url) {
    try {
      if (url.length <= 50) return url;
      return url.substring(0, 47) + '...';
    } catch (error) {
      return url;
    }
  }
}

// Export singleton instance
export const devTools = new DevTools();
// Make globally available
window.devTools = devTools;
export { DevTools };
