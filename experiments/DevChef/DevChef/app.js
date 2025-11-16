/**
 * DevChef Main Application
 * Initializes the app and sets up event handlers
 */

import { context } from './core/state.js';
import { initializeTools, getLoadingErrors } from './core/loader.js';
import { renderToolList, showCommandPalette, openTool } from './core/ui.js';
import { ToolRegistry } from './core/registry.js';
import { debugConsole } from './core/console.js';

/**
 * Initialize the DevChef application
 */
async function init() {
  console.log("🔥 DevChef starting...");

  // Initialize theme
  initializeTheme();

  // Load all tools
  const toolCount = await initializeTools();

  // Show loading errors if any
  showLoadingErrors();

  // Render tool list in sidebar
  renderToolList(context);

  // Set up tool search
  setupToolSearch(context);

  // Set up keyboard shortcuts
  setupKeyboardShortcuts();

  // Set up input/output handlers
  setupInputOutputHandlers();

  // Set up theme toggle
  setupThemeToggle();

  // Set up debug console
  setupDebugConsole();

  // Open first tool if available
  const tools = ToolRegistry.all();
  if (tools.length > 0) {
    openTool(tools[0].id, context);
  } else {
    showWelcomeScreen();
  }

  console.log("✓ DevChef ready");
}

/**
 * Set up tool search functionality
 * @param {Object} context - Global context object
 */
function setupToolSearch(context) {
  const searchInput = document.querySelector('#tool-search');
  if (!searchInput) {
    console.warn('Tool search input not found');
    return;
  }

  searchInput.addEventListener('input', (e) => {
    renderToolList(context, e.target.value);
  });

  // Focus search on Ctrl+F or Cmd+F
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}

/**
 * Set up keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ctrl+K or Cmd+K - Open command palette
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      showCommandPalette(context);
    }
  });
}

/**
 * Set up input/output textarea handlers
 */
function setupInputOutputHandlers() {
  const inputEl = document.querySelector("#input");
  const outputEl = document.querySelector("#output");

  if (inputEl) {
    inputEl.addEventListener("input", (e) => {
      context.setInput(e.target.value);
    });
  }

  if (outputEl) {
    outputEl.addEventListener("input", (e) => {
      context.output = e.target.value;
    });
  }
}

/**
 * Show welcome screen when no tools are available
 */
function showWelcomeScreen() {
  const workspace = document.querySelector("#workspace");
  workspace.innerHTML = `
    <div class="welcome-screen">
      <h2>Welcome to DevChef</h2>
      <p>An offline-first micro-tool engine for developers</p>
      <p>Press <kbd>Ctrl+K</kbd> to open the command palette</p>
      <p style="margin-top: 24px; color: var(--text-secondary);">
        No tools loaded. Add tools to <code>/core/tools/</code> or <code>/tools/</code>
      </p>
    </div>
  `;
}

/**
 * Initialize theme from localStorage
 */
function initializeTheme() {
  const savedTheme = localStorage.getItem('devchef-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

/**
 * Set up theme toggle button
 */
function setupThemeToggle() {
  const themeToggle = document.querySelector('#theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('devchef-theme', newTheme);
  updateThemeIcon(newTheme);
}

/**
 * Update theme toggle icon
 */
function updateThemeIcon(theme) {
  const icon = document.querySelector('.theme-icon');
  if (icon) {
    icon.textContent = theme === 'light' ? '🌙' : '☀️';
  }
}

/**
 * Show loading errors if any
 */
function showLoadingErrors() {
  const errors = getLoadingErrors();
  if (errors.length === 0) return;

  // Create error banner in sidebar
  const sidebar = document.querySelector('#sidebar');
  const header = sidebar.querySelector('header');

  const errorBanner = document.createElement('div');
  errorBanner.className = 'loading-errors-banner';
  errorBanner.innerHTML = `
    <div class="error-header">
      <span class="error-icon">⚠️</span>
      <span class="error-title">${errors.length} tool(s) failed to load</span>
      <button class="error-toggle" title="Show details">▼</button>
    </div>
    <div class="error-details" style="display: none;">
      ${errors.map(err => `
        <div class="error-item">
          <div class="error-path">${err.path}</div>
          <div class="error-message">${escapeHtml(err.error)}</div>
        </div>
      `).join('')}
      <button class="open-console-btn">Open Debug Console</button>
    </div>
  `;

  header.insertAdjacentElement('afterend', errorBanner);

  // Set up toggle
  const toggleBtn = errorBanner.querySelector('.error-toggle');
  const details = errorBanner.querySelector('.error-details');

  toggleBtn.addEventListener('click', () => {
    const isVisible = details.style.display !== 'none';
    details.style.display = isVisible ? 'none' : 'block';
    toggleBtn.textContent = isVisible ? '▼' : '▲';
  });

  // Set up console button
  const consoleBtn = errorBanner.querySelector('.open-console-btn');
  consoleBtn.addEventListener('click', () => {
    debugConsole.show();
  });
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Set up debug console
 */
function setupDebugConsole() {
  // Create console toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'console-toggle-btn';
  toggleBtn.title = 'Toggle Debug Console (Ctrl+`)';
  toggleBtn.innerHTML = '🐛';
  document.body.appendChild(toggleBtn);

  toggleBtn.addEventListener('click', () => {
    debugConsole.toggle();
  });

  // Add keyboard shortcut for console (Ctrl+` or Cmd+`)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === '`') {
      e.preventDefault();
      debugConsole.toggle();
    }
  });
}

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Export for debugging
window.DevChef = {
  context,
  ToolRegistry,
  openTool: (id) => openTool(id, context),
  showCommandPalette: () => showCommandPalette(context),
  debugConsole
};
