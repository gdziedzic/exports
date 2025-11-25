/**
 * DevChef V2 UI Rendering System
 * Handles tool rendering, workspace management, and enhanced UI features
 */

import { ToolRegistry } from './registry.js';
import { storage } from './storage.js';
import { searchTools, highlightMatches, groupByCategory } from './search.js';
import { notifications } from './notifications.js';

let currentToolId = null;
let workspaceStyleElement = null;

/**
 * Open and render a tool in the workspace
 * @param {string} id - Tool ID
 * @param {Object} context - Global context object
 * @param {string} workspace - Workspace selector (default: "#workspace")
 */
export function openTool(id, context, workspace = "#workspace") {
  const tool = ToolRegistry.get(id);

  if (!tool) {
    console.error(`Tool ${id} not found`);
    notifications.error(`Tool ${id} not found`);
    return;
  }

  currentToolId = id;

  // Add to history
  storage.addToHistory(id, tool.manifest.name);

  // Get workspace container
  const container = document.querySelector(workspace);
  if (!container) {
    console.error("Workspace container not found");
    return;
  }

  // Clear previous content
  container.innerHTML = "";

  // Remove previous tool styles
  if (workspaceStyleElement) {
    workspaceStyleElement.remove();
  }

  // Inject tool template
  container.innerHTML = tool.templateHtml;

  // Inject tool styles
  if (tool.style) {
    workspaceStyleElement = document.createElement("style");
    workspaceStyleElement.innerHTML = tool.style;
    container.appendChild(workspaceStyleElement);
  }

  // Restore tool state if available
  const savedState = storage.getToolState(id);
  if (savedState) {
    context.restoredState = savedState;
  }

  // Initialize the tool (support both old and new formats)
  try {
    if (tool.module.init) {
      // New format: direct export
      console.log(`Initializing tool (new format): ${tool.manifest.name}`);
      tool.module.init({ container, ...context });
    } else if (tool.module.DevChefTool && tool.module.DevChefTool.init) {
      // Old format: DevChefTool object
      console.log(`Initializing tool (old format): ${tool.manifest.name}`);
      tool.module.DevChefTool.init(container, context);
    } else {
      console.warn(`Tool ${tool.manifest.name} has no init function`);
    }
  } catch (error) {
    console.error(`Error initializing tool ${tool.manifest.name}:`, error);
    notifications.error(`Failed to initialize tool: ${error.message}`);
  }

  // Set up input change handler
  context.onInputChanged = (input) => {
    if (tool.module.DevChefTool && tool.module.DevChefTool.onInput) {
      try {
        const result = tool.module.DevChefTool.onInput(input, context);
        if (result && result.output !== undefined) {
          context.setOutput(result.output);
        }
        if (result && result.errors) {
          console.error("Tool errors:", result.errors);
        }
      } catch (error) {
        console.error("Error in tool onInput:", error);
        context.setOutput(`Error: ${error.message}`);
      }
    }
  };

  // Trigger initial input processing if there's input
  if (context.input) {
    context.onInputChanged(context.input);
  }

  // Update sidebar active state
  updateSidebarActiveState(id);

  // Update recent tools display
  updateRecentTools(context);

  console.log(`Opened tool: ${tool.manifest.name}`);
}

/**
 * Update sidebar to highlight active tool
 * @param {string} toolId - Currently active tool ID
 */
