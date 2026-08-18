/**
 * DevChef Ultimate - Productivity Engine
 * Workflow automation, batch operations, command history
 *
 * Features:
 * - Batch processing for multiple items
 * - Workflow automation
 * - Command history with replay
 */

import { storage } from './storage.js';

class ProductivityEngine {
  constructor() {
    this.commandHistory = [];
    this.maxHistorySize = 100;
    this.automations = [];
    this.batchQueue = [];
    this.init();
  }

  /**
   * Initialize Productivity Engine
   */
  init() {
    this.loadCommandHistory();
    this.loadAutomations();
    this.setupGlobalListeners();
    console.log('⚡ Productivity Engine initialized - Automation & batch ops ready');
  }

  /**
   * Load command history
   */
  loadCommandHistory() {
    const saved = storage.get('devchef-command-history');
    if (saved && Array.isArray(saved)) {
      this.commandHistory = saved;
    }
  }

  /**
   * Save command history
   */
  saveCommandHistory() {
    storage.set('devchef-command-history', this.commandHistory);
  }

  /**
   * Load automations
   */
  loadAutomations() {
    const saved = storage.get('devchef-automations');
    if (saved && Array.isArray(saved)) {
      this.automations = saved;
    }
  }

  /**
   * Save automations
   */
  saveAutomations() {
    storage.set('devchef-automations', this.automations);
  }

