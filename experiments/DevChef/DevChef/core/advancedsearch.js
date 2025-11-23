/**
 * Advanced Search - V6.5
 * Intelligent tool discovery with fuzzy matching and smart suggestions
 *
 * Features:
 * - Fuzzy search with scoring
 * - Tag-based filtering
 * - Category filtering
 * - Recent tools tracking
 * - Favorites management
 * - Usage frequency ranking
 * - Keyboard shortcuts
 * - Search history
 * - Smart suggestions
 * - Quick access commands
 */

class AdvancedSearch {
  constructor() {
    this.tools = [];
    this.searchHistory = [];
    this.favorites = new Set();
    this.recentTools = [];
    this.usageCount = new Map();
    this.searchIndex = new Map();
    this.maxHistory = 50;
    this.maxRecent = 10;
    this.init();
  }

  /**
   * Initialize advanced search
   */
  init() {
    try {
      this.loadFavorites();
      this.loadRecentTools();
      this.loadUsageStats();
      this.buildSearchIndex();
      this.setupKeyboardShortcuts();
      console.log('🔍 Advanced Search initialized - Intelligent Discovery');
    } catch (error) {
      console.error('Error initializing Advanced Search:', error);
    }
  }

  /**
   * Build search index
   */
  buildSearchIndex() {
    try {
      // Get tools from registry if available
      if (window.ToolRegistry) {
        this.tools = window.ToolRegistry.all();

        // Index tools by keywords
        this.tools.forEach(tool => {
          const keywords = [
            tool.name?.toLowerCase(),
            tool.id?.toLowerCase(),
            tool.description?.toLowerCase(),
            tool.category?.toLowerCase(),
            ...(tool.keywords || []).map(k => k.toLowerCase())
          ].filter(Boolean);

          keywords.forEach(keyword => {
            if (!this.searchIndex.has(keyword)) {
              this.searchIndex.set(keyword, []);
            }
            this.searchIndex.get(keyword).push(tool);
          });
        });
      }
    } catch (error) {
      console.error('Error building search index:', error);
    }
  }

  /**
   * Fuzzy search tools
   */
  search(query, options = {}) {
    try {
      const {
        category = null,
        tags = [],
        limit = 20,
        includeScore = false
      } = options;

      if (!query && !category && tags.length === 0) {
        return this.getRecommendedTools();
      }

      const lowerQuery = query.toLowerCase();
      const results = [];

      this.tools.forEach(tool => {
        let score = 0;

        // Category filter
        if (category && tool.category !== category) return;

        // Tags filter
        if (tags.length > 0) {
          const toolTags = tool.keywords || [];
          const hasAllTags = tags.every(tag => toolTags.includes(tag));
          if (!hasAllTags) return;
        }

        // Calculate fuzzy match score
        if (query) {
          score = this.calculateFuzzyScore(lowerQuery, tool);

          if (score === 0) return; // No match
        } else {
          score = 50; // Default score for category/tag filtering
        }

        // Boost score for favorites
        if (this.favorites.has(tool.id)) {
          score += 20;
        }

        // Boost score for recent tools
        const recentIndex = this.recentTools.indexOf(tool.id);
        if (recentIndex !== -1) {
          score += (10 - recentIndex);
        }

        // Boost score for frequently used tools
        const usage = this.usageCount.get(tool.id) || 0;
        score += Math.min(usage, 10);

        results.push({
          tool,
          score
        });
      });

      // Sort by score
      results.sort((a, b) => b.score - a.score);

      // Limit results
      const limited = results.slice(0, limit);

      // Add to search history
      if (query) {
        this.addToHistory(query);
      }

      return includeScore ? limited : limited.map(r => r.tool);
    } catch (error) {
      console.error('Error searching tools:', error);
      return [];
    }
  }