function updateSidebarActiveState(toolId) {
  const toolItems = document.querySelectorAll('.tool-item');
  toolItems.forEach(item => {
    if (item.dataset.toolId === toolId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

/**
 * Render the tool list in the sidebar
 * @param {Object} context - Global context object
 * @param {string} searchQuery - Optional search query to filter tools
 */
export function renderToolList(context, searchQuery = "") {
  const sidebar = document.querySelector("#tool-list");
  if (!sidebar) {
    console.error("Tool list container not found");
    return;
  }

  try {
    sidebar.innerHTML = "";

    const tools = ToolRegistry.all();
    console.log(`Rendering ${tools.length} tools, search query: "${searchQuery}"`);

    const favorites = storage.getFavorites();
    const recentTools = storage.getRecentTools();

    // Use fuzzy search
    const searchResults = searchTools(tools, searchQuery, {
      favorites,
      recentTools,
      prioritizeFavorites: true
    });

    console.log(`Search returned ${searchResults.length} results`);

    // Group by category
    const grouped = groupByCategory(searchResults);
    const categories = Object.keys(grouped).sort();

  categories.forEach(category => {
    const categoryTools = grouped[category];

    // Create category section
    const categorySection = document.createElement("div");
    categorySection.className = "category-section";

    const categoryHeader = document.createElement("div");
    categoryHeader.className = "category-header";
    categoryHeader.textContent = category;
    categorySection.appendChild(categoryHeader);

    categoryTools.forEach(({ tool: manifest, isFavorite, isRecent }) => {
      const toolItem = document.createElement("div");
      toolItem.className = "tool-item";
      toolItem.dataset.toolId = manifest.id;

      // Add favorite and recent indicators
      const indicators = [];
      if (isFavorite) {
        indicators.push('<span class="tool-indicator favorite" title="Favorite">★</span>');
      }
      if (isRecent) {
        indicators.push('<span class="tool-indicator recent" title="Recently used">⏱</span>');
      }

      toolItem.innerHTML = `
        <span class="tool-name">${manifest.name}</span>
        ${indicators.length > 0 ? `<span class="tool-indicators">${indicators.join('')}</span>` : ''}
      `;

      toolItem.addEventListener("click", () => {
        openTool(manifest.id, context);
      });

      // Right-click to toggle favorite
      toolItem.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        toggleFavorite(manifest.id);
        renderToolList(context, searchQuery);
        notifications.success(
          storage.isFavorite(manifest.id)
            ? `Added ${manifest.name} to favorites`
            : `Removed ${manifest.name} from favorites`
        );
      });

      categorySection.appendChild(toolItem);
    });

    sidebar.appendChild(categorySection);
  });

    // Show "no results" message if no tools match
    if (searchQuery && sidebar.children.length === 0) {
      sidebar.innerHTML = '<div class="no-results">No tools found</div>';
    }
  } catch (error) {
    console.error('Error rendering tool list:', error);
    sidebar.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
    notifications.error(`Failed to render tool list: ${error.message}`);
  }
}

/**
 * Show command palette for quick tool access
 * @param {Object} context - Global context object
 */
export function showCommandPalette(context) {
  // Check if palette already exists
  let palette = document.querySelector("#command-palette");

  if (!palette) {
    palette = createCommandPalette(context);
    document.body.appendChild(palette);
  }

  palette.style.display = "flex";
  const input = palette.querySelector("input");
  input.value = "";
  input.focus();

  // Render all tools initially
  renderPaletteResults("", palette, context);
}

/**
 * Create command palette element
 * @param {Object} context - Global context object
 * @returns {HTMLElement} Palette element
 */
function createCommandPalette(context) {
  const palette = document.createElement("div");
  palette.id = "command-palette";
  palette.className = "command-palette";

  palette.innerHTML = `
    <div class="palette-content">
      <input type="text" placeholder="Search tools..." class="palette-input">
      <div class="palette-results"></div>
    </div>
  `;

  const input = palette.querySelector("input");
  const results = palette.querySelector(".palette-results");

  // Search on input
  input.addEventListener("input", (e) => {
    renderPaletteResults(e.target.value, palette, context);
  });

  // Close on escape
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      palette.style.display = "none";
    }
  });

  // Close on backdrop click
  palette.addEventListener("click", (e) => {
    if (e.target === palette) {
      palette.style.display = "none";
    }
  });

  return palette;
}

/**
 * Render filtered results in command palette
 * @param {string} query - Search query
 * @param {HTMLElement} palette - Palette element
 * @param {Object} context - Global context
 */
function renderPaletteResults(query, palette, context) {
  const results = palette.querySelector(".palette-results");
  results.innerHTML = "";

  const tools = ToolRegistry.all();
  const favorites = storage.getFavorites();
  const recentTools = storage.getRecentTools();

  // Use fuzzy search with favorites prioritization
  const searchResults = searchTools(tools, query, {
    favorites,
    recentTools,
    prioritizeFavorites: true,
    maxResults: 30
  });

  // Add sections for recent and favorites if no query
  if (!query) {
    // Recent tools section
    const recent = storage.getRecentTools(5);
    if (recent.length > 0) {
      const recentSection = document.createElement("div");
      recentSection.className = "palette-section";
      recentSection.innerHTML = '<div class="palette-section-title">Recently Used</div>';

      recent.forEach(entry => {
        const tool = ToolRegistry.get(entry.toolId);
        if (!tool) return;

        const item = createPaletteItem(tool.manifest, true, false, context, palette);
        recentSection.appendChild(item);
      });

      results.appendChild(recentSection);
    }

    // Favorites section
    if (favorites.length > 0) {
      const favSection = document.createElement("div");
      favSection.className = "palette-section";
      favSection.innerHTML = '<div class="palette-section-title">Favorites</div>';

      favorites.slice(0, 5).forEach(toolId => {
        const tool = ToolRegistry.get(toolId);
        if (!tool) return;

        const item = createPaletteItem(tool.manifest, false, true, context, palette);
        favSection.appendChild(item);
      });

      results.appendChild(favSection);
    }
  }

  // Search results
  searchResults.forEach(({ tool: manifest, isFavorite, isRecent }, index) => {
    const item = createPaletteItem(manifest, isRecent, isFavorite, context, palette);
    if (index === 0) {
      item.classList.add('selected');
    }
    results.appendChild(item);
  });

  if (searchResults.length === 0 && (query || (favorites.length === 0 && recentTools.length === 0))) {
    results.innerHTML = '<div class="palette-empty">No tools found</div>';
  }

  // Set up keyboard navigation
  setupPaletteKeyboardNav(palette, context);
}

