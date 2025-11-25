/**
 * Workflow Snapshots Manager (V1)
 * Allows power users to save and restore entire workflows
 *
 * A workflow snapshot includes:
 * - Current active tool
 * - States of all tools in the workflow
 * - Timestamp and metadata
 * - User-provided name and description
 */

class WorkflowSnapshotsManager {
  constructor(storage) {
    this.storage = storage;
    this.STORAGE_KEY = 'devchef-v2-workflow-snapshots';
    this.MAX_SNAPSHOTS = 50; // Limit to prevent storage bloat
    this.snapshotsCache = null;
    this.lastCacheTime = 0;
    this.CACHE_DURATION = 5000; // 5 seconds
  }

  /**
   * Get all workflow snapshots
   * @returns {Array} Array of snapshot objects
   */
  getSnapshots() {
    const now = Date.now();
    if (this.snapshotsCache && (now - this.lastCacheTime) < this.CACHE_DURATION) {
      return this.snapshotsCache;
    }

    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const parsed = data ? JSON.parse(data) : { snapshots: [], version: 1 };
      this.snapshotsCache = parsed.snapshots || [];
      this.lastCacheTime = now;
      return this.snapshotsCache;
    } catch (error) {
      console.error('Failed to load workflow snapshots:', error);
      return [];
    }
  }

  /**
   * Save a workflow snapshot
   * @param {Object} options - Snapshot options
   * @param {string} options.name - Snapshot name
   * @param {string} options.description - Snapshot description
   * @param {string} options.currentToolId - Currently active tool ID
   * @param {Object} options.toolStates - All tool states
   * @returns {Object} The created snapshot
   */
  saveSnapshot({ name, description = '', currentToolId, toolStates }) {
    if (!name || !name.trim()) {
      throw new Error('Snapshot name is required');
    }

    const snapshots = this.getSnapshots();

    // Create snapshot object
    const snapshot = {
      id: this._generateId(),
      name: name.trim(),
      description: description.trim(),
      currentToolId,
      toolStates: this._cloneData(toolStates),
      created: Date.now(),
      lastUsed: Date.now(),
      version: 1
    };

    // Add to beginning of array (most recent first)
    snapshots.unshift(snapshot);

    // Enforce max limit
    if (snapshots.length > this.MAX_SNAPSHOTS) {
      snapshots.splice(this.MAX_SNAPSHOTS);
    }

    // Save to storage
    this._saveSnapshots(snapshots);

    return snapshot;
  }

  /**
   * Restore a workflow snapshot
   * @param {string} snapshotId - Snapshot ID to restore
   * @returns {Object} The restored snapshot
   */
  restoreSnapshot(snapshotId) {
    const snapshots = this.getSnapshots();
    const snapshot = snapshots.find(s => s.id === snapshotId);

    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    // Update last used timestamp
    snapshot.lastUsed = Date.now();

    // Move to front (most recently used)
    const index = snapshots.indexOf(snapshot);
    if (index > 0) {
      snapshots.splice(index, 1);
      snapshots.unshift(snapshot);
      this._saveSnapshots(snapshots);
    }

    return this._cloneData(snapshot);
  }

  /**
   * Delete a workflow snapshot
   * @param {string} snapshotId - Snapshot ID to delete
   * @returns {boolean} True if deleted
   */
  deleteSnapshot(snapshotId) {
    const snapshots = this.getSnapshots();
    const index = snapshots.findIndex(s => s.id === snapshotId);

    if (index === -1) {
      return false;
    }

    snapshots.splice(index, 1);
    this._saveSnapshots(snapshots);
    return true;
  }

  /**
   * Update a snapshot's metadata
   * @param {string} snapshotId - Snapshot ID
   * @param {Object} updates - Fields to update (name, description)
   * @returns {Object} Updated snapshot
   */
  updateSnapshot(snapshotId, updates) {
    const snapshots = this.getSnapshots();
    const snapshot = snapshots.find(s => s.id === snapshotId);

    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    if (updates.name !== undefined) {
      snapshot.name = updates.name.trim();
    }
    if (updates.description !== undefined) {
      snapshot.description = updates.description.trim();
    }

    this._saveSnapshots(snapshots);
    return this._cloneData(snapshot);
  }

  /**
   * Get recent snapshots (most recently used)
   * @param {number} limit - Number of snapshots to return
   * @returns {Array} Recent snapshots
   */
  getRecentSnapshots(limit = 5) {
    const snapshots = this.getSnapshots();
    return snapshots
      .slice()
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, limit);
  }

  /**
   * Search snapshots by name or description
   * @param {string} query - Search query
   * @returns {Array} Matching snapshots
   */
  searchSnapshots(query) {
    if (!query || !query.trim()) {
      return this.getSnapshots();
    }

    const lowerQuery = query.toLowerCase().trim();
    return this.getSnapshots().filter(snapshot =>
      snapshot.name.toLowerCase().includes(lowerQuery) ||
      snapshot.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Export all snapshots as JSON
   * @returns {string} JSON string of all snapshots
   */
  exportSnapshots() {
    const snapshots = this.getSnapshots();
    return JSON.stringify({
      version: 1,
      exported: Date.now(),
      count: snapshots.length,
      snapshots
    }, null, 2);
  }

  /**
   * Import snapshots from JSON
   * @param {string} jsonData - JSON string to import
   * @param {boolean} merge - If true, merge with existing; if false, replace
   * @returns {number} Number of snapshots imported
   */
  importSnapshots(jsonData, merge = true) {
    try {
      const imported = JSON.parse(jsonData);

      if (!imported.snapshots || !Array.isArray(imported.snapshots)) {
        throw new Error('Invalid snapshot data format');
      }

      let snapshots = merge ? this.getSnapshots() : [];

      // Add imported snapshots, avoiding duplicates by name
      const existingNames = new Set(snapshots.map(s => s.name));
      let importedCount = 0;

      for (const snapshot of imported.snapshots) {
        if (!existingNames.has(snapshot.name)) {
          // Regenerate ID to avoid conflicts
          snapshot.id = this._generateId();
          snapshots.push(snapshot);
          existingNames.add(snapshot.name);
          importedCount++;
        }
      }

      // Enforce max limit
      if (snapshots.length > this.MAX_SNAPSHOTS) {
        snapshots = snapshots.slice(0, this.MAX_SNAPSHOTS);
      }

      this._saveSnapshots(snapshots);
      return importedCount;

    } catch (error) {
      throw new Error(`Failed to import snapshots: ${error.message}`);
    }
  }

  /**
   * Clear all snapshots
   * @returns {number} Number of snapshots cleared
   */
  clearAll() {
    const count = this.getSnapshots().length;
    this._saveSnapshots([]);
    return count;
  }

  /**
   * Get snapshot count
   * @returns {number} Total number of snapshots
   */
  getCount() {
    return this.getSnapshots().length;
  }

  /**
   * Save snapshots array to localStorage
   * @private
   */
  _saveSnapshots(snapshots) {
    try {
      const data = {
        version: 1,
        snapshots,
        lastModified: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      this.snapshotsCache = snapshots;
      this.lastCacheTime = Date.now();
    } catch (error) {
      console.error('Failed to save workflow snapshots:', error);
      throw new Error('Failed to save snapshot. Storage may be full.');
    }
  }

  /**
   * Generate unique snapshot ID
   * @private
   */
  _generateId() {
    return `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Deep clone data to avoid mutations
   * @private
   */
  _cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }
}

// Export singleton instance
// Will be initialized in app.js with storage reference
export let workflowSnapshots = null;

export function initWorkflowSnapshots(storage) {
  workflowSnapshots = new WorkflowSnapshotsManager(storage);
  return workflowSnapshots;
}