  /**
   * Calculate fuzzy match score
   */
  calculateFuzzyScore(query, tool) {
    try {
      let score = 0;

      // Exact match in name
      if (tool.name?.toLowerCase() === query) {
        return 100;
      }

      // Starts with query
      if (tool.name?.toLowerCase().startsWith(query)) {
        score += 80;
      }

      // Contains query
      if (tool.name?.toLowerCase().includes(query)) {
        score += 50;
      }

      // Match in description
      if (tool.description?.toLowerCase().includes(query)) {
        score += 30;
      }

      // Match in keywords
      const keywords = tool.keywords || [];
      keywords.forEach(keyword => {
        if (keyword.toLowerCase().includes(query)) {
          score += 40;
        }
      });

      // Match in category
      if (tool.category?.toLowerCase().includes(query)) {
        score += 20;
      }

      // Fuzzy character matching
      const fuzzyScore = this.fuzzyMatch(query, tool.name?.toLowerCase() || '');
      score += fuzzyScore * 0.5;

      return Math.min(score, 100);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Fuzzy character matching
   */
  fuzzyMatch(query, target) {
    try {
      let score = 0;
      let queryIndex = 0;

      for (let i = 0; i < target.length && queryIndex < query.length; i++) {
        if (target[i] === query[queryIndex]) {
          score += 1;
          queryIndex++;
        }
      }

      return queryIndex === query.length ? score : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get recommended tools
   */
  getRecommendedTools() {
    try {
      const recommendations = [];

      // Add recent tools
      this.recentTools.forEach(toolId => {
        const tool = this.tools.find(t => t.id === toolId);
        if (tool) {
          recommendations.push(tool);
        }
      });

      // Add favorites
      this.favorites.forEach(toolId => {
        const tool = this.tools.find(t => t.id === toolId);
        if (tool && !recommendations.includes(tool)) {
          recommendations.push(tool);
        }
      });

      // Add frequently used
      const sortedByUsage = Array.from(this.usageCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      sortedByUsage.forEach(([toolId]) => {
        const tool = this.tools.find(t => t.id === toolId);
        if (tool && !recommendations.includes(tool)) {
          recommendations.push(tool);
        }
      });

      return recommendations.slice(0, 10);
    } catch (error) {
      console.error('Error getting recommended tools:', error);
      return [];
    }
  }

  /**
   * Add tool to favorites
   */
  toggleFavorite(toolId) {
    try {
      if (this.favorites.has(toolId)) {
        this.favorites.delete(toolId);
      } else {
        this.favorites.add(toolId);
      }

      this.saveFavorites();

      if (window.uiEngine) {
        const action = this.favorites.has(toolId) ? 'added to' : 'removed from';
        window.uiEngine.showToast(`Tool ${action} favorites`, { type: 'success' });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }

  /**
   * Track tool usage
   */
  trackUsage(toolId) {
    try {
      const count = this.usageCount.get(toolId) || 0;
      this.usageCount.set(toolId, count + 1);

      // Add to recent tools
      this.recentTools = this.recentTools.filter(id => id !== toolId);
      this.recentTools.unshift(toolId);
      this.recentTools = this.recentTools.slice(0, this.maxRecent);

      this.saveUsageStats();
      this.saveRecentTools();
    } catch (error) {
      console.error('Error tracking usage:', error);
    }
  }

  /**
   * Add to search history
   */
  addToHistory(query) {
    try {
      // Remove if already exists
      this.searchHistory = this.searchHistory.filter(q => q !== query);

      // Add to beginning
      this.searchHistory.unshift(query);

      // Limit size
      this.searchHistory = this.searchHistory.slice(0, this.maxHistory);

      this.saveSearchHistory();
    } catch (error) {
      console.error('Error adding to history:', error);
    }
  }

  /**
   * Get search suggestions
   */
  getSuggestions(query) {
    try {
      if (!query) {
        return this.searchHistory.slice(0, 5);
      }

      const lowerQuery = query.toLowerCase();

      // Find matching history items
      const historySuggestions = this.searchHistory
        .filter(h => h.toLowerCase().includes(lowerQuery))
        .slice(0, 3);

      // Find matching tool names
      const toolSuggestions = this.tools
        .filter(t => t.name?.toLowerCase().includes(lowerQuery))
        .map(t => t.name)
        .slice(0, 3);

      return [...new Set([...historySuggestions, ...toolSuggestions])];
    } catch (error) {
      console.error('Error getting suggestions:', error);
      return [];
    }
  }

  /**
   * Get categories
   */
  getCategories() {
    try {
      const categories = new Set();
      this.tools.forEach(tool => {
        if (tool.category) {
          categories.add(tool.category);
        }
      });
      return Array.from(categories).sort();
    } catch (error) {
      console.error('Error getting categories:', error);
      return [];
    }
  }

  /**
   * Get all tags
   */
  getAllTags() {
    try {
      const tags = new Set();
      this.tools.forEach(tool => {
        if (tool.keywords) {
          tool.keywords.forEach(k => tags.add(k));
        }
      });
      return Array.from(tags).sort();
    } catch (error) {
      console.error('Error getting tags:', error);
      return [];
    }
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    try {
      document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K: Open search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          this.showSearchPanel();
        }

        // Ctrl/Cmd + P: Open command palette (alternate)
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
          e.preventDefault();
          this.showSearchPanel();
        }
      });
    } catch (error) {
      console.error('Error setting up keyboard shortcuts:', error);
    }
  }

  /**
   * Show search panel
   */
  showSearchPanel() {
    try {
      if (!window.uiEngine) return;

      const categories = this.getCategories();
      const recentTools = this.getRecommendedTools();

      const content = `
        <div class="advanced-search-panel">
          <div class="search-input-container">
            <input
              type="text"
              id="advanced-search-input"
              placeholder="Search tools... (fuzzy matching supported)"
              autocomplete="off"
            />
            <div id="search-suggestions" class="search-suggestions"></div>
          </div>

          <div class="search-filters">
            <select id="category-filter">
              <option value="">All Categories</option>
              ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>

          <div id="search-results" class="search-results">
            <h3>Recent & Favorites</h3>
            <div class="tool-grid">
              ${recentTools.map(tool => `
                <div class="tool-card" data-tool-id="${tool.id}">
                  <div class="tool-header">
                    <strong>${tool.name}</strong>
                    <button class="favorite-btn ${this.favorites.has(tool.id) ? 'active' : ''}"
                            onclick="window.advancedSearch.toggleFavorite('${tool.id}')">
                      ${this.favorites.has(tool.id) ? '★' : '☆'}
                    </button>
                  </div>
                  <div class="tool-description">${tool.description || ''}</div>
                  <div class="tool-category">${tool.category || ''}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      const modalId = window.uiEngine.showModal(content, {
        title: '🔍 Advanced Search',
        size: 'large'
      });

      // Setup search input handler
      setTimeout(() => {
        const input = document.getElementById('advanced-search-input');
        const results = document.getElementById('search-results');
        const suggestions = document.getElementById('search-suggestions');
        const categoryFilter = document.getElementById('category-filter');

        if (input) {
          input.focus();

          input.addEventListener('input', (e) => {
            const query = e.target.value;
            this.updateSearchResults(query, categoryFilter?.value, results);
            this.updateSuggestions(query, suggestions);
          });
        }

        if (categoryFilter) {
          categoryFilter.addEventListener('change', (e) => {
            this.updateSearchResults(input?.value, e.target.value, results);
          });
        }

        // Setup tool card click handlers
        document.querySelectorAll('.tool-card').forEach(card => {
          card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('favorite-btn')) {
              const toolId = card.dataset.toolId;
              this.openTool(toolId);
              window.uiEngine.closeModal(modalId);
            }
          });
        });
      }, 100);
    } catch (error) {
      console.error('Error showing search panel:', error);
    }
  }

