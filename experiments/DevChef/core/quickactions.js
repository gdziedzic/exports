/**
 * DevChef V2.5 - Quick Actions System
 * Lightning-fast command runner for common actions
 */

import { storage } from './storage.js';
import { notifications } from './notifications.js';
import { clipboardDetector } from './clipboard.js';
import { snippetManager } from './snippets.js';
import { pipelineManager } from './pipeline.js';
import { workspaceManager } from './workspace.js';
import { analytics } from './analytics.js';

class QuickActionsManager {
  constructor() {
    this.actions = [];
    this.customActions = [];
    this.initializeDefaultActions();
    this.loadCustomActions();
  }

  /**
   * Initialize default actions
   */
  initializeDefaultActions() {
    this.actions = [
      // Clipboard actions
      {
        id: 'paste-smart',
        name: 'Smart Paste',
        description: 'Paste and auto-detect tool',
        icon: '📋',
        category: 'Clipboard',
        keywords: ['paste', 'clipboard', 'smart'],
        action: async () => await this.smartPaste()
      },
      {
        id: 'clipboard-history',
        name: 'Clipboard History',
        description: 'View clipboard history',
        icon: '📜',
        category: 'Clipboard',
        keywords: ['clipboard', 'history'],
        action: () => this.showClipboardHistory()
      },

      // Snippet actions
      {
        id: 'new-snippet',
        name: 'New Snippet',
        description: 'Create new snippet',
        icon: '➕',
        category: 'Snippets',
        keywords: ['snippet', 'new', 'create'],
        action: () => this.createSnippet()
      },
      {
        id: 'browse-snippets',
        name: 'Browse Snippets',
        description: 'Browse snippet library',
        icon: '📚',
        category: 'Snippets',
        keywords: ['snippets', 'library', 'browse'],
        action: () => this.browseSnippets()
      },

      // Pipeline actions
      {
        id: 'new-pipeline',
        name: 'New Pipeline',
        description: 'Create tool pipeline',
        icon: '⚡',
        category: 'Pipelines',
        keywords: ['pipeline', 'chain', 'workflow'],
        action: () => this.createPipeline()
      },
      {
        id: 'run-pipeline',
        name: 'Run Pipeline',
        description: 'Execute saved pipeline',
        icon: '▶️',
        category: 'Pipelines',
        keywords: ['pipeline', 'run', 'execute'],
        action: () => this.runPipeline()
      },

      // Workspace actions
      {
        id: 'new-workspace',
        name: 'New Workspace',
        description: 'Create new workspace',
        icon: '🖥️',
        category: 'Workspace',
        keywords: ['workspace', 'layout', 'new'],
        action: () => this.createWorkspace()
      },
      {
        id: 'switch-workspace',
        name: 'Switch Workspace',
        description: 'Switch to another workspace',
        icon: '🔄',
        category: 'Workspace',
        keywords: ['workspace', 'switch'],
        action: () => this.switchWorkspace()
      },
      {
        id: 'split-horizontal',
        name: 'Split Horizontal',
        description: 'Split workspace horizontally',
        icon: '↔️',
        category: 'Workspace',
        keywords: ['split', 'horizontal', 'layout'],
        action: () => this.splitHorizontal()
      },
      {
        id: 'split-vertical',
        name: 'Split Vertical',
        description: 'Split workspace vertically',
        icon: '↕️',
        category: 'Workspace',
        keywords: ['split', 'vertical', 'layout'],
        action: () => this.splitVertical()
      },

      // Analytics actions
      {
        id: 'view-insights',
        name: 'Productivity Insights',
        description: 'View productivity dashboard',
        icon: '📊',
        category: 'Analytics',
        keywords: ['analytics', 'insights', 'productivity'],
        action: () => this.viewInsights()
      },

      // Settings actions
      {
        id: 'export-all',
        name: 'Export Everything',
        description: 'Export all settings and data',
        icon: '💾',
        category: 'Settings',
        keywords: ['export', 'backup', 'save'],
        action: () => this.exportAll()
      },
      {
        id: 'import-data',
        name: 'Import Data',
        description: 'Import settings or snippets',
        icon: '📥',
        category: 'Settings',
        keywords: ['import', 'restore', 'load'],
        action: () => this.importData()
      }
    ];
  }

