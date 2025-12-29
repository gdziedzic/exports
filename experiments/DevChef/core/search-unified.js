/**
 * DevChef Unified Search Module
 *
 * Consolidates three search implementations:
 * - search.js (fuzzy matching, tool search)
 * - advancedsearch.js (favorites, recent, usage tracking)
 * - deepsearch.js (deep content search across localStorage)
 *
 * Provides a single, comprehensive search API for DevChef.
 *
 * @version 2.0.0
 */

import { storage } from './storage.js';

// ============================================================================
// CONSTANTS
// ============================================================================

// Search result types
const RESULT_TYPES = {
  TOOL: 'tool',
  TOOL_STATE: 'tool-state',
  SNIPPET: 'snippet',
  WORKFLOW: 'workflow',
  CLIPBOARD: 'clipboard',
  PRESET: 'preset'
};

// Maximum values
const MAX_PREVIEW_LENGTH = 100;
const MAX_RESULTS = 50;
const SEARCH_DEBOUNCE = 300;
const MAX_HISTORY_ITEMS = 50;
const MAX_RECENT_TOOLS = 10;

// Sensitive keywords to exclude from deep search
const SENSITIVE_KEYWORDS = [
  'password', 'token', 'secret', 'apikey', 'api_key',
  'private', 'credential', 'auth', 'jwt', 'bearer'
];

// ============================================================================
// FUZZY MATCHING ALGORITHM (from search.js)
// ============================================================================

/**
 * Calculate fuzzy match score between query and text
 * @param {string} query - Search query
 * @param {string} text - Text to search in
 * @returns {number} Score (0-100, higher is better match)
 */
export function fuzzyScore(query, text) {
  if (!query || query.trim() === '') return 100;
  if (!text || typeof text !== 'string') return 0;

  query = query.toLowerCase().trim();
  text = text.toLowerCase();

  // Exact match gets highest score
  if (text === query) return 100;

  // Contains query as substring
  if (text.includes(query)) {
    const startBonus = text.startsWith(query) ? 20 : 0;
    const lengthRatio = query.length / text.length;
    return 80 + startBonus * lengthRatio;
  }

  // Fuzzy matching - allow partial matches with lower scores
  let score = 0;
  let queryIndex = 0;
  let lastMatchIndex = -1;
  let consecutiveMatches = 0;
  let matchedChars = 0;

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      // Match found
      matchedChars++;
      score += 10;

      // Bonus for consecutive matches
      if (i === lastMatchIndex + 1) {
        consecutiveMatches++;
        score += consecutiveMatches * 2;
      } else {
        consecutiveMatches = 0;
      }

      // Bonus for matching at word start
      if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '-' || text[i - 1] === '_') {
        score += 5;
      }

      // Bonus for matching uppercase in camelCase
      if (text[i] === text[i].toUpperCase() && i > 0) {
        score += 3;
      }

      lastMatchIndex = i;
      queryIndex++;
    }
  }

  // If we matched at least some characters, give partial credit
  if (matchedChars > 0) {
    const matchRatio = matchedChars / query.length;
    score = score * matchRatio;

    // Give minimum score of 10 for any partial match
    if (score > 0 && score < 10) {
      score = 10;
    }
  } else {
    return 0;
  }

  // Normalize score
  return Math.min(100, Math.max(0, score));
}

/**
 * Highlight matching characters in text
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @returns {string} HTML string with highlighted matches
 */
export function highlightMatches(text, query) {
  if (!query || !text) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let result = '';
  let lastIndex = 0;
  let queryIndex = 0;

  for (let i = 0; i < text.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      // Add unmatched text before this match
      if (i > lastIndex) {
        result += escapeHtml(text.substring(lastIndex, i));
      }
      // Add highlighted match
      result += `<mark class="search-highlight">${escapeHtml(text[i])}</mark>`;
      lastIndex = i + 1;
      queryIndex++;
    }
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result += escapeHtml(text.substring(lastIndex));
  }

  return result || text;
}

/**
 * Escape HTML for safe display
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// TOOL SEARCH (from search.js + advancedsearch.js)
// ============================================================================

/**
 * Search tools with fuzzy matching
 * @param {Array} tools - Array of tool manifests
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Array} Sorted array of matching tools with scores
 */
