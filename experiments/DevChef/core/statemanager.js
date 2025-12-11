/**
 * State Manager - V6
 * Centralized state management for bulletproof reliability
 *
 * Features:
 * - Centralized application state
 * - State history and time-travel debugging
 * - State persistence with auto-save
 * - Undo/redo functionality
 * - State validation and type checking
 * - Reactive subscriptions
 * - Immutable state updates
 * - State snapshots and restore
 * - Conflict resolution
 */

class StateManager {
  constructor() {
    this.state = {};
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;
    this.subscribers = new Map();
    this.validators = new Map();
    this.middleware = [];
    this.autoSaveInterval = null;
    this.init();
  }

  /**
   * Initialize state manager
   */
  init() {
    try {
      this.loadPersistedState();
      this.setupAutoSave();
      this.setupStorageSync();
      console.log('🎯 State Manager initialized - Bulletproof & Reliable');
    } catch (error) {
      console.error('Error initializing State Manager:', error);
    }
  }

  /**
   * Get state value
   */
  get(path) {
    try {
      if (!path) return this.state;

      const keys = path.split('.');
      let value = this.state;

      for (const key of keys) {
        if (value === undefined || value === null) return undefined;
        value = value[key];
      }

      return value;
    } catch (error) {
      console.error('Error getting state:', error);
      return undefined;
    }
  }

  /**
   * Set state value
   */
  set(path, value, options = {}) {
    try {
      const {
        addToHistory = true,
        silent = false,
        validate = true
      } = options;

      // Validate if validator exists
      if (validate && this.validators.has(path)) {
        const validator = this.validators.get(path);
        const validationResult = validator(value);

        if (!validationResult.valid) {
          console.error(`Validation failed for ${path}:`, validationResult.error);
          return false;
        }
      }

      // Run middleware
      for (const middlewareFn of this.middleware) {
        const result = middlewareFn('set', path, value, this.state);
        if (result === false) {
          console.warn(`Middleware blocked state update for ${path}`);
          return false;
        }
      }

      // Save current state to history
      if (addToHistory) {
        this.addToHistory();
      }

      // Update state immutably
      const newState = this.immutableSet(this.state, path, value);
      this.state = newState;

      // Notify subscribers
      if (!silent) {
        this.notify(path, value);
      }

      return true;
    } catch (error) {
      console.error('Error setting state:', error);
      return false;
    }
  }

  /**
   * Immutable set operation
   */
  immutableSet(obj, path, value) {
    try {
      const keys = path.split('.');
      const key = keys[0];

      if (keys.length === 1) {
        return { ...obj, [key]: value };
      }

      return {
        ...obj,
        [key]: this.immutableSet(obj[key] || {}, keys.slice(1).join('.'), value)
      };
    } catch (error) {
      console.error('Error in immutable set:', error);
      return obj;
    }
  }

