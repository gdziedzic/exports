/**
 * DevChef Deep Search Module
 *
 * Searches across all saved content including:
 * - Tool names, descriptions, categories (existing)
 * - Saved tool states (localStorage data)
 * - Workflow snapshots
 * - Snippet library
 * - Clipboard history
 *
 * Features:
 * - Fuzzy matching with context preview
 * - Result grouping by type
 * - Content indexing with caching
 * - Debounced search (300ms)
 * - Performance optimizations
 */

import { fuzzyScore, highlightMatches } from './search.js';
import { storage } from './storage.js';

// Search result types
const RESULT_TYPES = {
  TOOL: 'tool',
  TOOL_STATE: 'tool-state',
  SNIPPET: 'snippet',
  WORKFLOW: 'workflow',
  CLIPBOARD: 'clipboard',
  PRESET: 'preset'
};

// Maximum preview length for content
const MAX_PREVIEW_LENGTH = 100;

// Maximum search results
const MAX_RESULTS = 50;

// Debounce delay (ms)
const SEARCH_DEBOUNCE = 300;

// Sensitive keywords to exclude from search
const SENSITIVE_KEYWORDS = [
  'password', 'token', 'secret', 'apikey', 'api_key',
  'private', 'credential', 'auth', 'jwt', 'bearer'
];

class DeepSearchIndex {
  constructor() {
    this.index = [];
    this.lastIndexTime = null;
    this.indexVersion = 1;
    this.searchHistory = [];
    this.maxHistoryItems = 20;
  }

  /**
   * Build complete search index from localStorage
   */
  buildIndex() {
    console.log('[DeepSearch] Building search index...');
    const startTime = performance.now();

    this.index = [];

    // Index tool states
    this.indexToolStates();

    // Index snippets
    this.indexSnippets();

    // Index workflow snapshots
    this.indexWorkflows();

    // Index clipboard history
    this.indexClipboardHistory();

    // Index presets
    this.indexPresets();

    this.lastIndexTime = Date.now();

    const duration = Math.round(performance.now() - startTime);
    console.log(`[DeepSearch] Index built: ${this.index.length} items in ${duration}ms`);

    return this.index;
  }

  /**
   * Index tool states from localStorage
   */
  indexToolStates() {
    try {
      const toolStatesData = localStorage.getItem('devchef-v2-tool-states');
      if (!toolStatesData) return;

      const toolStates = JSON.parse(toolStatesData);

      for (const [toolId, state] of Object.entries(toolStates)) {
        if (!state || typeof state !== 'object') continue;

        // Convert state to searchable text
        const stateText = this.extractSearchableText(state);

        if (stateText && !this.containsSensitiveData(stateText)) {
          this.index.push({
            type: RESULT_TYPES.TOOL_STATE,
            id: `state-${toolId}`,
            toolId: toolId,
            content: stateText,
            preview: this.truncateText(stateText, MAX_PREVIEW_LENGTH),
            location: `${toolId} > Saved State`,
            timestamp: state.savedAt || null,
            data: state
          });
        }
      }
    } catch (error) {
      console.error('[DeepSearch] Error indexing tool states:', error);
    }
  }

  /**
   * Index snippets from snippet manager
   */
  indexSnippets() {
    try {
      const snippetsData = localStorage.getItem('devchef-v2.5-snippets');
      if (!snippetsData) return;

      const snippets = JSON.parse(snippetsData);

      for (const snippet of snippets) {
        if (!snippet) continue;

        const searchableText = [
          snippet.title || '',
          snippet.description || '',
          snippet.content || '',
          snippet.tags?.join(' ') || '',
          snippet.category || ''
        ].filter(Boolean).join(' ');

        if (searchableText && !this.containsSensitiveData(searchableText)) {
          this.index.push({
            type: RESULT_TYPES.SNIPPET,
            id: snippet.id,
            toolId: snippet.toolId,
            content: searchableText,
            preview: snippet.title || this.truncateText(snippet.content, MAX_PREVIEW_LENGTH),
            location: `Snippets > ${snippet.category || 'Uncategorized'}`,
            timestamp: snippet.updatedAt || snippet.createdAt,
            data: snippet
          });
        }
      }
    } catch (error) {
      console.error('[DeepSearch] Error indexing snippets:', error);
    }
  }