  /**
   * Load custom actions from storage
   */
  loadCustomActions() {
    const saved = storage.get('devchef-v2.5-custom-actions');
    if (saved && Array.isArray(saved)) {
      this.customActions = saved;
    }
  }

  /**
   * Save custom actions
   */
  saveCustomActions() {
    storage.set('devchef-v2.5-custom-actions', this.customActions);
  }

  /**
   * Get all actions
   * @param {string} query - Search query
   * @returns {Array} Matching actions
   */
  getAllActions(query = '') {
    const allActions = [...this.actions, ...this.customActions];

    if (!query) return allActions;

    const lowerQuery = query.toLowerCase();
    return allActions.filter(action =>
      action.name.toLowerCase().includes(lowerQuery) ||
      action.description.toLowerCase().includes(lowerQuery) ||
      action.keywords.some(k => k.includes(lowerQuery))
    );
  }

  /**
   * Execute action
   * @param {string} actionId - Action ID
   * @returns {Promise<*>} Action result
   */
  async executeAction(actionId) {
    const action = [...this.actions, ...this.customActions].find(a => a.id === actionId);
    if (!action) {
      throw new Error('Action not found');
    }

    analytics.trackEvent('quick_action', { actionId, actionName: action.name });

    try {
      const result = await action.action();
      notifications.success(`Executed: ${action.name}`);
      return result;
    } catch (error) {
      notifications.error(`Failed to execute ${action.name}: ${error.message}`);
      throw error;
    }
  }

  // Action implementations

  async smartPaste() {
    const result = await clipboardDetector.readClipboard();
    if (result && result.suggestions.length > 0) {
      return {
        detected: result.type,
        suggestedTool: result.suggestions[0],
        confidence: result.confidence
      };
    }
    return null;
  }

  showClipboardHistory() {
    const history = clipboardDetector.getHistory();
    return history;
  }

  createSnippet() {
    return { action: 'show-snippet-dialog' };
  }

  browseSnippets() {
    return { action: 'show-snippets-library' };
  }

  createPipeline() {
    return { action: 'show-pipeline-dialog' };
  }

  runPipeline() {
    return { action: 'show-pipeline-runner' };
  }

  createWorkspace() {
    const name = `Workspace ${workspaceManager.getAllWorkspaces().length + 1}`;
    return workspaceManager.createWorkspace(name);
  }

  switchWorkspace() {
    return { action: 'show-workspace-switcher' };
  }

  splitHorizontal() {
    workspaceManager.setLayout('split-h');
    return { layout: 'split-h' };
  }

  splitVertical() {
    workspaceManager.setLayout('split-v');
    return { layout: 'split-v' };
  }

  viewInsights() {
    return analytics.getInsights({ days: 7 });
  }

  exportAll() {
    const data = {
      version: '2.5',
      type: 'devchef-complete-export',
      exportedAt: new Date().toISOString(),
      settings: storage.exportData(),
      snippets: snippetManager.exportAllSnippets(),
      pipelines: pipelineManager.getAllPipelines(),
      workspaces: workspaceManager.getAllWorkspaces(),
      analytics: analytics.exportAnalytics()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `devchef-complete-backup-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    return { exported: true };
  }

  importData() {
    return { action: 'show-import-dialog' };
  }

  /**
   * Add custom action
   * @param {Object} actionData - Action data
   * @returns {Object} Created action
   */
  addCustomAction(actionData) {
    const action = {
      id: `custom-${Date.now()}`,
      name: actionData.name,
      description: actionData.description || '',
      icon: actionData.icon || '⚡',
      category: 'Custom',
      keywords: actionData.keywords || [],
      action: actionData.action // Function or action descriptor
    };

    this.customActions.push(action);
    this.saveCustomActions();
    return action;
  }

  /**
   * Remove custom action
   * @param {string} actionId - Action ID
   */
  removeCustomAction(actionId) {
    this.customActions = this.customActions.filter(a => a.id !== actionId);
    this.saveCustomActions();
  }
}

// Create and export singleton
export const quickActions = new QuickActionsManager();