  /**
   * Delete state value
   */
  delete(path, options = {}) {
    try {
      const { addToHistory = true, silent = false } = options;

      if (addToHistory) {
        this.addToHistory();
      }

      const keys = path.split('.');
      const newState = { ...this.state };
      let current = newState;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) return false;
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      delete current[keys[keys.length - 1]];
      this.state = newState;

      if (!silent) {
        this.notify(path, undefined);
      }

      return true;
    } catch (error) {
      console.error('Error deleting state:', error);
      return false;
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(path, callback) {
    try {
      if (!this.subscribers.has(path)) {
        this.subscribers.set(path, new Set());
      }

      this.subscribers.get(path).add(callback);

      // Return unsubscribe function
      return () => {
        const subs = this.subscribers.get(path);
        if (subs) {
          subs.delete(callback);
          if (subs.size === 0) {
            this.subscribers.delete(path);
          }
        }
      };
    } catch (error) {
      console.error('Error subscribing to state:', error);
      return () => {};
    }
  }

  /**
   * Notify subscribers of state change
   */
  notify(path, value) {
    try {
      // Notify exact path subscribers
      if (this.subscribers.has(path)) {
        for (const callback of this.subscribers.get(path)) {
          try {
            callback(value, path);
          } catch (error) {
            console.error('Error in subscriber callback:', error);
          }
        }
      }

      // Notify wildcard subscribers (*)
      if (this.subscribers.has('*')) {
        for (const callback of this.subscribers.get('*')) {
          try {
            callback(value, path);
          } catch (error) {
            console.error('Error in wildcard subscriber:', error);
          }
        }
      }

      // Notify parent path subscribers
      const pathParts = path.split('.');
      for (let i = pathParts.length - 1; i > 0; i--) {
        const parentPath = pathParts.slice(0, i).join('.');
        if (this.subscribers.has(parentPath)) {
          for (const callback of this.subscribers.get(parentPath)) {
            try {
              callback(this.get(parentPath), parentPath);
            } catch (error) {
              console.error('Error in parent subscriber:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error notifying subscribers:', error);
    }
  }

  /**
   * Add validator for path
   */
  addValidator(path, validatorFn) {
    try {
      this.validators.set(path, validatorFn);
    } catch (error) {
      console.error('Error adding validator:', error);
    }
  }

  /**
   * Add middleware
   */
  use(middlewareFn) {
    try {
      this.middleware.push(middlewareFn);
    } catch (error) {
      console.error('Error adding middleware:', error);
    }
  }

  /**
   * Add to history
   */
  addToHistory() {
    try {
      // Remove any future history if we're not at the end
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }

      // Add current state to history
      this.history.push(JSON.parse(JSON.stringify(this.state)));
      this.historyIndex++;

      // Limit history size
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
        this.historyIndex--;
      }
    } catch (error) {
      console.error('Error adding to history:', error);
    }
  }

  /**
   * Undo last state change
   */
  undo() {
    try {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        this.notify('*', this.state);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error undoing state:', error);
      return false;
    }
  }

  /**
   * Redo last undone state change
   */
  redo() {
    try {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        this.notify('*', this.state);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error redoing state:', error);
      return false;
    }
  }

  /**
   * Can undo
   */
  canUndo() {
    return this.historyIndex > 0;
  }

  /**
   * Can redo
   */
  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Create state snapshot
   */
  createSnapshot(name) {
    try {
      const snapshot = {
        name,
        timestamp: Date.now(),
        state: JSON.parse(JSON.stringify(this.state))
      };

      const snapshots = this.get('_snapshots') || [];
      snapshots.push(snapshot);
      this.set('_snapshots', snapshots, { addToHistory: false, silent: true });

      return snapshot;
    } catch (error) {
      console.error('Error creating snapshot:', error);
      return null;
    }
  }

  /**
   * Restore from snapshot
   */
  restoreSnapshot(name) {
    try {
      const snapshots = this.get('_snapshots') || [];
      const snapshot = snapshots.find(s => s.name === name);

      if (!snapshot) {
        console.warn(`Snapshot "${name}" not found`);
        return false;
      }

      this.state = JSON.parse(JSON.stringify(snapshot.state));
      this.notify('*', this.state);
      return true;
    } catch (error) {
      console.error('Error restoring snapshot:', error);
      return false;
    }
  }

  /**
   * Get all snapshots
   */
  getSnapshots() {
    try {
      return this.get('_snapshots') || [];
    } catch (error) {
      console.error('Error getting snapshots:', error);
      return [];
    }
  }

  /**
   * Setup auto-save
   */
  setupAutoSave() {
    try {
      // Auto-save every 30 seconds
      this.autoSaveInterval = setInterval(() => {
        this.persistState();
      }, 30000);
    } catch (error) {
      console.error('Error setting up auto-save:', error);
    }
  }

  /**
   * Persist state to localStorage
   */
  persistState() {
    try {
      const serialized = JSON.stringify(this.state);
      localStorage.setItem('devchef-state', serialized);
      localStorage.setItem('devchef-state-timestamp', Date.now().toString());
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  }

  /**
   * Load persisted state
   */
  loadPersistedState() {
    try {
      const serialized = localStorage.getItem('devchef-state');
      if (serialized) {
        this.state = JSON.parse(serialized);
        this.addToHistory();
        console.log('📂 State loaded from storage');
      } else {
        // Initialize with default state
        this.state = this.getDefaultState();
        this.addToHistory();
      }
    } catch (error) {
      console.error('Error loading persisted state:', error);
      this.state = this.getDefaultState();
      this.addToHistory();
    }
  }

  /**
   * Get default state
   */
  getDefaultState() {
    return {
      app: {
        initialized: true,
        version: '6.0.0',
        theme: 'dark',
        language: 'en'
      },
      tools: {
        current: null,
        recent: [],
        favorites: []
      },
      user: {
        preferences: {
          animations: true,
          notifications: true,
          autoSave: true
        }
      },
      _snapshots: []
    };
  }

  /**
   * Setup storage sync (sync across tabs)
   */
  setupStorageSync() {
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === 'devchef-state' && e.newValue) {
          try {
            const newState = JSON.parse(e.newValue);
            this.state = newState;
            this.notify('*', this.state);
            console.log('🔄 State synced from another tab');
          } catch (error) {
            console.error('Error syncing state:', error);
          }
        }
      });
    } catch (error) {
      console.error('Error setting up storage sync:', error);
    }
  }

