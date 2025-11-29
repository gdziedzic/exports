/**
 * DevChef Ultimate - Universal Favorites System
 * Unified favorites across tools, snippets, actions, workspaces, and more
 *
 * Features:
 * - Unified favorites management
 * - Cross-sync between devices
 * - Smart categorization
 * - Quick access shortcuts
 * - Export/import/backup
 * - Usage tracking
 */

import { storage } from './storage.js';
import { snippetManager } from './snippets.js';

class UniversalFavorites {
  constructor() {
    this.favorites = {
      tools: new Set(),
      snippets: new Set(),
      actions: new Set(),
      workspaces: new Set(),
      pipelines: new Set(),
      custom: new Map()
    };
    this.recentlyUsed = [];
    this.maxRecent = 20;
    this.shortcuts = new Map();
    this.init();
  }

  /**
   * Initialize Universal Favorites
   */
  init() {
    this.loadFavorites();
    this.setupKeyboardShortcuts();
    console.log('⭐ Universal Favorites initialized - Unified access to everything you love');
  }

  /**
   * Load favorites from storage
   */
  loadFavorites() {
    const saved = storage.get('devchef-universal-favorites');
    if (saved) {
      this.favorites.tools = new Set(saved.tools || []);
      this.favorites.snippets = new Set(saved.snippets || []);
      this.favorites.actions = new Set(saved.actions || []);
      this.favorites.workspaces = new Set(saved.workspaces || []);
      this.favorites.pipelines = new Set(saved.pipelines || []);
      this.favorites.custom = new Map(saved.custom || []);
    }

    const recentSaved = storage.get('devchef-universal-recent');
    if (recentSaved && Array.isArray(recentSaved)) {
      this.recentlyUsed = recentSaved;
    }
  }

  /**
   * Save favorites to storage
   */
  saveFavorites() {
    const data = {
      tools: Array.from(this.favorites.tools),
      snippets: Array.from(this.favorites.snippets),
      actions: Array.from(this.favorites.actions),
      workspaces: Array.from(this.favorites.workspaces),
      pipelines: Array.from(this.favorites.pipelines),
      custom: Array.from(this.favorites.custom)
    };
    storage.set('devchef-universal-favorites', data);
    storage.set('devchef-universal-recent', this.recentlyUsed);
  }

  /**
   * Add to favorites
   * @param {string} type - Type of item (tool, snippet, action, etc.)
   * @param {string} id - Item ID
   * @param {Object} metadata - Additional metadata
   */
  addFavorite(type, id, metadata = {}) {
    try {
      if (!this.favorites[type]) {
        this.favorites.custom.set(type, new Set());
      }

      const favSet = this.favorites[type] || this.favorites.custom.get(type);
      favSet.add(id);

      // Store metadata if provided
      if (Object.keys(metadata).length > 0) {
        const metaKey = `${type}-${id}`;
        storage.set(`devchef-fav-meta-${metaKey}`, metadata);
      }

      this.saveFavorites();
      return true;
    } catch (error) {
      console.error('Error adding favorite:', error);
      return false;
    }
  }

  /**
   * Remove from favorites
   * @param {string} type - Type of item
   * @param {string} id - Item ID
   */
  removeFavorite(type, id) {
    try {
      const favSet = this.favorites[type] || this.favorites.custom.get(type);
      if (favSet) {
        favSet.delete(id);
        this.saveFavorites();
      }
      return true;
    } catch (error) {
      console.error('Error removing favorite:', error);
      return false;
    }
  }

  /**
   * Toggle favorite
   * @param {string} type - Type of item
   * @param {string} id - Item ID
   * @param {Object} metadata - Additional metadata
   * @returns {boolean} New favorite status
   */
  toggleFavorite(type, id, metadata = {}) {
    if (this.isFavorite(type, id)) {
      this.removeFavorite(type, id);
      return false;
    } else {
      this.addFavorite(type, id, metadata);
      return true;
    }
  }