export function searchTools(tools, query, options = {}) {
  // Validate inputs
  if (!Array.isArray(tools)) {
    console.warn('searchTools: tools must be an array');
    return [];
  }

  const {
    maxResults = 50,
    minScore = 20,
    prioritizeFavorites = false,
    favorites = [],
    recentTools = [],
    category = null,
    tags = []
  } = options;

  if (!query || query.trim() === '') {
    // No query - return all tools sorted by favorites and recent
    let filtered = tools;

    // Filter by category if specified
    if (category) {
      filtered = filtered.filter(tool => tool.category === category);
    }

    // Filter by tags if specified
    if (tags.length > 0) {
      filtered = filtered.filter(tool => {
        const toolTags = tool.keywords || [];
        return tags.every(tag => toolTags.includes(tag));
      });
    }

    return filtered.map(tool => ({
      tool,
      score: 100,
      isFavorite: favorites.includes(tool?.id),
      isRecent: recentTools.some(r => r?.toolId === tool?.id)
    })).sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      if (a.isRecent && !b.isRecent) return -1;
      if (!a.isRecent && b.isRecent) return 1;
      return (a.tool?.name || '').localeCompare(b.tool?.name || '');
    }).slice(0, maxResults);
  }

  const results = tools.map(tool => {
    // Skip invalid tool objects
    if (!tool || typeof tool !== 'object') {
      return null;
    }

    // Apply category filter
    if (category && tool.category !== category) {
      return null;
    }

    // Apply tags filter
    if (tags.length > 0) {
      const toolTags = tool.keywords || [];
      const hasAllTags = tags.every(tag => toolTags.includes(tag));
      if (!hasAllTags) {
        return null;
      }
    }

    const lowerQuery = query.toLowerCase().trim();
    const lowerName = tool.name ? tool.name.toLowerCase() : '';
    const lowerCategory = tool.category ? tool.category.toLowerCase() : '';

    // Check for exact matches (case-insensitive) - should show ONLY that tool
    const exactNameMatch = lowerName === lowerQuery;

    // If exact match, give it maximum score and return immediately
    if (exactNameMatch) {
      return {
        tool,
        score: 1000, // Very high score for exact name match
        isFavorite: tool.id ? favorites.includes(tool.id) : false,
        isRecent: !!recentTools.find(r => r?.toolId === tool.id),
        matchDetails: {
          nameScore: 1000,
          descScore: 0,
          categoryScore: 0
        }
      };
    }

    // Calculate scores only for name, description, and category
    let nameScore = tool.name ? fuzzyScore(query, tool.name) : 0;

    // Strong boost for name matches
    if (lowerName && lowerName.includes(lowerQuery)) {
      // Name contains query - very high score
      nameScore = Math.max(nameScore, 95);

      // Extra bonus if name STARTS with query
      if (lowerName.startsWith(lowerQuery)) {
        nameScore = Math.max(nameScore, 98);
      }
    }

    const descScore = tool.description ? fuzzyScore(query, tool.description) * 0.3 : 0;
    const categoryScore = tool.category ? fuzzyScore(query, tool.category) * 0.4 : 0;
    const keywordScore = tool.keywords ?
      Math.max(...tool.keywords.map(k => fuzzyScore(query, k)), 0) * 0.5 : 0;

    // Combined score - heavily weighted towards name
    let baseScore;
    if (nameScore > 50) {
      // If name matches well, use name score primarily
      baseScore = nameScore + (descScore * 0.1) + (categoryScore * 0.1);
    } else {
      // If name doesn't match well, allow description/category/keywords to contribute more
      baseScore = Math.max(
        nameScore * 2.0,  // Double weight for name even in weak matches
        descScore,
        categoryScore,
        keywordScore
      );
    }

    // Check if tool is recent (needed for display, regardless of score)
    const recentEntry = tool.id ? recentTools.find(r => r?.toolId === tool.id) : null;

    // Only add bonuses if there's a base match
    let score = baseScore;

    if (baseScore > 0) {
      // Bonus for favorites
      if (prioritizeFavorites && tool.id && favorites.includes(tool.id)) {
        score += 15;
      }

      // Bonus for recently used
      if (recentEntry) {
        score += 5;
      }
    }

    return {
      tool,
      score,
      isFavorite: tool.id ? favorites.includes(tool.id) : false,
      isRecent: !!recentEntry,
      matchDetails: {
        nameScore,
        descScore,
        categoryScore,
        keywordScore
      }
    };
  }).filter(r => r !== null); // Remove invalid/filtered entries

  // Filter and sort results - only include tools with actual matches (score > 0)
  const filtered = results.filter(r => r.score > minScore);

  return filtered
    .sort((a, b) => {
      // First, prioritize by overall score (descending)
      if (Math.abs(a.score - b.score) > 5) {
        return b.score - a.score;
      }

      // If scores are very similar (within 5 points), prioritize by name match quality
      const aNameScore = a.matchDetails?.nameScore || 0;
      const bNameScore = b.matchDetails?.nameScore || 0;

      if (Math.abs(aNameScore - bNameScore) > 5) {
        return bNameScore - aNameScore;
      }

      // If name scores are also similar, prioritize favorites
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;

      // Then recent tools
      if (a.isRecent && !b.isRecent) return -1;
      if (!a.isRecent && b.isRecent) return 1;

      // Finally alphabetical
      return (a.tool?.name || '').localeCompare(b.tool?.name || '');
    })
    .slice(0, maxResults);
}