  /**
   * Index workflow snapshots
   */
  indexWorkflows() {
    try {
      const workflowData = localStorage.getItem('devchef-v2-workflow-snapshots');
      if (!workflowData) return;

      const workflows = JSON.parse(workflowData);

      for (const workflow of workflows) {
        if (!workflow) continue;

        const searchableText = [
          workflow.name || '',
          workflow.description || '',
          workflow.toolId || '',
          this.extractSearchableText(workflow.input),
          this.extractSearchableText(workflow.output),
          this.extractSearchableText(workflow.settings)
        ].filter(Boolean).join(' ');

        if (searchableText && !this.containsSensitiveData(searchableText)) {
          this.index.push({
            type: RESULT_TYPES.WORKFLOW,
            id: workflow.id,
            toolId: workflow.toolId,
            content: searchableText,
            preview: workflow.name || `Workflow for ${workflow.toolId}`,
            location: `Workflows > ${workflow.name || 'Unnamed'}`,
            timestamp: workflow.createdAt,
            data: workflow
          });
        }
      }
    } catch (error) {
      console.error('[DeepSearch] Error indexing workflows:', error);
    }
  }

  /**
   * Index clipboard history
   */
  indexClipboardHistory() {
    try {
      const clipboardData = localStorage.getItem('devchef-clipboard-history');
      if (!clipboardData) return;

      const history = JSON.parse(clipboardData);

      for (let i = 0; i < Math.min(history.length, 20); i++) {
        const item = history[i];
        if (!item || !item.text) continue;

        const text = String(item.text);

        if (!this.containsSensitiveData(text)) {
          this.index.push({
            type: RESULT_TYPES.CLIPBOARD,
            id: `clipboard-${i}`,
            toolId: null,
            content: text,
            preview: this.truncateText(text, MAX_PREVIEW_LENGTH),
            location: `Clipboard History > ${item.detectedType || 'Unknown'}`,
            timestamp: item.timestamp,
            data: item
          });
        }
      }
    } catch (error) {
      console.error('[DeepSearch] Error indexing clipboard:', error);
    }
  }

  /**
   * Index saved presets
   */
  indexPresets() {
    try {
      const presetsData = localStorage.getItem('devchef-v2-presets');
      if (!presetsData) return;

      const presets = JSON.parse(presetsData);

      for (const [toolId, toolPresets] of Object.entries(presets)) {
        if (!toolPresets || typeof toolPresets !== 'object') continue;

        for (const [presetName, presetData] of Object.entries(toolPresets)) {
          const searchableText = [
            presetName,
            this.extractSearchableText(presetData)
          ].filter(Boolean).join(' ');

          if (searchableText && !this.containsSensitiveData(searchableText)) {
            this.index.push({
              type: RESULT_TYPES.PRESET,
              id: `preset-${toolId}-${presetName}`,
              toolId: toolId,
              content: searchableText,
              preview: presetName,
              location: `${toolId} > Presets > ${presetName}`,
              timestamp: presetData.savedAt || null,
              data: presetData
            });
          }
        }
      }
    } catch (error) {
      console.error('[DeepSearch] Error indexing presets:', error);
    }
  }

  /**
   * Extract searchable text from object/array/primitive
   */
  extractSearchableText(obj, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return '';

    if (!obj) return '';

    if (typeof obj === 'string') return obj;

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      return obj
        .map(item => this.extractSearchableText(item, maxDepth, currentDepth + 1))
        .filter(Boolean)
        .join(' ');
    }

    if (typeof obj === 'object') {
      return Object.entries(obj)
        .filter(([key]) => !key.startsWith('_')) // Skip private fields
        .map(([key, value]) => {
          const valueText = this.extractSearchableText(value, maxDepth, currentDepth + 1);
          return `${key} ${valueText}`;
        })
        .filter(Boolean)
        .join(' ');
    }