/**
 * Create a palette item element
 * @param {Object} manifest - Tool manifest
 * @param {boolean} isRecent - Is recently used
 * @param {boolean} isFavorite - Is favorite
 * @param {Object} context - Global context
 * @param {HTMLElement} palette - Palette element
 * @returns {HTMLElement} Palette item element
 */
function createPaletteItem(manifest, isRecent, isFavorite, context, palette) {
  const item = document.createElement("div");
  item.className = "palette-item";
  item.dataset.toolId = manifest.id;

  const indicators = [];
  if (isFavorite) indicators.push('<span class="palette-indicator favorite">★</span>');
  if (isRecent) indicators.push('<span class="palette-indicator recent">⏱</span>');

  item.innerHTML = `
    <div class="palette-item-header">
      <div class="palette-item-name">${manifest.name}</div>
      ${indicators.length > 0 ? `<div class="palette-item-indicators">${indicators.join('')}</div>` : ''}
    </div>
    ${manifest.description ? `<div class="palette-item-description">${manifest.description}</div>` : ''}
    <div class="palette-item-category">${manifest.category || "Uncategorized"}</div>
  `;

  item.addEventListener("click", () => {
    openTool(manifest.id, context);
    palette.style.display = "none";
  });

  item.addEventListener("mouseenter", () => {
    // Remove selected from all items
    palette.querySelectorAll('.palette-item').forEach(i => i.classList.remove('selected'));
    // Add to this item
    item.classList.add('selected');
  });

  return item;
}

/**
 * Set up keyboard navigation for palette
 * @param {HTMLElement} palette - Palette element
 * @param {Object} context - Global context
 */
function setupPaletteKeyboardNav(palette, context) {
  const input = palette.querySelector('.palette-input');

  const keyHandler = (e) => {
    const items = Array.from(palette.querySelectorAll('.palette-item'));
    const selected = palette.querySelector('.palette-item.selected');
    let selectedIndex = items.indexOf(selected);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      items.forEach((item, i) => {
        item.classList.toggle('selected', i === selectedIndex);
      });
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      items.forEach((item, i) => {
        item.classList.toggle('selected', i === selectedIndex);
      });
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selected) {
        const toolId = selected.dataset.toolId;
        openTool(toolId, context);
        palette.style.display = "none";
      }
    }
  };

  // Remove old handler if exists
  input.removeEventListener('keydown', keyHandler);
  // Add new handler
  input.addEventListener('keydown', keyHandler);
}

/**
 * Get currently active tool ID
 * @returns {string|null} Current tool ID
 */
export function getCurrentToolId() {
  return currentToolId;
}

/**
 * Toggle favorite status for a tool
 * @param {string} toolId - Tool ID
 * @returns {boolean} New favorite status
 */
export function toggleFavorite(toolId) {
  return storage.toggleFavorite(toolId);
}

/**
 * Update recent tools display in sidebar
 * @param {Object} context - Global context
 */
export function updateRecentTools(context) {
  const recentContainer = document.querySelector('#recent-tools');
  if (!recentContainer) return;

  const recent = storage.getRecentTools(5);

  if (recent.length === 0) {
    recentContainer.innerHTML = '';
    recentContainer.style.display = 'none';
    return;
  }

  recentContainer.style.display = 'block';
  recentContainer.innerHTML = '<div class="recent-tools-title">Recent</div>';

  recent.forEach(entry => {
    const tool = ToolRegistry.get(entry.toolId);
    if (!tool) return;

    const item = document.createElement('div');
    item.className = 'recent-tool-item';
    item.textContent = tool.manifest.name;
    item.title = tool.manifest.description || tool.manifest.name;

    item.addEventListener('click', () => {
      openTool(entry.toolId, context);
    });

    recentContainer.appendChild(item);
  });
}

/**
 * Export settings and data
 */
export function exportSettings() {
  const data = storage.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `devchef-v2-export-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  notifications.success('Settings exported successfully');
}

/**
 * Import settings and data
 */
export async function importSettings() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const confirmed = await notifications.confirm(
        'This will replace your current settings. Continue?',
        { title: 'Import Settings' }
      );

      if (!confirmed) return;

      const success = storage.importData(data);

      if (success) {
        notifications.success('Settings imported successfully');
        // Reload page to apply new settings
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        notifications.error('Failed to import settings');
      }
    } catch (error) {
      console.error('Import error:', error);
      notifications.error(`Import failed: ${error.message}`);
    }
  });

  input.click();
}

/**
 * Clear all history
 * @param {Object} context - Global context
 */
export async function clearHistory(context) {
  const confirmed = await notifications.confirm(
    'This will clear all tool usage history. Continue?',
    { title: 'Clear History' }
  );

  if (confirmed) {
    storage.clearHistory();
    updateRecentTools(context);
    notifications.success('History cleared');
  }
}

/**
 * Show storage statistics
 */
export function showStorageStats() {
  const stats = storage.getStorageStats();

  notifications.info(
    `Storage: ${stats.totalKB} KB used\n` +
    `Favorites: ${stats.favorites}\n` +
    `History: ${stats.historyItems}\n` +
    `Tool States: ${stats.toolStates}`,
    { duration: 5000 }
  );
}
