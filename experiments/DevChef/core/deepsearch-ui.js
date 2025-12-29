/**
 * DevChef Deep Search UI Module
 *
 * Provides UI components for deep search functionality:
 * - Search modal with toggle
 * - Filter checkboxes for content types
 * - Grouped results display
 * - Result actions (open tool, copy, etc.)
 */

import { unifiedSearch as deepSearch, RESULT_TYPES } from './search-unified.js';
import { openTool } from './ui.js';
import { storage } from './storage.js';

// Type display names
const TYPE_LABELS = {
  [RESULT_TYPES.TOOL]: 'Tools',
  [RESULT_TYPES.TOOL_STATE]: 'Tool States',
  [RESULT_TYPES.SNIPPET]: 'Snippets',
  [RESULT_TYPES.WORKFLOW]: 'Workflows',
  [RESULT_TYPES.CLIPBOARD]: 'Clipboard History',
  [RESULT_TYPES.PRESET]: 'Presets'
};

// Type icons
const TYPE_ICONS = {
  [RESULT_TYPES.TOOL]: '🔧',
  [RESULT_TYPES.TOOL_STATE]: '💾',
  [RESULT_TYPES.SNIPPET]: '📋',
  [RESULT_TYPES.WORKFLOW]: '⚙️',
  [RESULT_TYPES.CLIPBOARD]: '📎',
  [RESULT_TYPES.PRESET]: '⭐'
};

class DeepSearchUI {
  constructor() {
    this.modal = null;
    this.searchInput = null;
    this.resultsContainer = null;
    this.isOpen = false;
    this.currentResults = [];
    this.selectedIndex = 0;
    this.enabledTypes = new Set(Object.values(RESULT_TYPES));
    this.deepModeEnabled = true; // Default to deep search mode
  }

  /**
   * Show deep search modal
   */
  show(context) {
    if (this.isOpen) return;

    this.isOpen = true;
    this.createModal(context);
    this.attachEventListeners(context);
    this.searchInput.focus();

    // Initialize index if needed
    if (!deepSearch.isIndexed) {
      this.showLoadingIndicator();
      deepSearch.initialize();
      this.hideLoadingIndicator();
    }
  }

