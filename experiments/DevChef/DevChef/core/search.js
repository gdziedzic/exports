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
    minScore = 20,
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

    // Combined score - heavily weighted towards name
    let baseScore;
    if (nameScore > 50) {
      // If name matches well, use name score primarily
      baseScore = nameScore + (descScore * 0.1) + (categoryScore * 0.1);
    } else {
      // If name doesn't match well, allow description/category to contribute more
      baseScore = Math.max(
        nameScore * 2.0,  // Double weight for name even in weak matches
        descScore,
        categoryScore
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
        categoryScore
      }
    };
  }).filter(r => r !== null); // Remove invalid entries

  // Filter and sort results - only include tools with actual matches (score > 0)
  const filtered = results.filter(r => r.score > minScore);

  // Debug logging for search
  if (query && filtered.length < results.length) {
    console.log(`Filtered from ${results.length} to ${filtered.length} tools (query: "${query}")`);
  }

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
