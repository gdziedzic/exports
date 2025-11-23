/**
 * DevChef V2 Storage System
 * Manages localStorage for favorites, history, settings, and tool states
 */

const STORAGE_KEYS = {
  FAVORITES: 'devchef-v2-favorites',
  HISTORY: 'devchef-v2-history',
  TOOL_STATES: 'devchef-v2-tool-states',
  SETTINGS: 'devchef-v2-settings',
  PRESETS: 'devchef-v2-presets',
  THEME: 'devchef-theme',
  LAYOUT: 'devchef-v2-layout'
};

const DEFAULT_SETTINGS = {
  maxHistoryItems: 50,
  autoSaveInterval: 2000,
  showWelcome: true,
  compactMode: false,
  sidebarWidth: 280,
  enableAnimations: true,
  defaultView: 'single', // 'single' or 'split'
  keyboardShortcuts: {
    commandPalette: 'ctrl+k',
    console: 'ctrl+`',
    search: 'ctrl+f',
    toggleFavorite: 'ctrl+d',
    recentTools: 'ctrl+e'
  }
};

class StorageManager {
  constructor() {
    this.cache = new Map();
    this.autoSaveEnabled = false;
    this.saveQueue = new Set();
    this.initializeStorage();
  }

  /**
   * Initialize storage with defaults if needed
   */
  initializeStorage() {
    if (!this.get(STORAGE_KEYS.SETTINGS)) {
      this.set(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    }
    if (!this.get(STORAGE_KEYS.FAVORITES)) {
      this.set(STORAGE_KEYS.FAVORITES, []);
    }
    if (!this.get(STORAGE_KEYS.HISTORY)) {
      this.set(STORAGE_KEYS.HISTORY, []);
    }
    if (!this.get(STORAGE_KEYS.TOOL_STATES)) {
      this.set(STORAGE_KEYS.TOOL_STATES, {});
    }
    if (!this.get(STORAGE_KEYS.PRESETS)) {
      this.set(STORAGE_KEYS.PRESETS, {});
    }
    if (!this.get(STORAGE_KEYS.LAYOUT)) {
      this.set(STORAGE_KEYS.LAYOUT, {
        sidebarWidth: 280,
        splitViewEnabled: false,
        splitViewRatio: 0.5
      });
    }
  }

  /**
   * Get value from storage
   * @param {string} key - Storage key
   * @returns {*} Parsed value or null
   */
  get(key) {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    try {
      const value = localStorage.getItem(key);
      if (value === null) return null;

      const parsed = JSON.parse(value);
      this.cache.set(key, parsed);
      return parsed;
    } catch (error) {
      console.error(`Error reading from storage: ${key}`, error);
      return null;
    }
  }

  /**
   * Set value in storage
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {boolean} Success status
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      this.cache.set(key, value);
      return true;
    } catch (error) {
      console.error(`Error writing to storage: ${key}`, error);
      return false;
    }
  }

  /**
   * Remove value from storage
   * @param {string} key - Storage key
   */
  remove(key) {
    localStorage.removeItem(key);
    this.cache.delete(key);
  }

  /**
   * Clear all DevChef storage
   */
  clear() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    this.cache.clear();
    this.initializeStorage();
  }

  /**
   * Get settings
   * @returns {Object} Settings object
   */
  getSettings() {
    return { ...DEFAULT_SETTINGS, ...this.get(STORAGE_KEYS.SETTINGS) };
  }

  /**
   * Update settings
   * @param {Object} updates - Settings to update
   */
  updateSettings(updates) {
    const current = this.getSettings();
    this.set(STORAGE_KEYS.SETTINGS, { ...current, ...updates });
  }

  /**
   * Get favorites list
   * @returns {Array} Array of tool IDs
   */
  getFavorites() {
    return this.get(STORAGE_KEYS.FAVORITES) || [];
  }

  /**
   * Add tool to favorites
   * @param {string} toolId - Tool ID
   */
  addFavorite(toolId) {
    const favorites = this.getFavorites();
    if (!favorites.includes(toolId)) {
      favorites.push(toolId);
      this.set(STORAGE_KEYS.FAVORITES, favorites);
    }
  }

  /**
   * Remove tool from favorites
   * @param {string} toolId - Tool ID
   */
  removeFavorite(toolId) {
    const favorites = this.getFavorites();
    const filtered = favorites.filter(id => id !== toolId);
    this.set(STORAGE_KEYS.FAVORITES, filtered);
  }

  /**
   * Toggle favorite status
   * @param {string} toolId - Tool ID
   * @returns {boolean} New favorite status
   */
  toggleFavorite(toolId) {
    const favorites = this.getFavorites();
    if (favorites.includes(toolId)) {
      this.removeFavorite(toolId);
      return false;
    } else {
      this.addFavorite(toolId);
      return true;
    }
  }

  /**
   * Check if tool is favorite
   * @param {string} toolId - Tool ID
   * @returns {boolean} Is favorite
   */
  isFavorite(toolId) {
    return this.getFavorites().includes(toolId);
  }

  /**
   * Get history
   * @returns {Array} Array of history entries
   */
  getHistory() {
    return this.get(STORAGE_KEYS.HISTORY) || [];
  }

