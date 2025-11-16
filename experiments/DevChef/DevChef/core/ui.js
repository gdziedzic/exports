/**
 * DevChef UI Rendering System
 * Handles tool rendering and workspace management
 */

import { ToolRegistry } from './registry.js';

let currentToolId = null;
let workspaceStyleElement = null;

/**
 * Open and render a tool in the workspace
 * @param {string} id - Tool ID
 * @param {Object} context - Global context object
 */
export function openTool(id, context) {
  const tool = ToolRegistry.get(id);

  if (!tool) {
    console.error(`Tool ${id} not found`);
    return;
  }

  currentToolId = id;

  // Get workspace container
  const container = document.querySelector("#workspace");
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

  // Initialize the tool
  if (tool.module.DevChefTool && tool.module.DevChefTool.init) {
    tool.module.DevChefTool.init(container, context);
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

  sidebar.innerHTML = "";

  const categories = ToolRegistry.getCategories();
  const query = searchQuery.toLowerCase().trim();

  categories.forEach(category => {
    // Get tools in this category
    const tools = ToolRegistry.getByCategory(category);

    // Filter tools if search query exists
    const filteredTools = query
      ? tools.filter(manifest =>
          manifest.name.toLowerCase().includes(query) ||
          manifest.id.toLowerCase().includes(query) ||
          (manifest.description && manifest.description.toLowerCase().includes(query)) ||
          category.toLowerCase().includes(query)
        )
      : tools;

    // Skip empty categories
    if (filteredTools.length === 0) {
      return;
    }

    // Create category section
    const categorySection = document.createElement("div");
    categorySection.className = "category-section";

    const categoryHeader = document.createElement("div");
    categoryHeader.className = "category-header";
    categoryHeader.textContent = category;
    categorySection.appendChild(categoryHeader);

    filteredTools.forEach(manifest => {
      const toolItem = document.createElement("div");
      toolItem.className = "tool-item";
      toolItem.dataset.toolId = manifest.id;
      toolItem.textContent = manifest.name;

      toolItem.addEventListener("click", () => {
        openTool(manifest.id, context);
      });

      categorySection.appendChild(toolItem);
    });

    sidebar.appendChild(categorySection);
  });

  // Show "no results" message if no tools match
  if (query && sidebar.children.length === 0) {
    sidebar.innerHTML = '<div class="no-results">No tools found</div>';
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
  const filtered = tools.filter(t =>
    t.name.toLowerCase().includes(query.toLowerCase()) ||
    t.id.toLowerCase().includes(query.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(query.toLowerCase())) ||
    (t.category && t.category.toLowerCase().includes(query.toLowerCase()))
  );

  filtered.forEach(manifest => {
    const item = document.createElement("div");
    item.className = "palette-item";
    item.innerHTML = `
      <div class="palette-item-name">${manifest.name}</div>
      ${manifest.description ? `<div class="palette-item-description">${manifest.description}</div>` : ''}
      <div class="palette-item-category">${manifest.category || "Uncategorized"}</div>
    `;

    item.addEventListener("click", () => {
      openTool(manifest.id, context);
      palette.style.display = "none";
    });

    results.appendChild(item);
  });

  if (filtered.length === 0) {
    results.innerHTML = '<div class="palette-empty">No tools found</div>';
  }
}

/**
 * Get currently active tool ID
 * @returns {string|null} Current tool ID
 */
export function getCurrentToolId() {
  return currentToolId;
}