/**
 * Group search results by category
 * @param {Array} results - Search results
 * @returns {Object} Results grouped by category
 */
export function groupByCategory(results) {
  const groups = {};

  results.forEach(result => {
    const category = result.tool.category || 'Uncategorized';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(result);
  });

  return groups;
}

/**
 * Get all unique categories from tools
 * @param {Array} tools - All tools
 * @returns {Array} Sorted array of unique categories
 */
export function getAllCategories(tools) {
  const categories = new Set(tools.map(t => t.category || 'Uncategorized'));
  return Array.from(categories).sort();
}

// ============================================================================
// DEEP SEARCH (from deepsearch.js)
// ============================================================================

/**
 * Deep search index for searching across saved content
 */
class DeepSearchIndex {
  constructor() {
    this.index = [];
    this.lastIndexTime = null;
  }

  /**
   * Build complete search index from localStorage
   */
  buildIndex() {
    console.log('[Search] Building deep search index...');
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
    console.log(`[Search] Deep search index built: ${this.index.length} items in ${duration}ms`);

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
      console.error('[Search] Error indexing tool states:', error);
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
      console.error('[Search] Error indexing snippets:', error);
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
      console.error('[Search] Error indexing workflows:', error);
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
      console.error('[Search] Error indexing clipboard:', error);
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
      console.error('[Search] Error indexing presets:', error);
    }
  }

  /**
   * Extract searchable text from object/array/primitive
   */
  extractSearchableText(obj, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return '';
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

    if (Array.isArray(obj)) {
      return obj
        .map(item => this.extractSearchableText(item, maxDepth, currentDepth + 1))
        .filter(Boolean)
        .join(' ');
    }

    if (typeof obj === 'object') {
      return Object.entries(obj)
        .filter(([key]) => !key.startsWith('_'))
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
      types = null,
      maxResults = MAX_RESULTS,
      minScore = 10
    } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchQuery = query.trim();
    const results = [];

    for (const item of this.index) {
      if (types && !types.includes(item.type)) {
        continue;
      }

      const score = fuzzyScore(searchQuery, item.content);

      if (score >= minScore) {
        results.push({
          ...item,
          score,
          highlightedPreview: highlightMatches(item.preview, searchQuery)
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
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

// ============================================================================
// UNIFIED SEARCH MANAGER (combines all functionality)
// ============================================================================

/**
 * Unified search manager with favorites, recent tools, and deep search
 */
class UnifiedSearchManager {
  constructor() {
    this.deepSearchIndex = new DeepSearchIndex();
    this.searchHistory = [];
    this.favorites = new Set();
    this.recentTools = [];
    this.usageCount = new Map();
    this.isDeepIndexed = false;
    this.debounceTimer = null;
  }

  /**
   * Initialize search manager
   */
  init() {
    try {
      this.loadFavorites();
      this.loadRecentTools();
      this.loadUsageStats();
      this.loadSearchHistory();
      console.log('🔍 Unified Search initialized');
    } catch (error) {
      console.error('Error initializing Unified Search:', error);
    }
    return this;
  }

  /**
   * Search tools with all enhancements
   */
  searchTools(tools, query, options = {}) {
    return searchTools(tools, query, {
      ...options,
      favorites: Array.from(this.favorites),
      recentTools: this.recentTools,
      prioritizeFavorites: true
    });
  }

  /**
   * Deep search across saved content
   */
  deepSearch(query, options = {}) {
    if (!this.isDeepIndexed) {
      this.deepSearchIndex.buildIndex();
      this.isDeepIndexed = true;
    }

    const results = this.deepSearchIndex.search(query, options);
    this.addToHistory(query);
    return results;
  }

  /**
   * Rebuild deep search index
   */
  rebuildDeepIndex() {
    this.deepSearchIndex.buildIndex();
    this.isDeepIndexed = true;
  }

  /**
   * Toggle favorite
   */
  toggleFavorite(toolId) {
    if (this.favorites.has(toolId)) {
      this.favorites.delete(toolId);
    } else {
      this.favorites.add(toolId);
    }
    this.saveFavorites();
  }

  /**
   * Track tool usage
   */
  trackUsage(toolId) {
    const count = this.usageCount.get(toolId) || 0;
    this.usageCount.set(toolId, count + 1);

    this.recentTools = this.recentTools.filter(t => t.toolId !== toolId);
    this.recentTools.unshift({ toolId, timestamp: Date.now() });
    this.recentTools = this.recentTools.slice(0, MAX_RECENT_TOOLS);

    this.saveUsageStats();
    this.saveRecentTools();
  }

  /**
   * Add to search history
   */
  addToHistory(query) {
    if (!query || query.trim().length === 0) return;

    const trimmedQuery = query.trim();
    this.searchHistory = this.searchHistory.filter(q => q !== trimmedQuery);
    this.searchHistory.unshift(trimmedQuery);
    this.searchHistory = this.searchHistory.slice(0, MAX_HISTORY_ITEMS);

    this.saveSearchHistory();
  }

  /**
   * Get search history
   */
  getHistory() {
    return [...this.searchHistory];
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      favorites: this.favorites.size,
      recentTools: this.recentTools.length,
      usageTracked: this.usageCount.size,
      searchHistory: this.searchHistory.length,
      deepIndex: this.deepSearchIndex.getStats()
    };
  }

  // Storage methods
  saveFavorites() {
    try {
      if (window.storage) {
        window.storage.set('search-favorites', Array.from(this.favorites));
      }
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }

  loadFavorites() {
    try {
      if (window.storage) {
        const favorites = window.storage.get('search-favorites') || [];
        this.favorites = new Set(favorites);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  }

  saveRecentTools() {
    try {
      if (window.storage) {
        window.storage.set('search-recent', this.recentTools);
      }
    } catch (error) {
      console.error('Error saving recent tools:', error);
    }
  }

  loadRecentTools() {
    try {
      if (window.storage) {
        this.recentTools = window.storage.get('search-recent') || [];
      }
    } catch (error) {
      console.error('Error loading recent tools:', error);
    }
  }

  saveUsageStats() {
    try {
      if (window.storage) {
        const stats = Object.fromEntries(this.usageCount);
        window.storage.set('search-usage', stats);
      }
    } catch (error) {
      console.error('Error saving usage stats:', error);
    }
  }

  loadUsageStats() {
    try {
      if (window.storage) {
        const stats = window.storage.get('search-usage') || {};
        this.usageCount = new Map(Object.entries(stats));
      }
    } catch (error) {
      console.error('Error loading usage stats:', error);
    }
  }

  saveSearchHistory() {
    try {
      if (window.storage) {
        window.storage.set('search-history', this.searchHistory);
      }
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }

  loadSearchHistory() {
    try {
      if (window.storage) {
        this.searchHistory = window.storage.get('search-history') || [];
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export singleton instance
export const unifiedSearch = new UnifiedSearchManager();

// Export for backward compatibility
export { RESULT_TYPES, MAX_PREVIEW_LENGTH, MAX_RESULTS };

// Legacy exports (for gradual migration)
export const searchSystem = unifiedSearch;  // Alias
export const deepSearch = unifiedSearch;    // Alias