  /**
   * Check if item is favorite
   * @param {string} type - Type of item
   * @param {string} id - Item ID
   * @returns {boolean} Is favorite
   */
  isFavorite(type, id) {
    const favSet = this.favorites[type] || this.favorites.custom.get(type);
    return favSet ? favSet.has(id) : false;
  }

  /**
   * Get all favorites of a type
   * @param {string} type - Type of item
   * @returns {Array} Favorite IDs
   */
  getFavorites(type) {
    const favSet = this.favorites[type] || this.favorites.custom.get(type);
    return favSet ? Array.from(favSet) : [];
  }

  /**
   * Get all favorites (all types)
   * @returns {Object} All favorites grouped by type
   */
  getAllFavorites() {
    const result = {};

    Object.keys(this.favorites).forEach(type => {
      if (type !== 'custom') {
        result[type] = Array.from(this.favorites[type]);
      }
    });

    this.favorites.custom.forEach((favSet, type) => {
      result[type] = Array.from(favSet);
    });

    return result;
  }

  /**
   * Add to recently used
   * @param {string} type - Type of item
   * @param {string} id - Item ID
   * @param {Object} metadata - Additional metadata
   */
  addToRecent(type, id, metadata = {}) {
    const item = {
      type,
      id,
      timestamp: Date.now(),
      ...metadata
    };

    // Remove if already exists
    this.recentlyUsed = this.recentlyUsed.filter(r => !(r.type === type && r.id === id));

    // Add to front
    this.recentlyUsed.unshift(item);

    // Limit size
    if (this.recentlyUsed.length > this.maxRecent) {
      this.recentlyUsed = this.recentlyUsed.slice(0, this.maxRecent);
    }

    this.saveFavorites();
  }

  /**
   * Get recently used items
   * @param {number} count - Number of items
   * @param {string} type - Filter by type (optional)
   * @returns {Array} Recent items
   */
  getRecent(count = 10, type = null) {
    let items = this.recentlyUsed;

    if (type) {
      items = items.filter(item => item.type === type);
    }

    return items.slice(0, count);
  }

  /**
   * Clear recently used
   * @param {string} type - Clear specific type only (optional)
   */
  clearRecent(type = null) {
    if (type) {
      this.recentlyUsed = this.recentlyUsed.filter(item => item.type !== type);
    } else {
      this.recentlyUsed = [];
    }
    this.saveFavorites();
  }

  /**
   * Assign keyboard shortcut to favorite
   * @param {string} type - Type of item
   * @param {string} id - Item ID
   * @param {string} shortcut - Keyboard shortcut (e.g., "Ctrl+Shift+1")
   */
  assignShortcut(type, id, shortcut) {
    this.shortcuts.set(shortcut, { type, id });
    storage.set('devchef-favorite-shortcuts', Array.from(this.shortcuts));
  }

  /**
   * Remove shortcut
   * @param {string} shortcut - Keyboard shortcut
   */
  removeShortcut(shortcut) {
    this.shortcuts.delete(shortcut);
    storage.set('devchef-favorite-shortcuts', Array.from(this.shortcuts));
  }

  /**
   * Get item by shortcut
   * @param {string} shortcut - Keyboard shortcut
   * @returns {Object} Item info or null
   */
  getByShortcut(shortcut) {
    return this.shortcuts.get(shortcut) || null;
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    // Load saved shortcuts
    const saved = storage.get('devchef-favorite-shortcuts');
    if (saved) {
      this.shortcuts = new Map(saved);
    }

    // Ctrl+Alt+F - Show favorites panel
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'f') {
        e.preventDefault();
        this.showFavoritesPanel();
      }