  /**
   * Setup global listeners for the command history
   */
  setupGlobalListeners() {
    // Listen for tool switches
    document.addEventListener('tool-opened', (e) => {
      this.addToCommandHistory('tool-open', { toolId: e.detail.toolId });
    });

    // Listen for input changes
    document.addEventListener('input-changed', (e) => {
      this.addToCommandHistory('input-change', { value: e.detail.value });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+H - Show command history
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        this.showCommandHistory();
      }

      // Ctrl+Shift+B - Show batch processor
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        this.showBatchProcessor();
      }
    });
  }

  /**
   * Add to command history
   */
  addToCommandHistory(type, data) {
    const command = {
      type,
      data,
      timestamp: Date.now()
    };

    this.commandHistory.unshift(command);

    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory = this.commandHistory.slice(0, this.maxHistorySize);
    }

    this.saveCommandHistory();
  }

  /**
   * Execute action
   */
  async executeAction(action) {
    try {
      switch (action.type) {
        case 'tool-open':
          if (window.DevChef && window.DevChef.openTool) {
            window.DevChef.openTool(action.data.toolId);
          }
          break;

        case 'input-change':
          const input = document.querySelector('#input');
          if (input) {
            input.value = action.data.value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          break;

        default:
          console.log('Unknown action type:', action.type);
      }
    } catch (error) {
      console.error('Error executing action:', error);
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Show command history
   */
  showCommandHistory() {
    const dialog = document.createElement('div');
    dialog.className = 'productivity-panel';
    dialog.innerHTML = `
      <div class="panel-overlay"></div>
      <div class="panel-content">
        <div class="panel-header">
          <h2>📜 Command History</h2>
          <button class="panel-close" id="history-close">✕</button>
        </div>
        <div class="panel-body">
          ${this.commandHistory.length > 0 ? `
            <div class="command-list">
              ${this.commandHistory.slice(0, 20).map((cmd, i) => `
                <div class="command-item">
                  <span class="command-index">${i + 1}</span>
                  <span class="command-type">${cmd.type}</span>
                  <span class="command-time">${this.formatTime(cmd.timestamp)}</span>
                  <button class="btn-small" onclick="window.productivityEngine.replayCommand(${i})">Replay</button>
                </div>
              `).join('')}
            </div>
          ` : '<div class="empty-state">No command history</div>'}
        </div>
        <div class="panel-footer">
          <button class="btn-secondary" onclick="window.productivityEngine.clearCommandHistory()">Clear History</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    setTimeout(() => dialog.classList.add('show'), 10);

    const cleanup = () => {
      dialog.classList.remove('show');
      setTimeout(() => dialog.remove(), 200);
    };

    dialog.querySelector('#history-close').addEventListener('click', cleanup);
    dialog.querySelector('.panel-overlay').addEventListener('click', cleanup);
  }

  /**
   * Replay command
   */
  async replayCommand(index) {
    const command = this.commandHistory[index];
    if (command) {
      await this.executeAction(command);
    }
  }

  /**
   * Clear command history
   */
  clearCommandHistory() {
    if (confirm('Clear command history?')) {
      this.commandHistory = [];
      this.saveCommandHistory();
      this.showCommandHistory();
    }
  }

  /**
   * Show batch processor
   */
  showBatchProcessor() {
    const dialog = document.createElement('div');
    dialog.className = 'productivity-panel batch-panel';
    dialog.innerHTML = `
      <div class="panel-overlay"></div>
      <div class="panel-content">
        <div class="panel-header">
          <h2>⚡ Batch Processor</h2>
          <button class="panel-close" id="batch-close">✕</button>
        </div>
        <div class="panel-body">
          <div class="batch-controls">
            <label for="batch-tool">Select Tool:</label>
            <select id="batch-tool">
              ${this.getToolOptions()}
            </select>
          </div>
          <div class="batch-input">
            <label for="batch-items">Items (one per line):</label>
            <textarea id="batch-items" rows="10" placeholder="Enter items to process..."></textarea>
          </div>
          <div class="batch-options">
            <label>
              <input type="checkbox" id="batch-parallel">
              Process in parallel
            </label>
            <label>
              Delay between items: <input type="number" id="batch-delay" value="500" min="0" max="5000" style="width:80px"> ms
            </label>
          </div>
        </div>
        <div class="panel-footer">
          <button class="btn-primary" onclick="window.productivityEngine.executeBatch()">Process Batch</button>
          <button class="btn-secondary" id="batch-cancel">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    setTimeout(() => dialog.classList.add('show'), 10);

    const cleanup = () => {
      dialog.classList.remove('show');
      setTimeout(() => dialog.remove(), 200);
    };

    dialog.querySelector('#batch-close').addEventListener('click', cleanup);
    dialog.querySelector('#batch-cancel').addEventListener('click', cleanup);
    dialog.querySelector('.panel-overlay').addEventListener('click', cleanup);
  }

  /**
   * Get tool options for select
   */
  getToolOptions() {
    if (!window.ToolRegistry) return '<option>No tools available</option>';

    const tools = window.ToolRegistry.all();
    return tools.map(tool => `
      <option value="${tool.id}">${tool.manifest.name}</option>
    `).join('');
  }

  /**
   * Execute batch operation
   */
  async executeBatch() {
    const toolId = document.querySelector('#batch-tool')?.value;
    const itemsText = document.querySelector('#batch-items')?.value;
    const parallel = document.querySelector('#batch-parallel')?.checked;
    const delay = parseInt(document.querySelector('#batch-delay')?.value || '500');

    if (!itemsText || !toolId) {
      alert('Please select a tool and enter items');
      return;
    }

    const items = itemsText.split('\n').filter(line => line.trim());

    if (items.length === 0) {
      alert('No items to process');
      return;
    }

    // Close dialog
    const dialog = document.querySelector('.batch-panel');
    if (dialog) dialog.remove();

    // Show progress
    if (window.uiEngine) {
      window.uiEngine.showToast(`⚡ Processing ${items.length} items...`, {
        type: 'info',
        duration: 3000
      });
    }

    if (parallel) {
      await this.processBatchParallel(toolId, items);
    } else {
      await this.processBatchSequential(toolId, items, delay);
    }

    if (window.uiEngine) {
      window.uiEngine.showToast(`✅ Batch processing complete (${items.length} items)`, {
        type: 'success',
        duration: 3000
      });
    }
  }

  /**
   * Process batch sequentially
   */
  async processBatchSequential(toolId, items, delay) {
    for (const item of items) {
      await this.processSingleItem(toolId, item);
      await this.sleep(delay);
    }
  }

  /**
   * Process batch in parallel
   */
  async processBatchParallel(toolId, items) {
    await Promise.all(items.map(item => this.processSingleItem(toolId, item)));
  }

  /**
   * Process single item
   */
  async processSingleItem(toolId, item) {
    try {
      // Open tool
      if (window.DevChef && window.DevChef.openTool) {
        window.DevChef.openTool(toolId);
      }

      // Set input
      const input = document.querySelector('#input');
      if (input) {
        input.value = item;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Wait for processing
      await this.sleep(100);

      // Get output
      const output = document.querySelector('#output')?.value;

      return { input: item, output };
    } catch (error) {
      console.error('Error processing item:', error);
      return { input: item, error: error.message };
    }
  }

  /**
   * Format time
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      commandHistory: this.commandHistory.length,
      automations: this.automations.length
    };
  }
}

// Create and export singleton
export const productivityEngine = new ProductivityEngine();
window.productivityEngine = productivityEngine;
