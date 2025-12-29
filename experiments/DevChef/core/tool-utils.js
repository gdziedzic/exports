/**
 * DevChef Tool Utilities Library
 *
 * Shared utilities to reduce duplication across 33+ tools.
 * Provides common functionality for clipboard, status messages,
 * text processing, validation, and more.
 *
 * @version 1.0.0
 */

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @param {Object} options - Options for feedback
 * @param {Function} options.onSuccess - Success callback
 * @param {Function} options.onError - Error callback
 * @returns {Promise<void>}
 */
export async function copyToClipboard(text, options = {}) {
  const { onSuccess, onError } = options;

  try {
    await navigator.clipboard.writeText(text);
    if (onSuccess) {
      onSuccess();
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    if (onError) {
      onError(error);
    }
  }
}

/**
 * Show status message in a container
 * @param {HTMLElement} container - Container element
 * @param {string} message - Status message
 * @param {string} type - Type: 'success', 'error', 'info', 'warning'
 */
export function showStatus(container, message, type = 'info') {
  if (!container) return;

  const statusEl = container.querySelector('#status, .status, [data-status]');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = message ? 'block' : 'none';
  }
}

/**
 * Show error message in error container
 * @param {HTMLElement} container - Container element
 * @param {string} message - Error message
 */
export function showError(container, message) {
  if (!container) return;

  const errorEl = container.querySelector('#error-message, .error-message, [data-error]');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('visible');
    errorEl.style.display = 'block';
  }
}

/**
 * Hide error message
 * @param {HTMLElement} container - Container element
 */
export function hideError(container) {
  if (!container) return;

  const errorEl = container.querySelector('#error-message, .error-message, [data-error]');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
    errorEl.style.display = 'none';
  }
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
  if (!text) return '';
  const str = String(text).trim();
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength).trim() + '...';
}

/**
 * Escape HTML for safe display
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Unescape HTML entities
 * @param {string} html - HTML to unescape
 * @returns {string} Unescaped text
 */
export function unescapeHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Download text as file
 * @param {string} content - File content
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type (default: text/plain)
 */
export function downloadAsFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Save tool state to localStorage
 * @param {string} toolId - Tool ID
 * @param {Object} state - State object to save
 */
export function saveToolState(toolId, state) {
  try {
    const key = `devchef-tool-${toolId}`;
    const data = {
      ...state,
      savedAt: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to save state for ${toolId}:`, error);
  }
}

/**
 * Load tool state from localStorage
 * @param {string} toolId - Tool ID
 * @returns {Object|null} Saved state or null
 */
export function loadToolState(toolId) {
  try {
    const key = `devchef-tool-${toolId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Failed to load state for ${toolId}:`, error);
    return null;
  }
}

/**
 * Validate JSON string
 * @param {string} jsonString - JSON string to validate
 * @returns {Object} { valid: boolean, parsed: any, error: string|null }
 */
export function isValidJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    return { valid: true, parsed, error: null };
  } catch (error) {
    return { valid: false, parsed: null, error: error.message };
  }
}

/**
 * Validate URL string
 * @param {string} urlString - URL string to validate
 * @returns {boolean} True if valid URL
 */
export function isValidURL(urlString) {
  try {
    new URL(urlString);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * querySelector shorthand
 * @param {string} selector - CSS selector
 * @param {HTMLElement} context - Context element (default: document)
 * @returns {HTMLElement|null} Selected element
 */
export function qs(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * querySelectorAll shorthand (returns Array)
 * @param {string} selector - CSS selector
 * @param {HTMLElement} context - Context element (default: document)
 * @returns {Array<HTMLElement>} Array of selected elements
 */
export function qsa(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/**
 * Count words in text
 * @param {string} text - Text to count
 * @returns {number} Word count
 */
export function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Count lines in text
 * @param {string} text - Text to count
 * @returns {number} Line count
 */
export function countLines(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.split('\n').length;
}

/**
 * Format number with thousands separator
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Generate unique ID
 * @param {string} prefix - Optional prefix
 * @returns {string} Unique ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Deep clone object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    console.error('Failed to deep clone:', error);
    return obj;
  }
}

/**
 * Check if object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} True if empty
 */
export function isEmpty(obj) {
  if (obj == null) return true;
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert string to kebab-case
 * @param {string} str - String to convert
 * @returns {string} Kebab-case string
 */
export function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert string to camelCase
 * @param {string} str - String to convert
 * @returns {string} camelCase string
 */
export function toCamelCase(str) {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^(.)/, (_, c) => c.toLowerCase());
}

/**
 * Sort object keys alphabetically
 * @param {Object} obj - Object to sort
 * @returns {Object} Object with sorted keys
 */
export function sortObjectKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);

  return Object.keys(obj)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = sortObjectKeys(obj[key]);
      return sorted;
    }, {});
}

/**
 * Get object value by path
 * @param {Object} obj - Object to query
 * @param {string} path - Path (e.g., 'user.profile.name')
 * @param {any} defaultValue - Default value if path not found
 * @returns {any} Value at path or default
 */
export function getValueByPath(obj, path, defaultValue = undefined) {
  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result == null || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }

  return result !== undefined ? result : defaultValue;
}

/**
 * Create toast notification helper
 * @param {string} message - Toast message
 * @param {Object} options - Toast options
 */
export function showToast(message, options = {}) {
  const { type = 'info', duration = 3000 } = options;

  // Try to use DevChef's UI engine if available
  if (window.uiEngine && typeof window.uiEngine.showToast === 'function') {
    window.uiEngine.showToast(message, { type, duration });
    return;
  }

  // Fallback: simple console log
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✓' : 'ℹ';
  console.log(`${prefix} ${message}`);
}
