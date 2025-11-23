/**
 * DevChef V2.5 - Workspace Manager
 * Manage multiple tool layouts, split panels, and workspace configurations
 */

import { storage } from './storage.js';
import { notifications } from './notifications.js';

class WorkspaceManager {
  constructor() {
    this.workspaces = [];
    this.currentWorkspace = null;
    this.panels = [];
    this.maxWorkspaces = 20;
    this.loadWorkspaces();
  }

  /**
   * Load workspaces from storage
   */
  loadWorkspaces() {
    const saved = storage.get('devchef-v2.5-workspaces');
    if (saved && Array.isArray(saved)) {
      this.workspaces = saved;
    } else {
      // Create default workspace
      this.createWorkspace('Default', {
        layout: 'single',
        panels: [{ toolId: null, size: 100 }]
      });
    }

    const currentId = storage.get('devchef-v2.5-current-workspace');
    if (currentId) {
      this.currentWorkspace = this.workspaces.find(w => w.id === currentId);
    }

    if (!this.currentWorkspace && this.workspaces.length > 0) {
      this.currentWorkspace = this.workspaces[0];
    }
  }

  /**
   * Save workspaces to storage
   */
  saveWorkspaces() {
    storage.set('devchef-v2.5-workspaces', this.workspaces);
    if (this.currentWorkspace) {
      storage.set('devchef-v2.5-current-workspace', this.currentWorkspace.id);
    }
  }

  /**
   * Create a new workspace
   * @param {string} name - Workspace name
   * @param {Object} config - Workspace configuration
   * @returns {Object} Created workspace
   */
  createWorkspace(name, config = {}) {
    const workspace = {
      id: `workspace-${Date.now()}-${Math.random()}`,
      name,
      layout: config.layout || 'single', // single, split-h, split-v, grid
      panels: config.panels || [{ toolId: null, size: 100 }],
      sidebarWidth: config.sidebarWidth || 280,
      theme: config.theme || null, // null = use global
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastUsed: null
    };

    this.workspaces.unshift(workspace);

    if (this.workspaces.length > this.maxWorkspaces) {
      this.workspaces = this.workspaces.slice(0, this.maxWorkspaces);
    }

    this.saveWorkspaces();
    return workspace;
  }

  /**
   * Switch to workspace
   * @param {string} workspaceId - Workspace ID
   * @returns {Object|null} Workspace or null
   */
  switchWorkspace(workspaceId) {
    const workspace = this.workspaces.find(w => w.id === workspaceId);
    if (!workspace) return null;

    workspace.lastUsed = Date.now();
    this.currentWorkspace = workspace;
    this.saveWorkspaces();

    return workspace;
  }

  /**
   * Update workspace
   * @param {string} workspaceId - Workspace ID
   * @param {Object} updates - Updates to apply
   */
  updateWorkspace(workspaceId, updates) {
    const workspace = this.workspaces.find(w => w.id === workspaceId);
    if (!workspace) return false;

    Object.assign(workspace, updates, { updatedAt: Date.now() });
    this.saveWorkspaces();
    return true;
  }

  /**
   * Delete workspace
   * @param {string} workspaceId - Workspace ID
   */
  deleteWorkspace(workspaceId) {
    // Don't delete if it's the only workspace
    if (this.workspaces.length <= 1) {
      return false;
    }

    this.workspaces = this.workspaces.filter(w => w.id !== workspaceId);

    // Switch to another workspace if current was deleted
    if (this.currentWorkspace && this.currentWorkspace.id === workspaceId) {
      this.currentWorkspace = this.workspaces[0];
    }

    this.saveWorkspaces();
    return true;
  }

  /**
   * Get all workspaces
   * @returns {Array} All workspaces
   */
  getAllWorkspaces() {
    return this.workspaces;
  }

  /**
   * Get current workspace
   * @returns {Object|null} Current workspace
   */
  getCurrentWorkspace() {
    return this.currentWorkspace;
  }

  /**
   * Update current workspace panels
   * @param {Array} panels - Panel configuration
   */
  updatePanels(panels) {
    if (!this.currentWorkspace) return false;

    this.currentWorkspace.panels = panels;
    this.currentWorkspace.updatedAt = Date.now();
    this.saveWorkspaces();
    return true;
  }

