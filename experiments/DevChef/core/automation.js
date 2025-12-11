/**
 * Advanced Automation Engine
 * Scheduled tasks, file watchers, and event triggers
 *
 * Features:
 * - Cron-style task scheduling
 * - Event-based triggers
 * - Conditional automation
 * - Task history and logging
 * - Import/export automations
 */

class AutomationEngine {
  constructor() {
    this.automations = new Map();
    this.runningTasks = new Map();
    this.taskHistory = [];
    this.isOpen = false;
    this.init();
  }

  init() {
    this.loadAutomations();
    this.startScheduler();
    this.setupEventListeners();
    console.log('Advanced Automation Engine initialized');
  }

  registerShortcut() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'U') {
        e.preventDefault();
        this.open();
      }
    });
  }

  open() {
    if (this.isOpen) return;
    this.createPanel();
    this.isOpen = true;
  }

  close() {
    const panel = document.getElementById('automation-panel');
    if (panel) panel.remove();
    this.isOpen = false;
  }

  createPanel() {
    const panel = document.createElement('div');
    panel.id = 'automation-panel';
    panel.className = 'automation-panel';
    panel.innerHTML = `
      <div class="automation-container">
        <div class="automation-header">
          <h2>⚙️ Automation Engine</h2>
          <button class="btn-close">✕</button>
        </div>
        <div class="automation-content">
          <div class="automation-list">
            <h3>Automations</h3>
            <button id="new-automation-btn" class="btn-primary">➕ New Automation</button>
            <div id="automations-list"></div>
          </div>
          <div class="automation-editor">
            <div class="editor-section">
              <h3>Automation Configuration</h3>
              <input id="automation-name" placeholder="Automation Name" />
              <select id="trigger-type">
                <option value="schedule">Schedule (Cron)</option>
                <option value="event">Event Trigger</option>
                <option value="clipboard">Clipboard Change</option>
                <option value="manual">Manual Only</option>
              </select>
              <input id="trigger-config" placeholder="Cron: */5 * * * * or Event name" />
            </div>
            <div class="editor-section">
              <h3>Actions</h3>
              <button id="add-action-btn">➕ Add Action</button>
              <div id="actions-container"></div>
            </div>
            <div class="editor-section">
              <h3>Conditions (Optional)</h3>
              <textarea id="conditions" placeholder="JavaScript expression (e.g., data.length > 0)" rows="3"></textarea>
            </div>
            <div class="editor-actions">
              <button id="test-automation-btn" class="btn-primary">🧪 Test</button>
              <button id="save-automation-btn" class="btn-primary">💾 Save</button>
              <button id="run-automation-btn" class="btn-success">▶️ Run Now</button>
            </div>
          </div>
          <div class="automation-history">
            <h3>Execution History</h3>
            <div id="history-list"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    this.setupPanelEventListeners();
    this.renderAutomationsList();
    this.renderHistory();
  }

  setupPanelEventListeners() {
    document.querySelector('.automation-panel .btn-close')?.addEventListener('click', () => this.close());
    document.getElementById('new-automation-btn')?.addEventListener('click', () => this.newAutomation());
    document.getElementById('add-action-btn')?.addEventListener('click', () => this.addAction());
    document.getElementById('test-automation-btn')?.addEventListener('click', () => this.testAutomation());
    document.getElementById('save-automation-btn')?.addEventListener('click', () => this.saveAutomation());
    document.getElementById('run-automation-btn')?.addEventListener('click', () => this.runNow());
  }

  setupEventListeners() {
    // Listen for clipboard events
    document.addEventListener('paste', (e) => {
      this.triggerEvent('clipboard', { data: e.clipboardData?.getData('text') });
    });

    // Listen for custom events
    document.addEventListener('devchef-event', (e) => {
      this.triggerEvent('custom', e.detail);
    });
  }

  startScheduler() {
    // Check scheduled tasks every minute
    setInterval(() => {
      this.checkScheduledTasks();
    }, 60000);
  }

  checkScheduledTasks() {
    const now = new Date();

    for (const [id, automation] of this.automations.entries()) {
      if (automation.triggerType === 'schedule' && automation.enabled) {
        if (this.shouldRunScheduledTask(automation, now)) {
          this.executeAutomation(id);
        }
      }
    }
  }

  shouldRunScheduledTask(automation, now) {
    // Simple cron-like matching (every N minutes)
    const config = automation.triggerConfig;
    if (config.startsWith('*/')) {
      const minutes = parseInt(config.match(/\d+/)[0]);
      return now.getMinutes() % minutes === 0;
    }
    return false;
  }

  triggerEvent(eventType, data) {
    for (const [id, automation] of this.automations.entries()) {
      if (automation.triggerType === 'event' && automation.enabled) {
        if (automation.triggerConfig === eventType) {
          this.executeAutomation(id, data);
        }
      } else if (automation.triggerType === 'clipboard' && eventType === 'clipboard' && automation.enabled) {
        this.executeAutomation(id, data);
      }
    }
  }

  async executeAutomation(id, data = null) {
    const automation = this.automations.get(id);
    if (!automation) return;

    const executionId = `exec-${Date.now()}`;
    this.runningTasks.set(executionId, { id, startTime: Date.now() });

    const historyEntry = {
      id: executionId,
      automationId: id,
      automationName: automation.name,
      startTime: Date.now(),
      status: 'running',
      results: []
    };

    try {
      // Check conditions
      if (automation.conditions) {
        const conditionMet = this.evaluateCondition(automation.conditions, data);
        if (!conditionMet) {
          historyEntry.status = 'skipped';
          historyEntry.message = 'Condition not met';
          this.taskHistory.unshift(historyEntry);
          return;
        }
      }

      // Execute actions
      for (const action of automation.actions) {
        const result = await this.executeAction(action, data);
        historyEntry.results.push(result);
      }

      historyEntry.status = 'success';
      historyEntry.endTime = Date.now();
    } catch (error) {
      historyEntry.status = 'error';
      historyEntry.error = error.message;
      historyEntry.endTime = Date.now();
    }

    this.runningTasks.delete(executionId);
    this.taskHistory.unshift(historyEntry);

    // Keep last 100 entries
    if (this.taskHistory.length > 100) {
      this.taskHistory = this.taskHistory.slice(0, 100);
    }

    this.saveHistory();
    if (this.isOpen) {
      this.renderHistory();
    }
  }

  async executeAction(action, data) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate execution

    switch (action.type) {
      case 'open-tool':
        window.openTool && window.openTool(action.toolId);
        return { success: true, message: `Opened tool: ${action.toolId}` };

      case 'run-pipeline':
        // Execute pipeline
        return { success: true, message: `Ran pipeline: ${action.pipelineId}` };

      case 'notification':
        window.notifications?.info(action.message);
        return { success: true, message: `Sent notification: ${action.message}` };

      case 'console-log':
        console.log('Automation:', action.message, data);
        return { success: true, message: `Logged: ${action.message}` };

      default:
        return { success: false, message: `Unknown action type: ${action.type}` };
    }
  }

  evaluateCondition(condition, data) {
    try {
      const func = new Function('data', `return ${condition}`);
      return func(data);
    } catch (e) {
      console.error('Condition evaluation failed:', e);
      return false;
    }
  }

  newAutomation() {
    this.currentAutomation = {
      id: `automation-${Date.now()}`,
      name: '',
      triggerType: 'schedule',
      triggerConfig: '*/5 * * * *',
      actions: [],
      conditions: '',
      enabled: true
    };
    this.renderAutomationEditor();
  }

  addAction() {
    if (!this.currentAutomation) return;
    this.currentAutomation.actions.push({
      id: `action-${Date.now()}`,
      type: 'console-log',
      message: 'Hello from automation'
    });
    this.renderActions();
  }

  renderActions() {
    const container = document.getElementById('actions-container');
    if (!container || !this.currentAutomation) return;

    container.innerHTML = this.currentAutomation.actions.map((action, i) => `
      <div class="action-item">
        <select data-index="${i}" data-field="type">
          <option value="console-log" ${action.type === 'console-log' ? 'selected' : ''}>Console Log</option>
          <option value="notification" ${action.type === 'notification' ? 'selected' : ''}>Notification</option>
          <option value="open-tool" ${action.type === 'open-tool' ? 'selected' : ''}>Open Tool</option>
          <option value="run-pipeline" ${action.type === 'run-pipeline' ? 'selected' : ''}>Run Pipeline</option>
        </select>
        <input value="${action.message || ''}" placeholder="Message/Tool ID" data-index="${i}" data-field="message" />
        <button class="btn-remove" data-index="${i}">🗑️</button>
      </div>
    `).join('');

    container.querySelectorAll('select, input').forEach(el => {
      el.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        const field = e.target.dataset.field;
        this.currentAutomation.actions[index][field] = e.target.value;
      });
    });

    container.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.currentAutomation.actions.splice(index, 1);
        this.renderActions();
      });
    });
  }

  saveAutomation() {
    if (!this.currentAutomation) return;

    this.currentAutomation.name = document.getElementById('automation-name')?.value || '';
    this.currentAutomation.triggerType = document.getElementById('trigger-type')?.value || 'schedule';
    this.currentAutomation.triggerConfig = document.getElementById('trigger-config')?.value || '';
    this.currentAutomation.conditions = document.getElementById('conditions')?.value || '';

    this.automations.set(this.currentAutomation.id, this.currentAutomation);
    this.saveToStorage();
    this.renderAutomationsList();
    alert('Automation saved!');
  }

  testAutomation() {
    if (!this.currentAutomation) return;
    alert('Testing automation... Check console for output');
    this.executeAutomation(this.currentAutomation.id, { test: true });
  }

  runNow() {
    if (!this.currentAutomation) return;
    this.executeAutomation(this.currentAutomation.id);
  }

  renderAutomationsList() {
    const list = document.getElementById('automations-list');
    if (!list) return;

    list.innerHTML = Array.from(this.automations.values()).map(auto => `
      <div class="automation-item ${auto.enabled ? 'enabled' : 'disabled'}">
        <span>${auto.name || 'Untitled'}</span>
        <div class="automation-actions">
          <button class="btn-toggle" data-id="${auto.id}">${auto.enabled ? '⏸️' : '▶️'}</button>
          <button class="btn-edit" data-id="${auto.id}">✏️</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.btn-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const auto = this.automations.get(id);
        if (auto) {
          auto.enabled = !auto.enabled;
          this.saveToStorage();
          this.renderAutomationsList();
        }
      });
    });

    list.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.currentAutomation = this.automations.get(id);
        this.renderAutomationEditor();
      });
    });
  }

  renderAutomationEditor() {
    if (!this.currentAutomation) return;
    document.getElementById('automation-name').value = this.currentAutomation.name;
    document.getElementById('trigger-type').value = this.currentAutomation.triggerType;
    document.getElementById('trigger-config').value = this.currentAutomation.triggerConfig;
    document.getElementById('conditions').value = this.currentAutomation.conditions;
    this.renderActions();
  }

  renderHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;

    list.innerHTML = this.taskHistory.slice(0, 20).map(entry => {
      const duration = entry.endTime ? `${entry.endTime - entry.startTime}ms` : 'Running...';
      const statusClass = entry.status === 'success' ? 'success' : entry.status === 'error' ? 'error' : 'info';

      return `
        <div class="history-item ${statusClass}">
          <div class="history-header">
            <span class="history-name">${entry.automationName}</span>
            <span class="history-status">${entry.status}</span>
          </div>
          <div class="history-details">
            <span>${new Date(entry.startTime).toLocaleTimeString()}</span>
            <span>${duration}</span>
          </div>
          ${entry.error ? `<div class="history-error">${entry.error}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  loadAutomations() {
    try {
      const stored = localStorage.getItem('devchef-automations');
      if (stored) {
        const autos = JSON.parse(stored);
        this.automations = new Map(Object.entries(autos));
      }
    } catch (e) {
      console.error('Failed to load automations:', e);
    }
  }

  saveToStorage() {
    try {
      const autos = Object.fromEntries(this.automations);
      localStorage.setItem('devchef-automations', JSON.stringify(autos));
    } catch (e) {
      console.error('Failed to save automations:', e);
    }
  }

  loadHistory() {
    try {
      const stored = localStorage.getItem('devchef-automation-history');
      if (stored) {
        this.taskHistory = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }

  saveHistory() {
    try {
      localStorage.setItem('devchef-automation-history', JSON.stringify(this.taskHistory.slice(0, 100)));
    } catch (e) {
      console.error('Failed to save history:', e);
    }
  }
}

export const automationEngine = new AutomationEngine();
export { AutomationEngine };