    return '';
  }

  /**
   * Check if text contains sensitive data
   */
  containsSensitiveData(text) {
    if (!text) return false;

    const lowerText = text.toLowerCase();
    return SENSITIVE_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Truncate text with ellipsis
   */
  truncateText(text, maxLength) {
    if (!text) return '';

    const str = String(text).trim();
    if (str.length <= maxLength) return str;

    return str.substring(0, maxLength).trim() + '...';
  }

  /**
   * Search the index with fuzzy matching
   */
  search(query, options = {}) {
    const {
      types = null, // null = all types, or array of RESULT_TYPES
      maxResults = MAX_RESULTS,
      minScore = 10
    } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchQuery = query.trim().toLowerCase();
    const results = [];

    for (const item of this.index) {
      // Filter by type if specified
      if (types && !types.includes(item.type)) {
        continue;
      }

      // Calculate fuzzy match score
      const score = fuzzyScore(item.content, searchQuery);

      if (score >= minScore) {
        results.push({
          ...item,
          score,
          highlightedPreview: highlightMatches(item.preview, searchQuery)
        });
      }
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    // Limit results
    return results.slice(0, maxResults);
  }

  /**
   * Group results by type
   */
  groupResults(results) {
    const grouped = {};

    for (const result of results) {
      const type = result.type;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(result);
    }

    return grouped;
  }

  /**
   * Add search to history
   */
  addToHistory(query) {
    if (!query || query.trim().length === 0) return;

    const trimmedQuery = query.trim();

    // Remove if already exists
    this.searchHistory = this.searchHistory.filter(q => q !== trimmedQuery);

    // Add to front
    this.searchHistory.unshift(trimmedQuery);

    // Limit size
    if (this.searchHistory.length > this.maxHistoryItems) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistoryItems);
    }
  }

  /**
   * Get search history
   */
  getHistory() {
    return [...this.searchHistory];
  }

  /**
   * Clear search index (force rebuild)
   */
  clearIndex() {
    this.index = [];
    this.lastIndexTime = null;
  }

  /**
   * Get index statistics
   */
  getStats() {
    const typeCounts = {};

    for (const item of this.index) {
      typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    }

    return {
      total: this.index.length,
      byType: typeCounts,
      lastIndexTime: this.lastIndexTime,
      indexAge: this.lastIndexTime ? Date.now() - this.lastIndexTime : null
    };
  }
}

// Singleton instance
const deepSearchIndex = new DeepSearchIndex();

/**
 * Deep search manager with debouncing
 */
class DeepSearchManager {
  constructor() {
    this.searchIndex = deepSearchIndex;
    this.debounceTimer = null;
    this.isIndexed = false;
    this.callbacks = new Set();
  }

  /**
   * Initialize the search index
   */
  initialize() {
    if (!this.isIndexed) {
      this.searchIndex.buildIndex();
      this.isIndexed = true;
    }
    return this;
  }

  /**
   * Rebuild search index
   */
  rebuildIndex() {
    this.searchIndex.buildIndex();
    this.isIndexed = true;
    return this;
  }

  /**
   * Perform deep search with debouncing
   */
  search(query, options = {}, callback) {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Ensure index is built
    if (!this.isIndexed) {
      this.initialize();
    }

    // Debounce search
    this.debounceTimer = setTimeout(() => {
      const results = this.searchIndex.search(query, options);
      const grouped = this.searchIndex.groupResults(results);

      // Add to search history
      if (query && query.trim().length > 0) {
        this.searchIndex.addToHistory(query);
      }

      // Trigger callback
      if (callback) {
        callback({
          query,
          results,
          grouped,
          total: results.length,
          stats: this.searchIndex.getStats()
        });
      }

      // Notify all registered callbacks
      this.callbacks.forEach(cb => {
        try {
          cb({ query, results, grouped, total: results.length });
        } catch (error) {
          console.error('[DeepSearch] Callback error:', error);
        }
      });
    }, SEARCH_DEBOUNCE);
  }

  /**
   * Subscribe to search results
   */
  subscribe(callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Get search statistics
   */
  getStats() {
    return this.searchIndex.getStats();
  }

  /**
   * Get search history
   */
  getHistory() {
    return this.searchIndex.getHistory();
  }

  /**
   * Clear and rebuild index
   */
  clearAndRebuild() {
    this.searchIndex.clearIndex();
    this.rebuildIndex();
  }
}

// Export singleton
export const deepSearch = new DeepSearchManager();

// Export constants for external use
export { RESULT_TYPES, MAX_PREVIEW_LENGTH, MAX_RESULTS };
