/**
 * DevChef V2.5 - Snippet Library System
 * Save, organize, and reuse code snippets
 */

import { storage } from './storage.js';
import { notifications } from './notifications.js';

class SnippetManager {
  constructor() {
    this.snippets = [];
    this.tags = new Set();
    this.maxSnippets = 500;
    this.loadSnippets();
  }

  /**
   * Load snippets from storage
   */
  loadSnippets() {
    const saved = storage.get('devchef-v2.5-snippets');
    if (saved && Array.isArray(saved)) {
      this.snippets = saved;
      this.rebuildTags();
    }
  }

  /**
   * Save snippets to storage
   */
  saveSnippets() {
    storage.set('devchef-v2.5-snippets', this.snippets);
  }

  /**
   * Rebuild tags set from snippets
   */
  rebuildTags() {
    this.tags.clear();
    this.snippets.forEach(snippet => {
      if (snippet.tags) {
        snippet.tags.forEach(tag => this.tags.add(tag));
      }
    });
  }

  /**
   * Create a new snippet
   * @param {Object} data - Snippet data
   * @returns {Object} Created snippet
   */
  createSnippet(data) {
    const snippet = {
      id: `snippet-${Date.now()}-${Math.random()}`,
      title: data.title || 'Untitled Snippet',
      content: data.content || '',
      description: data.description || '',
      language: data.language || 'text',
      tags: data.tags || [],
      category: data.category || 'General',
      toolId: data.toolId || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
      lastUsed: null,
      favorite: false
    };

    this.snippets.unshift(snippet);

    if (this.snippets.length > this.maxSnippets) {
      this.snippets = this.snippets.slice(0, this.maxSnippets);
    }

    // Update tags
    if (snippet.tags) {
      snippet.tags.forEach(tag => this.tags.add(tag));
    }

    this.saveSnippets();
    return snippet;
  }

  /**
   * Update snippet
   * @param {string} snippetId - Snippet ID
   * @param {Object} updates - Updates to apply
   */
  updateSnippet(snippetId, updates) {
    const snippet = this.snippets.find(s => s.id === snippetId);
    if (!snippet) return false;

    Object.assign(snippet, updates, { updatedAt: Date.now() });

    // Rebuild tags if tags were updated
    if (updates.tags) {
      this.rebuildTags();
    }

    this.saveSnippets();
    return true;
  }

  /**
   * Delete snippet
   * @param {string} snippetId - Snippet ID
   */
  deleteSnippet(snippetId) {
    this.snippets = this.snippets.filter(s => s.id !== snippetId);
    this.rebuildTags();
    this.saveSnippets();
  }

  /**
   * Get snippet by ID
   * @param {string} snippetId - Snippet ID
   * @returns {Object|null} Snippet or null
   */
  getSnippet(snippetId) {
    return this.snippets.find(s => s.id === snippetId) || null;
  }

  /**
   * Get all snippets
   * @param {Object} filters - Filter options
   * @returns {Array} Filtered snippets
   */
  getSnippets(filters = {}) {
    let result = [...this.snippets];

    // Filter by tag
    if (filters.tag) {
      result = result.filter(s => s.tags && s.tags.includes(filters.tag));
    }

    // Filter by category
    if (filters.category) {
      result = result.filter(s => s.category === filters.category);
    }

    // Filter by language
    if (filters.language) {
      result = result.filter(s => s.language === filters.language);
    }

    // Filter by tool
    if (filters.toolId) {
      result = result.filter(s => s.toolId === filters.toolId);
    }

    // Filter favorites
    if (filters.favorites) {
      result = result.filter(s => s.favorite);
    }

    // Search
    if (filters.search) {
      const query = filters.search.toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.content.toLowerCase().includes(query) ||
        (s.tags && s.tags.some(t => t.toLowerCase().includes(query)))
      );
    }

