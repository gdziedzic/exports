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

    // Calculate scores for different fields with null safety
    const nameScore = tool.name ? fuzzyScore(query, tool.name) : 0;
    const idScore = tool.id ? fuzzyScore(query, tool.id) : 0;
    const descScore = tool.description ? fuzzyScore(query, tool.description) * 0.7 : 0;
    const categoryScore = tool.category ? fuzzyScore(query, tool.category) * 0.5 : 0;
    const keywordsScore = tool.keywords && Array.isArray(tool.keywords) && tool.keywords.length > 0
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
    if (prioritizeFavorites && tool.id && favorites.includes(tool.id)) {
      score += 15;
    }

    // Bonus for recently used
    const recentEntry = tool.id ? recentTools.find(r => r?.toolId === tool.id) : null;
    if (recentEntry) {
      score += 5;
    }

    return {
      tool,
      score,
      isFavorite: tool.id ? favorites.includes(tool.id) : false,
      isRecent: !!recentEntry,
      matchDetails: {
        nameScore,
        idScore,
        descScore,
        categoryScore,
        keywordsScore
      }
    };
  }).filter(r => r !== null); // Remove invalid entries

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
      return (a.tool?.name || '').localeCompare(b.tool?.name || '');
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
