/**
 * DevChef Tool Registry
 * Manages all loaded tools (both built-in and user tools)
 */

export const ToolRegistry = {
  tools: [],

  /**
   * Register a new tool
   * @param {Object} toolData - {manifest, templateHtml, style, module}
   */
  register(toolData) {
    // Check if tool with this ID already exists
    const existing = this.tools.findIndex(t => t.manifest.id === toolData.manifest.id);
    if (existing !== -1) {
      console.warn(`Tool ${toolData.manifest.id} already registered, replacing...`);
      this.tools[existing] = toolData;
    } else {
      this.tools.push(toolData);
    }
  },

  /**
   * Get all tool manifests
   * @returns {Array} Array of tool manifests
   */
  all() {
    return this.tools.map(t => t.manifest);
  },

  /**
   * Get a specific tool by ID
   * @param {string} id - Tool ID
   * @returns {Object|null} Tool data or null if not found
   */
  get(id) {
    return this.tools.find(t => t.manifest.id === id) || null;
  },

  /**
   * Get tools by category
   * @param {string} category - Category name
   * @returns {Array} Array of tool manifests in that category
   */
  getByCategory(category) {
    return this.tools
      .filter(t => t.manifest.category === category)
      .map(t => t.manifest);
  },

  /**
   * Get all unique categories
   * @returns {Array} Array of category names
   */
  getCategories() {
    const categories = new Set(this.tools.map(t => t.manifest.category || "Uncategorized"));
    return Array.from(categories).sort();
  },

  /**
   * Clear all registered tools
   */
  clear() {
    this.tools = [];
  }
};