    // Sort
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'recent':
          result.sort((a, b) => b.updatedAt - a.updatedAt);
          break;
        case 'popular':
          result.sort((a, b) => b.usageCount - a.usageCount);
          break;
        case 'title':
          result.sort((a, b) => a.title.localeCompare(b.title));
          break;
      }
    }

    return result;
  }

  /**
   * Use snippet (increment usage count)
   * @param {string} snippetId - Snippet ID
   */
  useSnippet(snippetId) {
    const snippet = this.getSnippet(snippetId);
    if (snippet) {
      snippet.usageCount++;
      snippet.lastUsed = Date.now();
      this.saveSnippets();
    }
  }

  /**
   * Toggle favorite
   * @param {string} snippetId - Snippet ID
   * @returns {boolean} New favorite status
   */
  toggleFavorite(snippetId) {
    const snippet = this.getSnippet(snippetId);
    if (snippet) {
      snippet.favorite = !snippet.favorite;
      this.saveSnippets();
      return snippet.favorite;
    }
    return false;
  }

  /**
   * Get all tags
   * @returns {Array} All unique tags
   */
  getAllTags() {
    return Array.from(this.tags).sort();
  }

  /**
   * Get all categories
   * @returns {Array} All unique categories
   */
  getAllCategories() {
    const categories = new Set(this.snippets.map(s => s.category));
    return Array.from(categories).sort();
  }

  /**
   * Get all languages
   * @returns {Array} All unique languages
   */
  getAllLanguages() {
    const languages = new Set(this.snippets.map(s => s.language));
    return Array.from(languages).sort();
  }

  /**
   * Get recent snippets
   * @param {number} count - Number of snippets
   * @returns {Array} Recent snippets
   */
  getRecentSnippets(count = 10) {
    return [...this.snippets]
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .filter(s => s.lastUsed)
      .slice(0, count);
  }

  /**
   * Get favorite snippets
   * @returns {Array} Favorite snippets
   */
  getFavoriteSnippets() {
    return this.snippets.filter(s => s.favorite);
  }

  /**
   * Export snippet
   * @param {string} snippetId - Snippet ID
   * @returns {Object} Exported snippet
   */
  exportSnippet(snippetId) {
    const snippet = this.getSnippet(snippetId);
    if (!snippet) return null;

    return {
      version: '2.5',
      type: 'devchef-snippet',
      data: snippet
    };
  }

  /**
   * Export all snippets
   * @returns {Object} Exported snippets
   */
  exportAllSnippets() {
    return {
      version: '2.5',
      type: 'devchef-snippets',
      count: this.snippets.length,
      exportedAt: new Date().toISOString(),
      data: this.snippets
    };
  }

  /**
   * Import snippet
   * @param {Object} data - Snippet data
   * @returns {boolean} Success status
   */
  importSnippet(data) {
    if (!data || data.type !== 'devchef-snippet') {
      return false;
    }

    const snippet = {
      ...data.data,
      id: `snippet-${Date.now()}-${Math.random()}`, // New ID
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.snippets.unshift(snippet);
    if (snippet.tags) {
      snippet.tags.forEach(tag => this.tags.add(tag));
    }

    this.saveSnippets();
    return true;
  }

  /**
   * Import multiple snippets
   * @param {Object} data - Snippets data
   * @returns {number} Number of imported snippets
   */
  importSnippets(data) {
    if (!data || data.type !== 'devchef-snippets') {
      return 0;
    }

    let imported = 0;
    data.data.forEach(snippetData => {
      const snippet = {
        ...snippetData,
        id: `snippet-${Date.now()}-${Math.random()}-${imported}`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      this.snippets.unshift(snippet);
      if (snippet.tags) {
        snippet.tags.forEach(tag => this.tags.add(tag));
      }
      imported++;
    });

    this.saveSnippets();
    return imported;
  }

  /**
   * Search snippets
   * @param {string} query - Search query
   * @returns {Array} Matching snippets
   */
  search(query) {
    return this.getSnippets({ search: query });
  }

  /**
   * Copy snippet to clipboard
   * @param {string} snippetId - Snippet ID
   * @returns {Promise<boolean>} Success status
   */
  async copyToClipboard(snippetId) {
    const snippet = this.getSnippet(snippetId);
    if (!snippet) return false;

    try {
      await navigator.clipboard.writeText(snippet.content);
      this.useSnippet(snippetId);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      total: this.snippets.length,
      favorites: this.snippets.filter(s => s.favorite).length,
      tags: this.tags.size,
      categories: this.getAllCategories().length,
      languages: this.getAllLanguages().length,
      mostUsed: [...this.snippets]
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5)
        .map(s => ({ title: s.title, usageCount: s.usageCount }))
    };
  }
}

// Create and export singleton
export const snippetManager = new SnippetManager();