  /**
   * Update search results
   */
  updateSearchResults(query, category, resultsContainer) {
    try {
      if (!resultsContainer) return;

      const results = this.search(query, { category, limit: 20 });

      resultsContainer.innerHTML = `
        <h3>${query ? `Results for "${query}"` : 'All Tools'}</h3>
        <div class="tool-grid">
          ${results.map(tool => `
            <div class="tool-card" data-tool-id="${tool.id}">
              <div class="tool-header">
                <strong>${tool.name}</strong>
                <button class="favorite-btn ${this.favorites.has(tool.id) ? 'active' : ''}"
                        onclick="window.advancedSearch.toggleFavorite('${tool.id}'); event.stopPropagation();">
                  ${this.favorites.has(tool.id) ? '★' : '☆'}
                </button>
              </div>
              <div class="tool-description">${tool.description || ''}</div>
              <div class="tool-category">${tool.category || ''}</div>
            </div>
          `).join('')}
        </div>
      `;

      // Setup click handlers for new cards
      resultsContainer.querySelectorAll('.tool-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (!e.target.classList.contains('favorite-btn')) {
            const toolId = card.dataset.toolId;
            this.openTool(toolId);
          }
        });
      });
    } catch (error) {
      console.error('Error updating search results:', error);
    }
  }

  /**
   * Update suggestions
   */
  updateSuggestions(query, suggestionsContainer) {
    try {
      if (!suggestionsContainer) return;

      const suggestions = this.getSuggestions(query);

      if (suggestions.length === 0) {
        suggestionsContainer.style.display = 'none';
        return;
      }

      suggestionsContainer.style.display = 'block';
      suggestionsContainer.innerHTML = suggestions.map(s => `
        <div class="suggestion-item">${s}</div>
      `).join('');

      suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          const input = document.getElementById('advanced-search-input');
          if (input) {
            input.value = item.textContent;
            input.dispatchEvent(new Event('input'));
          }
        });
      });
    } catch (error) {
      console.error('Error updating suggestions:', error);
    }
  }

  /**
   * Open tool
   */
  openTool(toolId) {
    try {
      this.trackUsage(toolId);

      if (window.openTool) {
        window.openTool(toolId);
      } else if (window.toolOrchestrator) {
        window.toolOrchestrator.mountTool(toolId);
      }
    } catch (error) {
      console.error('Error opening tool:', error);
    }
  }

  /**
   * Save/load methods
   */
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

// Export singleton instance
export const advancedSearch = new AdvancedSearch();
export { AdvancedSearch };