      // Ctrl+Shift+R - Show recently used
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        this.showRecentPanel();
      }

      // Check custom shortcuts
      const shortcutKey = `${e.ctrlKey || e.metaKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.altKey ? 'Alt+' : ''}${e.key}`;
      const item = this.getByShortcut(shortcutKey);
      if (item) {
        e.preventDefault();
        this.executeItem(item.type, item.id);
      }
    });
  }

  /**
   * Execute favorite item
   * @param {string} type - Type of item
   * @param {string} id - Item ID
   */
  executeItem(type, id) {
    try {
      this.addToRecent(type, id);

      switch (type) {
        case 'tool':
          if (window.DevChef && window.DevChef.openTool) {
            window.DevChef.openTool(id);
          }
          break;

        case 'snippet':
          if (window.snippetsPlus) {
            window.snippetsPlus.insertSnippet(id);
          } else if (window.snippetManager) {
            window.snippetManager.copyToClipboard(id);
          }
          break;

        case 'action':
          if (window.quickActions) {
            window.quickActions.executeAction(id);
          }
          break;

        case 'workspace':
          if (window.workspaceManager) {
            window.workspaceManager.loadWorkspace(id);
          }
          break;

        case 'pipeline':
          if (window.pipelineManager) {
            window.pipelineManager.executePipeline(id);
          }
          break;

        default:
          console.log('Unknown favorite type:', type);
      }
    } catch (error) {
      console.error('Error executing favorite item:', error);
    }
  }

  /**
   * Show favorites panel
   */
  showFavoritesPanel() {
    const allFavorites = this.getAllFavorites();
    const hasAnyFavorites = Object.values(allFavorites).some(arr => arr.length > 0);

    const dialog = document.createElement('div');
    dialog.className = 'universal-favorites-panel';
    dialog.innerHTML = `
      <div class="panel-overlay"></div>
      <div class="panel-content">
        <div class="panel-header">
          <h2>⭐ Favorites</h2>
          <button class="panel-close" id="favorites-close">✕</button>
        </div>
        <div class="panel-body">
          ${hasAnyFavorites ? this.renderFavoritesContent(allFavorites) : `
            <div class="empty-state">
              <p>No favorites yet</p>
              <p class="hint">Press Ctrl+D to add current tool to favorites</p>
            </div>
          `}
        </div>
        <div class="panel-footer">
          <button class="btn-secondary" onclick="window.universalFavorites.exportFavorites()">Export</button>
          <button class="btn-secondary" onclick="window.universalFavorites.importFavorites()">Import</button>
          <button class="btn-secondary" onclick="window.universalFavorites.clearAllFavorites()">Clear All</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    setTimeout(() => dialog.classList.add('show'), 10);

    const cleanup = () => {
      dialog.classList.remove('show');
      setTimeout(() => dialog.remove(), 200);
    };

    dialog.querySelector('#favorites-close').addEventListener('click', cleanup);
    dialog.querySelector('.panel-overlay').addEventListener('click', cleanup);

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * Render favorites content
   */
  renderFavoritesContent(allFavorites) {
    let html = '';

    Object.entries(allFavorites).forEach(([type, ids]) => {
      if (ids.length > 0) {
        html += `
          <div class="favorites-section">
            <h3>${this.formatTypeName(type)} (${ids.length})</h3>
            <div class="favorites-list">
              ${ids.map(id => this.renderFavoriteItem(type, id)).join('')}
            </div>
          </div>
        `;
      }
    });

    return html;
  }

  /**
   * Render favorite item
   */
  renderFavoriteItem(type, id) {
    const name = this.getItemName(type, id);
    return `
      <div class="favorite-item" onclick="window.universalFavorites.executeItem('${type}', '${id}')">
        <span class="favorite-icon">${this.getItemIcon(type)}</span>
        <span class="favorite-name">${name}</span>
        <button class="favorite-remove" onclick="event.stopPropagation(); window.universalFavorites.removeFavorite('${type}', '${id}'); window.universalFavorites.showFavoritesPanel();">✕</button>
      </div>
    `;
  }

  /**
   * Get item name
   */
  getItemName(type, id) {
    try {
      switch (type) {
        case 'tools':
          const tool = window.ToolRegistry?.get(id);
          return tool ? tool.manifest.name : id;
        case 'snippets':
          const snippet = window.snippetManager?.getSnippet(id);
          return snippet ? snippet.title : id;
        default:
          return id;
      }
    } catch (error) {
      return id;
    }
  }

  /**
   * Get item icon
   */
  getItemIcon(type) {
    const icons = {
      tools: '🔧',
      snippets: '📝',
      actions: '⚡',
      workspaces: '📁',
      pipelines: '🔄'
    };
    return icons[type] || '⭐';
  }

  /**
   * Format type name
   */
  formatTypeName(type) {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  /**
   * Show recently used panel
   */
  showRecentPanel() {
    const recent = this.getRecent(15);

    const dialog = document.createElement('div');
    dialog.className = 'universal-favorites-panel';
    dialog.innerHTML = `
      <div class="panel-overlay"></div>
      <div class="panel-content">
        <div class="panel-header">
          <h2>🕐 Recently Used</h2>
          <button class="panel-close" id="recent-close">✕</button>
        </div>
        <div class="panel-body">
          ${recent.length > 0 ? `
            <div class="recent-list">
              ${recent.map(item => `
                <div class="recent-item" onclick="window.universalFavorites.executeItem('${item.type}', '${item.id}')">
                  <span class="recent-icon">${this.getItemIcon(item.type)}</span>
                  <div class="recent-info">
                    <div class="recent-name">${this.getItemName(item.type, item.id)}</div>
                    <div class="recent-time">${this.formatTimestamp(item.timestamp)}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="empty-state">
              <p>No recent items</p>
            </div>
          `}
        </div>
        <div class="panel-footer">
          <button class="btn-secondary" onclick="window.universalFavorites.clearRecent()">Clear History</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
    setTimeout(() => dialog.classList.add('show'), 10);

    const cleanup = () => {
      dialog.classList.remove('show');
      setTimeout(() => dialog.remove(), 200);
    };

    dialog.querySelector('#recent-close').addEventListener('click', cleanup);
    dialog.querySelector('.panel-overlay').addEventListener('click', cleanup);

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * Format timestamp
   */
  formatTimestamp(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  /**
   * Export favorites
   */
  exportFavorites() {
    const data = {
      version: '6.5-ultimate',
      type: 'devchef-favorites',
      exportedAt: new Date().toISOString(),
      favorites: this.getAllFavorites(),
      recent: this.recentlyUsed,
      shortcuts: Array.from(this.shortcuts)
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `devchef-favorites-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Import favorites
   */
  async importFavorites() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.type !== 'devchef-favorites') {
          alert('Invalid favorites file');
          return;
        }

        // Merge favorites
        Object.entries(data.favorites).forEach(([type, ids]) => {
          ids.forEach(id => this.addFavorite(type, id));
        });

        this.saveFavorites();
        alert('Favorites imported successfully!');
        this.showFavoritesPanel();
      } catch (error) {
        console.error('Error importing favorites:', error);
        alert('Failed to import favorites');
      }
    };

    input.click();
  }

  /**
   * Clear all favorites
   */
  clearAllFavorites() {
    if (confirm('Clear all favorites? This cannot be undone.')) {
      Object.keys(this.favorites).forEach(type => {
        if (type === 'custom') {
          this.favorites.custom.clear();
        } else {
          this.favorites[type].clear();
        }
      });
      this.saveFavorites();
      this.showFavoritesPanel();
    }
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const stats = {
      totalFavorites: 0,
      byType: {},
      recentCount: this.recentlyUsed.length,
      shortcutsCount: this.shortcuts.size
    };

    Object.entries(this.getAllFavorites()).forEach(([type, ids]) => {
      stats.byType[type] = ids.length;
      stats.totalFavorites += ids.length;
    });

    return stats;
  }
}

// Create and export singleton
export const universalFavorites = new UniversalFavorites();
window.universalFavorites = universalFavorites;