  /**
   * Add tool to history
   * @param {string} toolId - Tool ID
   * @param {string} toolName - Tool name
   */
  addToHistory(toolId, toolName) {
    const history = this.getHistory();
    const settings = this.getSettings();

    // Remove existing entry if present
    const filtered = history.filter(entry => entry.toolId !== toolId);

    // Add to beginning
    filtered.unshift({
      toolId,
      toolName,
      timestamp: Date.now(),
      accessCount: (history.find(e => e.toolId === toolId)?.accessCount || 0) + 1
    });

    // Limit history size
    const limited = filtered.slice(0, settings.maxHistoryItems);
    this.set(STORAGE_KEYS.HISTORY, limited);
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.set(STORAGE_KEYS.HISTORY, []);
  }

  /**
   * Get recent tools (last N from history)
   * @param {number} count - Number of recent tools
   * @returns {Array} Recent tools
   */
  getRecentTools(count = 5) {
    return this.getHistory().slice(0, count);
  }

  /**
   * Get most used tools
   * @param {number} count - Number of tools
   * @returns {Array} Most used tools
   */
  getMostUsedTools(count = 5) {
    const history = this.getHistory();
    return [...history]
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, count);
  }

  /**
   * Save tool state
   * @param {string} toolId - Tool ID
   * @param {Object} state - Tool state
   */
  saveToolState(toolId, state) {
    const states = this.get(STORAGE_KEYS.TOOL_STATES) || {};
    states[toolId] = {
      ...state,
      savedAt: Date.now()
    };
    this.set(STORAGE_KEYS.TOOL_STATES, states);
  }

  /**
   * Get tool state
   * @param {string} toolId - Tool ID
   * @returns {Object|null} Tool state or null
   */
  getToolState(toolId) {
    const states = this.get(STORAGE_KEYS.TOOL_STATES) || {};
    return states[toolId] || null;
  }

  /**
   * Clear tool state
   * @param {string} toolId - Tool ID
   */
  clearToolState(toolId) {
    const states = this.get(STORAGE_KEYS.TOOL_STATES) || {};
    delete states[toolId];
    this.set(STORAGE_KEYS.TOOL_STATES, states);
  }

  /**
   * Get layout settings
   * @returns {Object} Layout settings
   */
  getLayout() {
    return this.get(STORAGE_KEYS.LAYOUT) || {
      sidebarWidth: 280,
      splitViewEnabled: false,
      splitViewRatio: 0.5
    };
  }

  /**
   * Update layout settings
   * @param {Object} updates - Layout updates
   */
  updateLayout(updates) {
    const current = this.getLayout();
    this.set(STORAGE_KEYS.LAYOUT, { ...current, ...updates });
  }

  /**
   * Save preset
   * @param {string} toolId - Tool ID
   * @param {string} presetName - Preset name
   * @param {Object} data - Preset data
   */
  savePreset(toolId, presetName, data) {
    const presets = this.get(STORAGE_KEYS.PRESETS) || {};
    if (!presets[toolId]) {
      presets[toolId] = {};
    }
    presets[toolId][presetName] = {
      ...data,
      createdAt: Date.now()
    };
    this.set(STORAGE_KEYS.PRESETS, presets);
  }

  /**
   * Get presets for tool
   * @param {string} toolId - Tool ID
   * @returns {Object} Presets object
   */
  getPresets(toolId) {
    const presets = this.get(STORAGE_KEYS.PRESETS) || {};
    return presets[toolId] || {};
  }

  /**
   * Delete preset
   * @param {string} toolId - Tool ID
   * @param {string} presetName - Preset name
   */
  deletePreset(toolId, presetName) {
    const presets = this.get(STORAGE_KEYS.PRESETS) || {};
    if (presets[toolId]) {
      delete presets[toolId][presetName];
      this.set(STORAGE_KEYS.PRESETS, presets);
    }
  }

  /**
   * Export all data
   * @returns {Object} All storage data
   */
  exportData() {
    const data = {};
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      data[name] = this.get(key);
    });
    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      data
    };
  }

  /**
   * Import data
   * @param {Object} importData - Data to import
   * @returns {boolean} Success status
   */
  importData(importData) {
    try {
      if (!importData.version || !importData.data) {
        throw new Error('Invalid import format');
      }

      Object.entries(importData.data).forEach(([name, value]) => {
        const key = STORAGE_KEYS[name];
        if (key && value !== null) {
          this.set(key, value);
        }
      });

      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  /**
   * Get storage usage statistics
   * @returns {Object} Storage statistics
   */
  getStorageStats() {
    let totalSize = 0;
    const stats = {};

    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      const value = localStorage.getItem(key);
      const size = value ? new Blob([value]).size : 0;
      stats[name] = {
        size,
        sizeKB: (size / 1024).toFixed(2)
      };
      totalSize += size;
    });

    return {
      total: totalSize,
      totalKB: (totalSize / 1024).toFixed(2),
      totalMB: (totalSize / 1024 / 1024).toFixed(2),
      items: stats,
      favorites: this.getFavorites().length,
      historyItems: this.getHistory().length,
      toolStates: Object.keys(this.get(STORAGE_KEYS.TOOL_STATES) || {}).length
    };
  }
}

// Create and export singleton
export const storage = new StorageManager();
export { STORAGE_KEYS, DEFAULT_SETTINGS, StorageManager };
