/**
 * DevChef V2 Fuzzy Search System
 * Advanced search with scoring and ranking
 */

/**
 * Calculate fuzzy match score between query and text
 * @param {string} query - Search query
 * @param {string} text - Text to search in
 * @returns {number} Score (0-100, higher is better match)
 */
function fuzzyScore(query, text) {
  if (!query) return 100;
  if (!text) return 0;

  query = query.toLowerCase();
  text = text.toLowerCase();

  // Exact match gets highest score
  if (text === query) return 100;

  // Contains query as substring
  if (text.includes(query)) {
    const startBonus = text.startsWith(query) ? 20 : 0;
    const lengthRatio = query.length / text.length;
    return 80 + startBonus * lengthRatio;
  }

  // Fuzzy matching
  let score = 0;
  let queryIndex = 0;
  let lastMatchIndex = -1;
  let consecutiveMatches = 0;

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      // Match found
      score += 10;

      // Bonus for consecutive matches
      if (i === lastMatchIndex + 1) {
        consecutiveMatches++;
        score += consecutiveMatches * 2;
      } else {
        consecutiveMatches = 0;
      }

      // Bonus for matching at word start
      if (i === 0 || text[i - 1] === ' ' || text[i - 1] === '-') {
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

  // Penalty for unmatched query characters
  if (queryIndex < query.length) {
    return 0;
  }

  // Normalize score
  return Math.min(100, Math.max(0, score));
}

/**
 * Search tools with fuzzy matching
 * @param {Array} tools - Array of tool manifests
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Array} Sorted array of matching tools with scores
 */
export function searchTools(tools, query, options = {}) {
  const {
    maxResults = 50,
    minScore = 0,
    prioritizeFavorites = false,
    favorites = [],
    recentTools = []
  } = options;

  if (!query || query.trim() === '') {
    // No query - return all tools sorted by favorites and recent
    return tools.map(tool => ({
      tool,
      score: 100,
      isFavorite: favorites.includes(tool.id),
      isRecent: recentTools.some(r => r.toolId === tool.id)
    })).sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      if (a.isRecent && !b.isRecent) return -1;
      if (!a.isRecent && b.isRecent) return 1;
      return a.tool.name.localeCompare(b.tool.name);
    }).slice(0, maxResults);
  }

  const results = tools.map(tool => {
    // Calculate scores for different fields
    const nameScore = fuzzyScore(query, tool.name);
    const idScore = fuzzyScore(query, tool.id);
    const descScore = tool.description ? fuzzyScore(query, tool.description) * 0.7 : 0;
    const categoryScore = tool.category ? fuzzyScore(query, tool.category) * 0.5 : 0;
    const keywordsScore = tool.keywords
      ? Math.max(...tool.keywords.map(k => fuzzyScore(query, k))) * 0.6
      : 0;

    // Combined score (weighted)
    let score = Math.max(
      nameScore * 1.0,
      idScore * 0.9,
      descScore,
      categoryScore,
      keywordsScore
    );

    // Bonus for favorites
    if (prioritizeFavorites && favorites.includes(tool.id)) {
      score += 15;
    }

    // Bonus for recently used
    const recentEntry = recentTools.find(r => r.toolId === tool.id);
    if (recentEntry) {
      score += 5;
    }

    return {
      tool,
      score,
      isFavorite: favorites.includes(tool.id),
      isRecent: !!recentEntry,
      matchDetails: {
        nameScore,
        idScore,
        descScore,
        categoryScore,
        keywordsScore
      }
    };
  });

  // Filter and sort results
  return results
    .filter(r => r.score >= minScore)
    .sort((a, b) => {
      // Sort by score (descending)
      if (Math.abs(a.score - b.score) > 1) {
        return b.score - a.score;
      }
      // If scores are similar, prioritize favorites
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      // Then recent tools
      if (a.isRecent && !b.isRecent) return -1;
      if (!a.isRecent && b.isRecent) return 1;
      // Finally alphabetical
      return a.tool.name.localeCompare(b.tool.name);
    })
    .slice(0, maxResults);
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
 * Get search suggestions based on query
 * @param {string} query - Current query
 * @param {Array} tools - All tools
 * @returns {Array} Suggested queries
 */
export function getSearchSuggestions(query, tools) {
  if (!query || query.length < 2) return [];

  const suggestions = new Set();
  const lowerQuery = query.toLowerCase();

  tools.forEach(tool => {
    // Add category if it matches
    if (tool.category && tool.category.toLowerCase().includes(lowerQuery)) {
      suggestions.add(tool.category);
    }

    // Add keywords if they match
    if (tool.keywords) {
      tool.keywords.forEach(keyword => {
        if (keyword.toLowerCase().includes(lowerQuery)) {
          suggestions.add(keyword);
        }
      });
    }
  });

  return Array.from(suggestions).slice(0, 5);
}

/**
 * Filter tools by category
 * @param {Array} tools - All tools
 * @param {string} category - Category to filter by
 * @returns {Array} Filtered tools
 */
export function filterByCategory(tools, category) {
  return tools.filter(tool => tool.category === category);
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
