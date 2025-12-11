/**
 * DevChef V2.6 - Backup & Auto-Save System
 * Automatic backup, version history, and data recovery
 */

class BackupManager {
  constructor() {
    this.autoSaveEnabled = true;
    this.autoSaveInterval = 60000; // 1 minute
    this.maxBackups = 10;
    this.backupTimer = null;
    this.lastBackupTime = null;
    this.backupCallbacks = [];
  }

  /**
   * Initialize auto-save system
   */
  init() {
    // Load last backup time
    try {
      const lastBackup = localStorage.getItem('devchef-last-backup');
      if (lastBackup) {
        this.lastBackupTime = parseInt(lastBackup, 10);
      }
    } catch (e) {
      console.warn('Could not load last backup time:', e);
    }

    // Start auto-save
    if (this.autoSaveEnabled) {
      this.startAutoSave();
    }

    // Backup on page unload
    window.addEventListener('beforeunload', () => {
      this.createBackup('unload');
    });

    console.log('✓ Backup system initialized');
  }

  /**
   * Start auto-save timer
   */
  startAutoSave() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    this.backupTimer = setInterval(() => {
      this.createBackup('auto');
    }, this.autoSaveInterval);

    console.log(`Auto-save enabled (every ${this.autoSaveInterval / 1000}s)`);
  }

  /**
   * Stop auto-save
   */
  stopAutoSave() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
  }

  /**
   * Create backup of all data
   */
  createBackup(type = 'manual') {
    try {
      const backup = {
        version: '2.6',
        type,
        timestamp: Date.now(),
        data: this.collectAllData()
      };

      // Save to backup history
      this.saveToHistory(backup);

      // Update last backup time
      this.lastBackupTime = backup.timestamp;
      localStorage.setItem('devchef-last-backup', backup.timestamp.toString());

      // Notify callbacks
      this.notifyCallbacks(backup);

      console.log(`✓ Backup created (${type}):`, new Date(backup.timestamp).toISOString());
      return backup;
    } catch (error) {
      console.error('Backup failed:', error);
      return null;
    }
  }

  /**
   * Collect all application data
   */
  collectAllData() {
    const data = {};

    // Collect from storage manager
    if (window.DevChef?.storage) {
      data.favorites = window.DevChef.storage.getFavorites();
      data.history = window.DevChef.storage.getHistory();
      data.settings = window.DevChef.storage.getSettings();
      data.layout = window.DevChef.storage.getLayout();
      data.presets = window.DevChef.storage.getPresets();
    }

    // Collect V2.5 data
    if (window.DevChef?.snippetManager) {
      data.snippets = window.DevChef.snippetManager.getSnippets();
    }

    if (window.DevChef?.pipelineManager) {
      data.pipelines = window.DevChef.pipelineManager.pipelines;
    }

    if (window.DevChef?.workspaceManager) {
      data.workspaces = window.DevChef.workspaceManager.workspaces;
    }

    if (window.DevChef?.analytics) {
      data.analytics = {
        sessions: window.DevChef.analytics.sessions,
        currentSession: window.DevChef.analytics.currentSession
      };
    }

    if (window.DevChef?.clipboardDetector) {
      data.clipboardHistory = window.DevChef.clipboardDetector.history;
    }

    if (window.DevChef?.quickActions) {
      data.quickActions = {
        custom: window.DevChef.quickActions.customActions,
        usage: window.DevChef.quickActions.actionUsage
      };
    }

    return data;
  }

  /**
   * Save backup to history
   */
  saveToHistory(backup) {
    try {
      const key = 'devchef-backup-history';
      const stored = localStorage.getItem(key);
      const history = stored ? JSON.parse(stored) : [];

      // Add new backup
      history.push(backup);

      // Keep only last N backups
      const trimmed = history.slice(-this.maxBackups);

      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Could not save to backup history:', error);

      // Try to save to IndexedDB as fallback
      this.saveToIndexedDB(backup);
    }
  }

  /**
   * Get backup history
   */
  getHistory() {
    try {
      const key = 'devchef-backup-history';
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Could not load backup history:', error);
      return [];
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backup) {
    try {
      const data = backup.data;

      // Restore to storage manager
      if (window.DevChef?.storage && data.favorites) {
        // Import all data
        await window.DevChef.storage.importData({
          favorites: data.favorites,
          history: data.history,
          settings: data.settings,
          layout: data.layout,
          presets: data.presets
        });
      }

      // Restore V2.5 data
      if (window.DevChef?.snippetManager && data.snippets) {
        data.snippets.forEach(snippet => {
          window.DevChef.snippetManager.createSnippet(snippet);
        });
      }

      if (window.DevChef?.pipelineManager && data.pipelines) {
        window.DevChef.pipelineManager.pipelines = data.pipelines;
        window.DevChef.pipelineManager.savePipelines();
      }

      if (window.DevChef?.workspaceManager && data.workspaces) {
        window.DevChef.workspaceManager.workspaces = data.workspaces;
        window.DevChef.workspaceManager.saveWorkspaces();
      }

      // Reload page to apply changes
      if (window.DevChef?.notifications) {
        window.DevChef.notifications.success('Backup restored! Page will reload.', {
          duration: 2000
        });
      }

      setTimeout(() => {
        window.location.reload();
      }, 2000);

      return true;
    } catch (error) {
      console.error('Restore failed:', error);
      if (window.DevChef?.notifications) {
        window.DevChef.notifications.error('Failed to restore backup: ' + error.message);
      }
      return false;
    }
  }

  /**
   * Export backup to file
   */
  exportBackup(backup = null) {
    const data = backup || this.createBackup('export');
    if (!data) return;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devchef-backup-${data.timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import backup from file
   */
  async importBackup(file) {
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      // Validate backup structure
      if (!backup.version || !backup.data) {
        throw new Error('Invalid backup file format');
      }

      // Restore
      await this.restoreBackup(backup);
      return true;
    } catch (error) {
      console.error('Import failed:', error);
      if (window.DevChef?.notifications) {
        window.DevChef.notifications.error('Failed to import backup: ' + error.message);
      }
      return false;
    }
  }

  /**
   * Delete backup from history
   */
  deleteBackup(timestamp) {
    try {
      const history = this.getHistory();
      const filtered = history.filter(b => b.timestamp !== timestamp);

      localStorage.setItem('devchef-backup-history', JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Could not delete backup:', error);
      return false;
    }
  }

  /**
   * Clear all backups
   */
  clearAllBackups() {
    try {
      localStorage.removeItem('devchef-backup-history');
      localStorage.removeItem('devchef-last-backup');
      this.lastBackupTime = null;
      return true;
    } catch (error) {
      console.error('Could not clear backups:', error);
      return false;
    }
  }

  /**
   * Get backup statistics
   */
  getStats() {
    const history = this.getHistory();
    const totalSize = JSON.stringify(history).length;

    return {
      count: history.length,
      totalSize,
      averageSize: history.length > 0 ? totalSize / history.length : 0,
      lastBackup: this.lastBackupTime,
      autoSaveEnabled: this.autoSaveEnabled,
      autoSaveInterval: this.autoSaveInterval
    };
  }

  /**
   * Register backup callback
   */
  onBackup(callback) {
    this.backupCallbacks.push(callback);
  }

  /**
   * Notify all callbacks
   */
  notifyCallbacks(backup) {
    this.backupCallbacks.forEach(callback => {
      try {
        callback(backup);
      } catch (e) {
        console.error('Backup callback failed:', e);
      }
    });
  }

  /**
   * Save to IndexedDB as fallback
   */
  async saveToIndexedDB(backup) {
    // Placeholder for IndexedDB implementation
    // Would be implemented for large backups that exceed localStorage limits
    console.log('IndexedDB backup not yet implemented');
  }

  /**
   * Enable/disable auto-save
   */
  setAutoSave(enabled) {
    this.autoSaveEnabled = enabled;
    if (enabled) {
      this.startAutoSave();
    } else {
      this.stopAutoSave();
    }
  }

  /**
   * Set auto-save interval
   */
  setAutoSaveInterval(ms) {
    this.autoSaveInterval = ms;
    if (this.autoSaveEnabled) {
      this.startAutoSave();
    }
  }
}

// Create singleton instance
export const backupManager = new BackupManager();

// Export class for testing
export { BackupManager };
