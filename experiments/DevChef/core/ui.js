/**
 * DevChef V2 UI Rendering System
 * Handles tool rendering, workspace management, and enhanced UI features
 */

import { ToolRegistry } from './registry.js';
import { storage } from './storage.js';
import { searchTools, highlightMatches, groupByCategory } from './search-unified.js';
import { notifications } from './notifications.js';
import { workflowSnapshots } from './workflowsnapshots.js';

let currentToolId = null;
let workspaceStyleElement = null;

/**
 * Open and render a tool in the workspace
 * @param {string} id - Tool ID
 * @param {Object} context - Global context object
 * @param {string} workspace - Workspace selector (default: "#workspace")
 * @param {boolean} updateUrl - Whether to update URL query parameter (default: true)
 */
export function openTool(id, context, workspace = "#workspace", updateUrl = true) {
  const tool = ToolRegistry.get(id);

  if (!tool) {
    console.error(`Tool ${id} not found`);
    notifications.error(`Tool ${id} not found`);
    return;
  }

  currentToolId = id;

  // Update URL query parameter to enable direct linking
  if (updateUrl) {
    const url = new URL(window.location);
    url.searchParams.set('tool', id);
    window.history.pushState({ toolId: id }, '', url);
  }

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

    // When searching, show results by relevance (no grouping)
    // When not searching, group by category
    if (searchQuery && searchQuery.trim() !== "") {
      // Search mode: Display results in relevance order without category grouping
      searchResults.forEach(({ tool: manifest, isFavorite, isRecent }) => {
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

        // Show category badge in search mode
        const categoryBadge = manifest.category
          ? `<span class="tool-category-badge">${manifest.category}</span>`
          : '';

        toolItem.innerHTML = `
          <span class="tool-name">${manifest.name}</span>
          ${categoryBadge}
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

        sidebar.appendChild(toolItem);
      });
    } else {
      // Browse mode: Group by category
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
    }

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
    `Tool States: ${stats.toolStates}\n` +
    `Workflow Snapshots: ${stats.workflowSnapshots}`,
    { duration: 5000 }
  );
}

/**
 * Save current workflow as a snapshot
 * @param {Object} context - Global context
 */
export async function saveCurrentWorkflow(context) {
  if (!workflowSnapshots) {
    notifications.error('Workflow snapshots not initialized');
    return;
  }

  if (!currentToolId) {
    notifications.warning('No tool is currently active');
    return;
  }

  // Create modal for snapshot name
  const modal = createSnapshotNameModal();
  document.body.appendChild(modal);

  // Handle form submission
  const form = modal.querySelector('form');
  const nameInput = modal.querySelector('#snapshot-name');
  const descInput = modal.querySelector('#snapshot-description');
  const cancelBtn = modal.querySelector('.cancel-btn');

  nameInput.focus();

  const cleanup = () => {
    modal.remove();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const description = descInput.value.trim();

    if (!name) {
      notifications.warning('Snapshot name is required');
      return;
    }

    try {
      // Get all tool states from storage
      const toolStates = storage.get('devchef-v2-tool-states') || {};

      // Save the snapshot
      const snapshot = workflowSnapshots.saveSnapshot({
        name,
        description,
        currentToolId,
        toolStates
      });

      notifications.success(`Workflow snapshot "${name}" saved`);
      cleanup();
    } catch (error) {
      console.error('Failed to save snapshot:', error);
      notifications.error(`Failed to save snapshot: ${error.message}`);
    }
  });

  cancelBtn.addEventListener('click', cleanup);

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      cleanup();
    }
  });

  // Close on escape
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  });
}

/**
 * Create modal for snapshot name input
 * @returns {HTMLElement} Modal element
 */
function createSnapshotNameModal() {
  const modal = document.createElement('div');
  modal.className = 'snapshot-modal-overlay';
  modal.innerHTML = `
    <div class="snapshot-modal">
      <h2>Save Workflow Snapshot</h2>
      <form>
        <div class="form-group">
          <label for="snapshot-name">Name *</label>
          <input
            type="text"
            id="snapshot-name"
            placeholder="e.g., API Testing Flow"
            required
            maxlength="100"
          />
        </div>
        <div class="form-group">
          <label for="snapshot-description">Description</label>
          <textarea
            id="snapshot-description"
            placeholder="Optional description of this workflow..."
            rows="3"
            maxlength="500"
          ></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="cancel-btn">Cancel</button>
          <button type="submit" class="save-btn">Save Snapshot</button>
        </div>
      </form>
    </div>
  `;
  return modal;
}

/**
 * Show workflow snapshots manager
 * @param {Object} context - Global context
 */
export function showWorkflowSnapshotsManager(context) {
  if (!workflowSnapshots) {
    notifications.error('Workflow snapshots not initialized');
    return;
  }

  // Create modal
  const modal = createSnapshotsManagerModal(context);
  document.body.appendChild(modal);

  // Render snapshots list
  renderSnapshotsList(modal, context);

  // Setup event handlers
  setupSnapshotsManagerEvents(modal, context);
}

/**
 * Create snapshots manager modal
 * @param {Object} context - Global context
 * @returns {HTMLElement} Modal element
 */
function createSnapshotsManagerModal(context) {
  const modal = document.createElement('div');
  modal.className = 'snapshots-manager-overlay';
  modal.innerHTML = `
    <div class="snapshots-manager">
      <div class="snapshots-header">
        <h2>Workflow Snapshots</h2>
        <button class="close-btn" title="Close">✕</button>
      </div>
      <div class="snapshots-toolbar">
        <input
          type="text"
          class="snapshots-search"
          placeholder="Search snapshots..."
        />
        <div class="snapshots-actions">
          <button class="save-current-btn" title="Save current workflow">
            💾 Save Current
          </button>
          <button class="export-snapshots-btn" title="Export all snapshots">
            📤 Export
          </button>
          <button class="import-snapshots-btn" title="Import snapshots">
            📥 Import
          </button>
        </div>
      </div>
      <div class="snapshots-list"></div>
      <div class="snapshots-footer">
        <span class="snapshots-count">0 snapshots</span>
      </div>
    </div>
  `;
  return modal;
}

/**
 * Render snapshots list in manager modal
 * @param {HTMLElement} modal - Modal element
 * @param {Object} context - Global context
 * @param {string} searchQuery - Optional search query
 */
function renderSnapshotsList(modal, context, searchQuery = '') {
  const listContainer = modal.querySelector('.snapshots-list');
  const countSpan = modal.querySelector('.snapshots-count');

  // Get snapshots (filtered by search if query provided)
  const snapshots = searchQuery
    ? workflowSnapshots.searchSnapshots(searchQuery)
    : workflowSnapshots.getSnapshots();

  // Update count
  countSpan.textContent = `${snapshots.length} snapshot${snapshots.length !== 1 ? 's' : ''}`;

  // Clear list
  listContainer.innerHTML = '';

  if (snapshots.length === 0) {
    listContainer.innerHTML = `
      <div class="snapshots-empty">
        <p>No workflow snapshots yet</p>
        <p class="help-text">Save your current workflow with Ctrl+Shift+S</p>
      </div>
    `;
    return;
  }

  // Render each snapshot
  snapshots.forEach(snapshot => {
    const item = createSnapshotItem(snapshot, context);
    listContainer.appendChild(item);
  });
}

/**
 * Create a snapshot list item
 * @param {Object} snapshot - Snapshot object
 * @param {Object} context - Global context
 * @returns {HTMLElement} Snapshot item element
 */
function createSnapshotItem(snapshot, context) {
  const item = document.createElement('div');
  item.className = 'snapshot-item';
  item.dataset.snapshotId = snapshot.id;

  const createdDate = new Date(snapshot.created).toLocaleDateString();
  const createdTime = new Date(snapshot.created).toLocaleTimeString();
  const toolCount = Object.keys(snapshot.toolStates || {}).length;

  item.innerHTML = `
    <div class="snapshot-info">
      <div class="snapshot-name">${escapeHtml(snapshot.name)}</div>
      ${snapshot.description ? `<div class="snapshot-description">${escapeHtml(snapshot.description)}</div>` : ''}
      <div class="snapshot-meta">
        <span class="snapshot-date" title="${createdDate} ${createdTime}">
          📅 ${createdDate}
        </span>
        <span class="snapshot-tools" title="Number of tool states saved">
          🔧 ${toolCount} tool${toolCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
    <div class="snapshot-actions">
      <button class="restore-btn" title="Restore this workflow">
        ↩️ Restore
      </button>
      <button class="delete-btn" title="Delete this snapshot">
        🗑️
      </button>
    </div>
  `;

  // Restore button
  const restoreBtn = item.querySelector('.restore-btn');
  restoreBtn.addEventListener('click', () => {
    restoreWorkflow(snapshot.id, context);
  });

  // Delete button
  const deleteBtn = item.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', async () => {
    const confirmed = await notifications.confirm(
      `Delete snapshot "${snapshot.name}"?`,
      { title: 'Delete Snapshot' }
    );

    if (confirmed) {
      workflowSnapshots.deleteSnapshot(snapshot.id);
      const modal = document.querySelector('.snapshots-manager-overlay');
      if (modal) {
        const searchInput = modal.querySelector('.snapshots-search');
        renderSnapshotsList(modal, context, searchInput?.value || '');
      }
      notifications.success('Snapshot deleted');
    }
  });

  return item;
}

/**
 * Setup event handlers for snapshots manager
 * @param {HTMLElement} modal - Modal element
 * @param {Object} context - Global context
 */
function setupSnapshotsManagerEvents(modal, context) {
  // Close button
  const closeBtn = modal.querySelector('.close-btn');
  closeBtn.addEventListener('click', () => {
    modal.remove();
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // Close on escape
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modal.remove();
    }
  });

  // Search input
  const searchInput = modal.querySelector('.snapshots-search');
  searchInput.addEventListener('input', (e) => {
    renderSnapshotsList(modal, context, e.target.value);
  });

  // Save current button
  const saveCurrentBtn = modal.querySelector('.save-current-btn');
  saveCurrentBtn.addEventListener('click', async () => {
    modal.remove();
    await saveCurrentWorkflow(context);
    // Reopen manager if user wants to see the saved snapshot
    // (optional - could be removed if too intrusive)
  });

  // Export button
  const exportBtn = modal.querySelector('.export-snapshots-btn');
  exportBtn.addEventListener('click', () => {
    exportWorkflowSnapshots();
  });

  // Import button
  const importBtn = modal.querySelector('.import-snapshots-btn');
  importBtn.addEventListener('click', async () => {
    await importWorkflowSnapshots();
    renderSnapshotsList(modal, context);
  });
}

/**
 * Restore a workflow from snapshot
 * @param {string} snapshotId - Snapshot ID
 * @param {Object} context - Global context
 */
export async function restoreWorkflow(snapshotId, context) {
  if (!workflowSnapshots) {
    notifications.error('Workflow snapshots not initialized');
    return;
  }

  try {
    const snapshot = workflowSnapshots.restoreSnapshot(snapshotId);

    if (!snapshot) {
      notifications.error('Snapshot not found');
      return;
    }

    // Restore all tool states to storage
    if (snapshot.toolStates) {
      Object.entries(snapshot.toolStates).forEach(([toolId, state]) => {
        storage.saveToolState(toolId, state);
      });
    }

    // Open the current tool from the snapshot
    if (snapshot.currentToolId) {
      openTool(snapshot.currentToolId, context);
    }

    // Close the snapshots manager if open
    const managerModal = document.querySelector('.snapshots-manager-overlay');
    if (managerModal) {
      managerModal.remove();
    }

    notifications.success(`Workflow "${snapshot.name}" restored`);
  } catch (error) {
    console.error('Failed to restore workflow:', error);
    notifications.error(`Failed to restore workflow: ${error.message}`);
  }
}

/**
 * Export workflow snapshots to JSON file
 */
export function exportWorkflowSnapshots() {
  if (!workflowSnapshots) {
    notifications.error('Workflow snapshots not initialized');
    return;
  }

  try {
    const jsonData = workflowSnapshots.exportSnapshots();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `devchef-workflow-snapshots-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notifications.success('Workflow snapshots exported');
  } catch (error) {
    console.error('Export failed:', error);
    notifications.error(`Export failed: ${error.message}`);
  }
}

/**
 * Import workflow snapshots from JSON file
 */
export async function importWorkflowSnapshots() {
  if (!workflowSnapshots) {
    notifications.error('Workflow snapshots not initialized');
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();

      const confirmed = await notifications.confirm(
        'Import snapshots? Existing snapshots with the same name will be kept.',
        { title: 'Import Workflow Snapshots' }
      );

      if (!confirmed) return;

      const count = workflowSnapshots.importSnapshots(text, true);
      notifications.success(`${count} snapshot${count !== 1 ? 's' : ''} imported`);
    } catch (error) {
      console.error('Import error:', error);
      notifications.error(`Import failed: ${error.message}`);
    }
  });

  input.click();
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