  /**
   * Hide deep search modal
   */
  hide() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.modal?.remove();
    this.modal = null;
    this.searchInput = null;
    this.resultsContainer = null;
    this.currentResults = [];
    this.selectedIndex = 0;
  }

  /**
   * Create modal UI
   */
  createModal(context) {
    // Create modal overlay
    this.modal = document.createElement('div');
    this.modal.className = 'deep-search-modal';
    this.modal.innerHTML = `
      <div class="deep-search-overlay"></div>
      <div class="deep-search-container">
        <div class="deep-search-header">
          <div class="deep-search-title">
            <span class="deep-search-icon">🔍</span>
            <span>Deep Search</span>
          </div>
          <div class="deep-search-actions">
            <button class="deep-search-rebuild" title="Rebuild search index">
              <span>🔄</span>
            </button>
            <button class="deep-search-close" title="Close (Esc)">
              <span>✕</span>
            </button>
          </div>
        </div>

        <div class="deep-search-input-container">
          <input
            type="text"
            class="deep-search-input"
            placeholder="Search across all tools, states, snippets, workflows..."
            autocomplete="off"
            spellcheck="false"
          />
          <div class="deep-search-toggle">
            <label class="deep-search-toggle-label">
              <input type="checkbox" class="deep-search-mode-toggle" ${this.deepModeEnabled ? 'checked' : ''}>
              <span class="deep-search-toggle-text">Deep Search</span>
            </label>
          </div>
        </div>

        <div class="deep-search-filters">
          <span class="deep-search-filters-label">Search in:</span>
          ${this.createFilterCheckboxes()}
        </div>

        <div class="deep-search-stats">
          <span class="deep-search-result-count">Ready to search</span>
          <span class="deep-search-index-info"></span>
        </div>

        <div class="deep-search-results">
          <div class="deep-search-empty">
            Start typing to search across all saved content...
          </div>
        </div>

        <div class="deep-search-footer">
          <div class="deep-search-shortcuts">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Open</span>
            <span><kbd>Esc</kbd> Close</span>
            <span><kbd>Ctrl+Shift+F</kbd> Toggle</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Store references
    this.searchInput = this.modal.querySelector('.deep-search-input');
    this.resultsContainer = this.modal.querySelector('.deep-search-results');

    // Update index info
    this.updateIndexInfo();
  }

  /**
   * Create filter checkboxes
   */
  createFilterCheckboxes() {
    return Object.entries(TYPE_LABELS)
      .map(([type, label]) => `
        <label class="deep-search-filter">
          <input
            type="checkbox"
            class="deep-search-filter-checkbox"
            data-type="${type}"
            ${this.enabledTypes.has(type) ? 'checked' : ''}
          >
          <span>${TYPE_ICONS[type]} ${label}</span>
        </label>
      `)
      .join('');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners(context) {
    // Search input
    this.searchInput.addEventListener('input', (e) => {
      this.handleSearch(e.target.value, context);
    });

    // Keyboard navigation
    this.searchInput.addEventListener('keydown', (e) => {
      this.handleKeydown(e, context);
    });

    // Filter checkboxes
    this.modal.querySelectorAll('.deep-search-filter-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const type = e.target.dataset.type;
        if (e.target.checked) {
          this.enabledTypes.add(type);
        } else {
          this.enabledTypes.delete(type);
        }
        // Re-run search with new filters
        this.handleSearch(this.searchInput.value, context);
      });
    });

    // Deep mode toggle
    const modeToggle = this.modal.querySelector('.deep-search-mode-toggle');
    modeToggle.addEventListener('change', (e) => {
      this.deepModeEnabled = e.target.checked;
      this.handleSearch(this.searchInput.value, context);
    });

    // Rebuild button
    const rebuildBtn = this.modal.querySelector('.deep-search-rebuild');
    rebuildBtn.addEventListener('click', () => {
      this.rebuildIndex();
    });

    // Close button
    const closeBtn = this.modal.querySelector('.deep-search-close');
    closeBtn.addEventListener('click', () => {
      this.hide();
    });

    // Click overlay to close
    const overlay = this.modal.querySelector('.deep-search-overlay');
    overlay.addEventListener('click', () => {
      this.hide();
    });

    // Prevent clicks in container from closing
    const container = this.modal.querySelector('.deep-search-container');
    container.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Handle search input
   */
  handleSearch(query, context) {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      this.showEmptyState();
      return;
    }

    // Show loading
    this.showLoadingIndicator();

    // Perform search
    const types = this.deepModeEnabled ? Array.from(this.enabledTypes) : null;

    deepSearch.search(trimmedQuery, { types }, (result) => {
      this.hideLoadingIndicator();
      this.displayResults(result, context);
    });
  }

  /**
   * Display search results
   */
  displayResults(result, context) {
    const { query, results, grouped, total } = result;

    this.currentResults = results;
    this.selectedIndex = 0;

    // Update result count
    const countEl = this.modal.querySelector('.deep-search-result-count');
    countEl.textContent = `Found in ${total} location${total !== 1 ? 's' : ''}`;

    // Clear results container
    this.resultsContainer.innerHTML = '';

    if (total === 0) {
      this.resultsContainer.innerHTML = `
        <div class="deep-search-empty">
          No results found for "${query}"
        </div>
      `;
      return;
    }

    // Display grouped results
    for (const [type, typeResults] of Object.entries(grouped)) {
      const groupEl = this.createResultGroup(type, typeResults, context);
      this.resultsContainer.appendChild(groupEl);
    }

    // Highlight first result
    this.updateSelectedResult();
  }

  /**
   * Create result group
   */
  createResultGroup(type, results, context) {
    const groupEl = document.createElement('div');
    groupEl.className = 'deep-search-group';

    const headerEl = document.createElement('div');
    headerEl.className = 'deep-search-group-header';
    headerEl.innerHTML = `
      <span class="deep-search-group-icon">${TYPE_ICONS[type]}</span>
      <span class="deep-search-group-title">${TYPE_LABELS[type]}</span>
      <span class="deep-search-group-count">${results.length}</span>
    `;
    groupEl.appendChild(headerEl);

    const itemsEl = document.createElement('div');
    itemsEl.className = 'deep-search-group-items';

    results.forEach((result, index) => {
      const itemEl = this.createResultItem(result, context);
      itemsEl.appendChild(itemEl);
    });

    groupEl.appendChild(itemsEl);

    return groupEl;
  }

  /**
   * Create result item
   */
  createResultItem(result, context) {
    const itemEl = document.createElement('div');
    itemEl.className = 'deep-search-result-item';
    itemEl.dataset.resultId = result.id;

    itemEl.innerHTML = `
      <div class="deep-search-result-content">
        <div class="deep-search-result-location">${result.location}</div>
        <div class="deep-search-result-preview">${result.highlightedPreview}</div>
        ${result.timestamp ? `<div class="deep-search-result-timestamp">${this.formatTimestamp(result.timestamp)}</div>` : ''}
      </div>
      <div class="deep-search-result-actions">
        <span class="deep-search-result-score">${Math.round(result.score)}</span>
      </div>
    `;

    // Click to open
    itemEl.addEventListener('click', () => {
      this.openResult(result, context);
    });

    return itemEl;
  }

  /**
   * Open search result
   */
  openResult(result, context) {
    switch (result.type) {
      case RESULT_TYPES.TOOL_STATE:
        // Open tool and restore state
        if (result.toolId) {
          storage.saveToolState(result.toolId, result.data);
          openTool(result.toolId, context);
          this.hide();
        }
        break;

      case RESULT_TYPES.SNIPPET:
        // Open snippets library with this snippet selected
        // For now, just copy to clipboard
        if (result.data.content) {
          navigator.clipboard.writeText(result.data.content);
          this.showToast('Snippet copied to clipboard');
        }
        break;

      case RESULT_TYPES.WORKFLOW:
        // Restore workflow
        if (result.toolId && result.data) {
          storage.saveToolState(result.toolId, {
            input: result.data.input,
            output: result.data.output,
            settings: result.data.settings
          });
          openTool(result.toolId, context);
          this.hide();
        }
        break;

      case RESULT_TYPES.CLIPBOARD:
        // Copy to clipboard
        if (result.data.text) {
          navigator.clipboard.writeText(result.data.text);
          this.showToast('Copied to clipboard');
        }
        break;

      case RESULT_TYPES.PRESET:
        // Open tool and load preset
        if (result.toolId && result.data) {
          storage.saveToolState(result.toolId, result.data);
          openTool(result.toolId, context);
          this.hide();
        }
        break;
    }
  }

  /**
   * Handle keyboard navigation
   */
  handleKeydown(e, context) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.hide();
        break;

      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentResults.length - 1);
        this.updateSelectedResult();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelectedResult();
        break;

      case 'Enter':
        e.preventDefault();
        if (this.currentResults[this.selectedIndex]) {
          this.openResult(this.currentResults[this.selectedIndex], context);
        }
        break;
    }
  }

  /**
   * Update selected result highlight
   */
  updateSelectedResult() {
    const items = this.modal.querySelectorAll('.deep-search-result-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('deep-search-result-selected');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('deep-search-result-selected');
      }
    });
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    this.currentResults = [];
    this.selectedIndex = 0;
    this.resultsContainer.innerHTML = `
      <div class="deep-search-empty">
        Start typing to search across all saved content...
      </div>
    `;

    const countEl = this.modal.querySelector('.deep-search-result-count');
    countEl.textContent = 'Ready to search';
  }

  /**
   * Show loading indicator
   */
  showLoadingIndicator() {
    const countEl = this.modal.querySelector('.deep-search-result-count');
    countEl.innerHTML = '<span class="deep-search-loading">Searching...</span>';
  }

  /**
   * Hide loading indicator
   */
  hideLoadingIndicator() {
    // Done - results will update the count
  }

  /**
   * Rebuild search index
   */
  rebuildIndex() {
    this.showLoadingIndicator();

    setTimeout(() => {
      deepSearch.clearAndRebuild();
      this.updateIndexInfo();
      this.hideLoadingIndicator();
      this.showToast('Search index rebuilt');

      // Re-run current search
      if (this.searchInput.value) {
        this.handleSearch(this.searchInput.value, {});
      }
    }, 100);
  }

  /**
   * Update index information
   */
  updateIndexInfo() {
    const stats = deepSearch.getStats();
    const infoEl = this.modal?.querySelector('.deep-search-index-info');

    if (infoEl && stats) {
      const indexAge = stats.indexAge ? this.formatDuration(stats.indexAge) : 'just now';
      infoEl.textContent = `${stats.total} items indexed ${indexAge}`;
    }
  }

  /**
   * Format timestamp
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  /**
   * Format duration
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    if (seconds > 10) return `${seconds}s ago`;
    return 'just now';
  }

  /**
   * Show toast notification
   */
  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'deep-search-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('deep-search-toast-show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('deep-search-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
}

// Singleton instance
const deepSearchUI = new DeepSearchUI();

/**
 * Show deep search modal
 */
export function showDeepSearch(context = {}) {
  deepSearchUI.show(context);
}

/**
 * Hide deep search modal
 */
export function hideDeepSearch() {
  deepSearchUI.hide();
}

/**
 * Toggle deep search modal
 */
export function toggleDeepSearch(context = {}) {
  if (deepSearchUI.isOpen) {
    deepSearchUI.hide();
  } else {
    deepSearchUI.show(context);
  }
}

export { deepSearchUI };