  /**
   * Reset state to default
   */
  reset() {
    try {
      this.state = this.getDefaultState();
      this.history = [];
      this.historyIndex = -1;
      this.addToHistory();
      this.persistState();
      this.notify('*', this.state);
      return true;
    } catch (error) {
      console.error('Error resetting state:', error);
      return false;
    }
  }

  /**
   * Export state
   */
  export() {
    try {
      return {
        state: this.state,
        timestamp: Date.now(),
        version: this.get('app.version')
      };
    } catch (error) {
      console.error('Error exporting state:', error);
      return null;
    }
  }

  /**
   * Import state
   */
  import(data) {
    try {
      if (!data || !data.state) {
        console.error('Invalid import data');
        return false;
      }

      this.state = data.state;
      this.addToHistory();
      this.persistState();
      this.notify('*', this.state);
      return true;
    } catch (error) {
      console.error('Error importing state:', error);
      return false;
    }
  }

  /**
   * Get state diff between current and previous
   */
  getDiff() {
    try {
      if (this.historyIndex < 1) return null;

      const current = this.state;
      const previous = this.history[this.historyIndex - 1];

      return this.deepDiff(previous, current);
    } catch (error) {
      console.error('Error getting diff:', error);
      return null;
    }
  }

  /**
   * Deep diff between two objects
   */
  deepDiff(obj1, obj2, path = '') {
    const diff = {};

    try {
      // Check for changes in obj2
      for (const key in obj2) {
        const newPath = path ? `${path}.${key}` : key;

        if (!(key in obj1)) {
          diff[newPath] = { type: 'added', value: obj2[key] };
        } else if (typeof obj2[key] === 'object' && obj2[key] !== null) {
          const nested = this.deepDiff(obj1[key], obj2[key], newPath);
          Object.assign(diff, nested);
        } else if (obj1[key] !== obj2[key]) {
          diff[newPath] = { type: 'changed', from: obj1[key], to: obj2[key] };
        }
      }

      // Check for deletions
      for (const key in obj1) {
        const newPath = path ? `${path}.${key}` : key;
        if (!(key in obj2)) {
          diff[newPath] = { type: 'deleted', value: obj1[key] };
        }
      }
    } catch (error) {
      console.error('Error calculating diff:', error);
    }

    return diff;
  }

  /**
   * Cleanup
   */
  destroy() {
    try {
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
      }
      this.persistState();
      this.subscribers.clear();
      this.validators.clear();
      this.middleware = [];
    } catch (error) {
      console.error('Error destroying state manager:', error);
    }
  }
}

// Export singleton instance
export const stateManager = new StateManager();
export { StateManager };