  /**
   * Set workspace layout
   * @param {string} layout - Layout type
   */
  setLayout(layout) {
    if (!this.currentWorkspace) return false;

    this.currentWorkspace.layout = layout;

    // Adjust panels based on layout
    switch (layout) {
      case 'single':
        this.currentWorkspace.panels = [{ toolId: null, size: 100 }];
        break;
      case 'split-h':
        this.currentWorkspace.panels = [
          { toolId: null, size: 50 },
          { toolId: null, size: 50 }
        ];
        break;
      case 'split-v':
        this.currentWorkspace.panels = [
          { toolId: null, size: 50 },
          { toolId: null, size: 50 }
        ];
        break;
      case 'grid':
        this.currentWorkspace.panels = [
          { toolId: null, size: 25 },
          { toolId: null, size: 25 },
          { toolId: null, size: 25 },
          { toolId: null, size: 25 }
        ];
        break;
    }

    this.saveWorkspaces();
    return true;
  }

  /**
   * Set tool in panel
   * @param {number} panelIndex - Panel index
   * @param {string} toolId - Tool ID
   */
  setToolInPanel(panelIndex, toolId) {
    if (!this.currentWorkspace) return false;
    if (panelIndex >= this.currentWorkspace.panels.length) return false;

    this.currentWorkspace.panels[panelIndex].toolId = toolId;
    this.currentWorkspace.updatedAt = Date.now();
    this.saveWorkspaces();
    return true;
  }

  /**
   * Export workspace
   * @param {string} workspaceId - Workspace ID
   * @returns {Object} Exported workspace
   */
  exportWorkspace(workspaceId) {
    const workspace = this.workspaces.find(w => w.id === workspaceId);
    if (!workspace) return null;

    return {
      version: '2.5',
      type: 'devchef-workspace',
      data: workspace
    };
  }

  /**
   * Import workspace
   * @param {Object} data - Workspace data
   * @returns {boolean} Success status
   */
  importWorkspace(data) {
    if (!data || data.type !== 'devchef-workspace') {
      return false;
    }

    const workspace = {
      ...data.data,
      id: `workspace-${Date.now()}-${Math.random()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastUsed: null
    };

    this.workspaces.unshift(workspace);
    this.saveWorkspaces();
    return true;
  }

  /**
   * Get recent workspaces
   * @param {number} count - Number of workspaces
   * @returns {Array} Recent workspaces
   */
  getRecentWorkspaces(count = 5) {
    return [...this.workspaces]
      .filter(w => w.lastUsed)
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, count);
  }

  /**
   * Duplicate workspace
   * @param {string} workspaceId - Workspace ID to duplicate
   * @returns {Object} Duplicated workspace
   */
  duplicateWorkspace(workspaceId) {
    const workspace = this.workspaces.find(w => w.id === workspaceId);
    if (!workspace) return null;

    const duplicate = {
      ...workspace,
      id: `workspace-${Date.now()}-${Math.random()}`,
      name: `${workspace.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastUsed: null
    };

    this.workspaces.unshift(duplicate);
    this.saveWorkspaces();
    return duplicate;
  }

  /**
   * Get panel configuration
   * @returns {Object} Panel configuration for CSS
   */
  getPanelStyles() {
    if (!this.currentWorkspace) return null;

    const layout = this.currentWorkspace.layout;
    const panels = this.currentWorkspace.panels;

    switch (layout) {
      case 'split-h':
        return {
          display: 'grid',
          gridTemplateColumns: panels.map(p => `${p.size}fr`).join(' '),
          gridTemplateRows: '1fr'
        };
      case 'split-v':
        return {
          display: 'grid',
          gridTemplateColumns: '1fr',
          gridTemplateRows: panels.map(p => `${p.size}fr`).join(' ')
        };
      case 'grid':
        return {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr'
        };
      default: // single
        return {
          display: 'block'
        };
    }
  }
}

// Create and export singleton
export const workspaceManager = new WorkspaceManager();
