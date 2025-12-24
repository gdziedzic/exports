/**
 * DevChef V6 Main Application
 * Ultimate Edition - Unmatched streamline & reliability
 */

import { context } from './core/state.js';
import { initializeTools, getLoadingErrors } from './core/loader.js';
import { renderToolList, showCommandPalette, openTool, updateRecentTools, toggleFavorite, exportSettings, importSettings, clearHistory, showStorageStats, getCurrentToolId, saveCurrentWorkflow, showWorkflowSnapshotsManager } from './core/ui.js';
import { ToolRegistry } from './core/registry.js';
import { debugConsole } from './core/console.js';
import { storage } from './core/storage.js';
import { notifications } from './core/notifications.js';
import { initWorkflowSnapshots } from './core/workflowsnapshots.js';

// V2.5 New Features
import { clipboardDetector } from './core/clipboard.js';
import { pipelineManager } from './core/pipeline.js';
import { snippetManager } from './core/snippets.js';
import { workspaceManager } from './core/workspace.js';
import { analytics } from './core/analytics.js';
import { quickActions } from './core/quickactions.js';

// V3.1 Ultimate Features
import { contextEngine } from './core/contextengine.js';
import { flowCanvas } from './core/flowcanvas.js';
import { quickInput } from './core/quickinput.js';

// V4 Next Level Features
import { aiAssistant } from './core/aiassistant.js';
import { toolBuilder } from './core/toolbuilder.js';
import { automationEngine } from './core/automation.js';

// V5 20x Edition Features
import { performanceMultiplier } from './core/multiplier.js';
import { collaborationHub } from './core/collaboration.js';
import { dataBridge } from './core/databridge.js';

// V6 Ultimate Edition Features
import { uiEngine } from './core/uiengine.js';
import { stateManager } from './core/statemanager.js';
import { toolOrchestrator } from './core/toolorchestrator.js';
import { errorBoundary } from './core/errorboundary.js';

// V6.5 Enhancement Edition Features
import { performanceMonitor } from './core/perfmonitor.js';
import { advancedSearch } from './core/advancedsearch.js';
import { devTools } from './core/devtools.js';

// V6.5 ULTIMATE Productivity Features
import { snippetsPlus } from './core/snippetsplus.js';
import { universalFavorites } from './core/universalfavorites.js';
import { productivityEngine } from './core/productivityengine.js';
import { quickPanel } from './core/quickpanel.js';

/**
 * Get URL query parameter value
 * @param {string} name - Parameter name
 * @returns {string|null} Parameter value or null
 */
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

/**
 * Initialize the DevChef application
 */
async function init() {
  console.log("🚀 DevChef V6: Ultimate Edition starting...");

  // Initialize V6 features FIRST (they provide infrastructure)
  initializeV6Features();

  // Initialize V6.5 enhancements
  initializeV65Features();

  // Initialize V6.5 ULTIMATE features
  initializeUltimateFeatures();

  // Show splash notification (using V6 UI Engine)
  if (window.uiEngine) {
    window.uiEngine.showToast('DevChef V6.5 ULTIMATE - Productivity to the Moon! 🚀🌙', {
      type: 'success',
      duration: 5000,
      icon: '🚀'
    });
  }

  // Initialize V2.5 features
  initializeV25Features();

  // Initialize V3.1 Ultimate features
  initializeV31Features();

  // Initialize V4 Next Level features
  initializeV4Features();

  // Initialize V5 20x Edition features
  initializeV5Features();

  // Initialize theme
  initializeTheme();

  // Initialize workflow snapshots
  initWorkflowSnapshots(storage);
  console.log('✅ Workflow snapshots initialized');

  // Apply saved layout
  applySavedLayout();

  // Load all tools
  const toolCount = await initializeTools();

  // Build advanced search index now that tools are loaded
  advancedSearch.buildSearchIndex();

  // Show loading errors if any
  showLoadingErrors();

  // Render tool list in sidebar
  renderToolList(context);

  // Update recent tools display
  updateRecentTools(context);

  // Set up tool search
  setupToolSearch(context);

  // Set up keyboard shortcuts
  setupKeyboardShortcuts();

  // Set up input/output handlers
  setupInputOutputHandlers();

  // Set up theme toggle
  setupThemeToggle();

  // Set up workflow snapshot buttons
  setupSnapshotButtons();

  // Set up debug console
  setupDebugConsole();

  // Set up settings menu
  setupSettingsMenu(context);

  // Set up browser history navigation
  setupHistoryNavigation();

  // Open tool based on URL parameter, last used tool, or first tool
  const toolFromUrl = getQueryParam('tool');
  const lastTool = getLastUsedTool();
  const tools = ToolRegistry.all();

  if (toolFromUrl && ToolRegistry.get(toolFromUrl)) {
    console.log(`Opening tool from URL: ${toolFromUrl}`);
    openTool(toolFromUrl, context);
  } else if (lastTool && ToolRegistry.get(lastTool)) {
    openTool(lastTool, context);
  } else if (tools.length > 0) {
    openTool(tools[0].id, context);
  } else {
    showWelcomeScreen();
  }

  console.log(`✓ DevChef V6.5 ULTIMATE ready - ${toolCount} tools loaded 🚀🌙`);
  console.log(`🎨 V6 Features: Modern UI | State Management | Tool Orchestration | Error Handling`);
  console.log(`⚡ V6.5 Features: Performance Monitor | Advanced Search (Ctrl+K) | DevTools (F12)`);
  console.log(`🌙 ULTIMATE Features: Snippets++ | Universal Favorites | Macros | Batch | Quick Panel`);
  console.log(``);
  console.log(`📌 ULTIMATE SHORTCUTS:`);
  console.log(`   ⚡ Quick Panel: Ctrl+Shift+Q  |  ⭐ Favorites: Ctrl+Alt+F  |  🕐 Recent: Ctrl+Shift+R`);
  console.log(`   🔴 Macro: Ctrl+Shift+M  |  ⚡ Batch: Ctrl+Shift+B  |  📜 History: Ctrl+Shift+H`);
  console.log(`   🔍 Search: Ctrl+K / Ctrl+Shift+F  |  📝 Snippets: Ctrl+B  |  🛠️ DevTools: F12`);
  console.log(``);
  console.log(`🚀 PRODUCTIVITY TO THE MOON! 🌙`);
}

/**
 * Set up browser history navigation (back/forward buttons)
 */
function setupHistoryNavigation() {
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.toolId) {
      const toolId = e.state.toolId;
      if (ToolRegistry.get(toolId)) {
        // Open tool without updating URL (to avoid pushing another history state)
        openTool(toolId, context, "#workspace", false);
      }
    } else {
      // No state, check URL parameter
      const toolFromUrl = getQueryParam('tool');
      if (toolFromUrl && ToolRegistry.get(toolFromUrl)) {
        openTool(toolFromUrl, context, "#workspace", false);
      }
    }
  });

  // Set initial state
  const currentToolId = getQueryParam('tool');
  if (currentToolId) {
    window.history.replaceState({ toolId: currentToolId }, '');
  }
}

/**
 * Initialize V2.5 features
 */
function initializeV25Features() {
  // Start clipboard monitoring (passive)
  clipboardDetector.startMonitoring((entry) => {
    if (entry.confidence > 80) {
      notifications.info(
        `Detected ${entry.type} in clipboard. ${entry.suggestions.length} tool(s) available.`,
        { duration: 4000 }
      );
    }
  });

  // Track page load
  analytics.trackEvent('app_init', { version: '2.5' });

  // Setup quick actions bar
  setupQuickActionsBar();

  // Setup productivity widget
  setupProductivityWidget();

  console.log('✨ V2.5 Features initialized');
}

/**
 * Initialize V3.1 Ultimate features
 */
function initializeV31Features() {
  // Smart Context Engine is auto-initialized

  // Setup Smart Context Suggestions UI
  setupContextSuggestionsUI();

  // Setup Flow Canvas button
  setupFlowCanvasButton();

  // Quick Input is initialized with its own shortcut (Ctrl+Shift+V)

  console.log('🎯 V3.1 Ultimate Features initialized');
  console.log('   - Smart Context Engine: Learning your patterns');
  console.log('   - Visual Flow Canvas: Ctrl+Shift+L');
  console.log('   - Universal Quick Input: Ctrl+Shift+V');
}

/**
 * Setup context suggestions UI
 */
function setupContextSuggestionsUI() {
  // Create suggestions panel
  const suggestionsPanel = document.createElement('div');
  suggestionsPanel.id = 'context-suggestions';
  suggestionsPanel.className = 'context-suggestions';
  suggestionsPanel.innerHTML = '<div class="suggestions-content"></div>';
  document.body.appendChild(suggestionsPanel);

  // Listen for suggestions updates
  document.addEventListener('context-suggestions-updated', (e) => {
    const suggestions = e.detail.suggestions;
    updateSuggestionsUI(suggestions);
  });
}

/**
 * Update suggestions UI
 */
function updateSuggestionsUI(suggestions) {
  const panel = document.getElementById('context-suggestions');
  if (!panel) return;

  const content = panel.querySelector('.suggestions-content');
  if (!content) return;

  if (suggestions.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';

  content.innerHTML = `
    <h4>💡 Smart Suggestions</h4>
    ${suggestions.map(sug => `
      <div class="suggestion-item" data-id="${sug.id}">
        <span class="suggestion-icon">${sug.icon}</span>
        <div class="suggestion-info">
          <div class="suggestion-action">${sug.action}</div>
          <div class="suggestion-reason">${sug.reason}</div>
        </div>
        <div class="suggestion-confidence">${Math.round(sug.confidence * 100)}%</div>
      </div>
    `).join('')}
  `;

  // Add click handlers
  content.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      contextEngine.executeSuggestion(id);
    });
  });
}

/**
 * Setup flow canvas button
 */
function setupFlowCanvasButton() {
  const header = document.querySelector('#sidebar header .header-content');
  if (!header) return;

  const flowCanvasBtn = document.createElement('button');
  flowCanvasBtn.id = 'flow-canvas-btn';
  flowCanvasBtn.className = 'icon-btn';
  flowCanvasBtn.title = 'Visual Flow Canvas (Ctrl+Shift+L)';
  flowCanvasBtn.innerHTML = '🎨';

  flowCanvasBtn.addEventListener('click', () => {
    showFlowCanvasDialog();
  });

  header.appendChild(flowCanvasBtn);

  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      showFlowCanvasDialog();
    }
  });
}

/**
 * Show flow canvas dialog
 */
function showFlowCanvasDialog() {
  // Create full-screen dialog for flow canvas
  const dialog = document.createElement('div');
  dialog.className = 'flow-canvas-dialog';
  dialog.innerHTML = '<div id="flow-canvas-container"></div>';
  document.body.appendChild(dialog);

  // Initialize canvas
  const container = document.getElementById('flow-canvas-container');
  flowCanvas.createCanvas(container);

  // Close on Escape
  const closeHandler = (e) => {
    if (e.key === 'Escape') {
      dialog.remove();
      document.removeEventListener('keydown', closeHandler);
    }
  };
  document.addEventListener('keydown', closeHandler);
}

/**
 * Initialize V4 Next Level features
 */
function initializeV4Features() {
  // AI Assistant, Tool Builder, and Automation Engine are auto-initialized
  console.log('🚀 V4 Next Level Features initialized');
  console.log('   - AI Assistant: Natural language code generation');
  console.log('   - Custom Tool Builder: Create your own tools');
  console.log('   - Automation Engine: Schedule tasks and triggers');
}

/**
 * Initialize V5 20x Edition features
 */
function initializeV5Features() {
  // Performance Multiplier, Collaboration Hub, and Data Bridge are auto-initialized
  console.log('⚡ V5: 20x Edition Features initialized');
  console.log('   - Performance Multiplier: Real-time optimization → 20x productivity');
  console.log('   - Collaboration Hub: Team sharing and workflows');
  console.log('   - Universal Data Bridge: Connect to everything');
}

/**
 * Initialize V6 Ultimate Edition features
 */
function initializeV6Features() {
  // Make modules globally available
  window.uiEngine = uiEngine;
  window.stateManager = stateManager;
  window.toolOrchestrator = toolOrchestrator;
  window.errorBoundary = errorBoundary;
  window.ToolRegistry = ToolRegistry;

  // All V6 modules are auto-initialized on import
  console.log('🎨 V6: Ultimate Edition Features initialized');
  console.log('   - UI Engine: Modern, responsive UI with smooth animations');
  console.log('   - State Manager: Bulletproof state with undo/redo');
  console.log('   - Tool Orchestrator: Flawless tool integration & data flow');
  console.log('   - Error Boundary: Comprehensive error handling & recovery');
}

/**
 * Initialize V6.5 Enhancement Edition features
 */
function initializeV65Features() {
  // Make modules globally available
  window.performanceMonitor = performanceMonitor;
  window.advancedSearch = advancedSearch;
  window.devTools = devTools;

  // Start performance monitoring
  performanceMonitor.start();

  // All V6.5 modules are auto-initialized on import
  console.log('⚡ V6.5: Enhancement Edition Features initialized');
  console.log('   - Performance Monitor: Real-time FPS, memory & optimization');
  console.log('   - Advanced Search: Fuzzy matching, favorites & usage tracking');
  console.log('   - DevTools Panel: Built-in debugging with F12 or Ctrl+Shift+I');
}

/**
 * Initialize V6.5 ULTIMATE Productivity Features
 */
function initializeUltimateFeatures() {
  // Make modules globally available
  window.snippetsPlus = snippetsPlus;
  window.universalFavorites = universalFavorites;
  window.productivityEngine = productivityEngine;
  window.quickPanel = quickPanel;

  // All ULTIMATE modules are auto-initialized on import
  console.log('🚀 V6.5 ULTIMATE: Productivity Features initialized');
  console.log('   🌙 MOON-SHOT PRODUCTIVITY MODE ACTIVATED');
  console.log('   - Snippets Plus: Variable substitution {{var}} & templates');
  console.log('   - Universal Favorites: Unified favorites (Ctrl+Alt+F)');
  console.log('   - Productivity Engine: Macros (Ctrl+Shift+M), Batch (Ctrl+Shift+B)');
  console.log('   - Quick Panel: Floating action button (Ctrl+Shift+Q)');
  console.log('   ⚡ ONE-CLICK EVERYTHING | 🎯 ZERO FRICTION | 🔥 MAX EFFICIENCY');
}

/**
 * Setup quick actions bar
 */
function setupQuickActionsBar() {
  const header = document.querySelector('#sidebar header .header-content');
  if (!header) return;

  // Create quick actions button
  const quickActionsBtn = document.createElement('button');
  quickActionsBtn.id = 'quick-actions-btn';
  quickActionsBtn.className = 'icon-btn';
  quickActionsBtn.title = 'Quick Actions (Ctrl+Space)';
  quickActionsBtn.innerHTML = '⚡';

  quickActionsBtn.addEventListener('click', () => {
    showQuickActionsDialog();
  });

  header.appendChild(quickActionsBtn);
}

/**
 * Setup productivity widget
 */
function setupProductivityWidget() {
  const insights = analytics.getInsights({ days: 1 });
  if (insights.overview.totalSessions > 0) {
    const score = insights.overview.avgProductivity;
    console.log(`📊 Today's Productivity: ${score}/100`);
  }
}

/**
 * Get last used tool from history
 * @returns {string|null} Last used tool ID
 */
function getLastUsedTool() {
  const recent = storage.getRecentTools(1);
  return recent.length > 0 ? recent[0].toolId : null;
}

/**
 * Apply saved layout settings
 */
function applySavedLayout() {
  const layout = storage.getLayout();
  const sidebar = document.querySelector('#sidebar');

  if (sidebar && layout.sidebarWidth) {
    sidebar.style.width = `${layout.sidebarWidth}px`;
  }
}

/**
 * Set up tool search functionality
 * @param {Object} context - Global context object
 */
function setupToolSearch(context) {
  const searchInput = document.querySelector('#tool-search');
  if (!searchInput) {
    console.error('Tool search input not found - search will not work!');
    return;
  }

  console.log('✓ Tool search initialized');

  let selectedToolIndex = -1;

  // Add input event listener with error handling
  searchInput.addEventListener('input', (e) => {
    try {
      const query = e.target.value;
      console.log(`Searching for: "${query}"`);
      renderToolList(context, query);
      selectedToolIndex = -1; // Reset selection on new search
    } catch (error) {
      console.error('Error during search:', error);
      notifications.error(`Search error: ${error.message}`);
    }
  });

  // Keyboard navigation for tool list
  searchInput.addEventListener('keydown', (e) => {
    const toolItems = Array.from(document.querySelectorAll('#tool-list .tool-item'));

    console.log(`Key pressed: ${e.key}, Found ${toolItems.length} tool items`);

    if (toolItems.length === 0) {
      console.warn('No tool items found for keyboard navigation');
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedToolIndex = Math.min(selectedToolIndex + 1, toolItems.length - 1);
      updateToolSelection(toolItems, selectedToolIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedToolIndex = Math.max(selectedToolIndex - 1, -1);
      updateToolSelection(toolItems, selectedToolIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedToolIndex >= 0 && selectedToolIndex < toolItems.length) {
        const selectedTool = toolItems[selectedToolIndex];
        const toolId = selectedTool.dataset.toolId;
        if (toolId) {
          openTool(toolId, context);
        }
      } else if (toolItems.length === 1) {
        // If only one tool matches, open it
        const toolId = toolItems[0].dataset.toolId;
        if (toolId) {
          openTool(toolId, context);
        }
      }
    } else if (e.key === 'Escape') {
      searchInput.value = '';
      renderToolList(context, '');
      selectedToolIndex = -1;
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectedToolIndex = 0;
      updateToolSelection(toolItems, selectedToolIndex);
    } else if (e.key === 'End') {
      e.preventDefault();
      selectedToolIndex = toolItems.length - 1;
      updateToolSelection(toolItems, selectedToolIndex);
    }
  });

  // Focus search on Ctrl+Shift+F or Cmd+Shift+F
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
      selectedToolIndex = -1;
    }
  });
}

/**
 * Update tool selection in sidebar
 * @param {Array} toolItems - Array of tool item elements
 * @param {number} selectedIndex - Index of selected tool
 */
function updateToolSelection(toolItems, selectedIndex) {
  console.log(`Updating selection: index ${selectedIndex} of ${toolItems.length} tools`);

  toolItems.forEach((item, index) => {
    if (index === selectedIndex) {
      item.classList.add('keyboard-selected');
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      console.log(`Selected tool: ${item.dataset.toolId}`);
    } else {
      item.classList.remove('keyboard-selected');
    }
  });
}

/**
 * Set up keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ignore shortcuts when typing in inputs (except command palette trigger)
    const isInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName);

    // Ctrl+K or Cmd+K - Open command palette (always active)
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      showCommandPalette(context);
      return;
    }

    // Other shortcuts disabled in input fields
    if (isInput) return;

    // Ctrl+D or Cmd+D - Toggle favorite for current tool
    if ((e.ctrlKey || e.metaKey) && e.key === "d") {
      e.preventDefault();
      const currentId = getCurrentToolId();
      if (currentId) {
        toggleFavorite(currentId);
        renderToolList(context);
        const tool = ToolRegistry.get(currentId);
        notifications.success(
          storage.isFavorite(currentId)
            ? `Added ${tool.manifest.name} to favorites`
            : `Removed ${tool.manifest.name} from favorites`,
          { duration: 2000 }
        );
      }
    }

    // Ctrl+E or Cmd+E - Show recent tools in command palette
    if ((e.ctrlKey || e.metaKey) && e.key === "e") {
      e.preventDefault();
      showCommandPalette(context);
    }

    // Ctrl+, or Cmd+, - Open settings
    if ((e.ctrlKey || e.metaKey) && e.key === ",") {
      e.preventDefault();
      showSettingsDialog(context);
    }

    // ? - Show keyboard shortcuts help
    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      showKeyboardShortcutsHelp();
    }

    // V2.5 Shortcuts

    // Ctrl+Space - Quick Actions
    if ((e.ctrlKey || e.metaKey) && e.key === " ") {
      e.preventDefault();
      showQuickActionsDialog();
    }

    // Ctrl+B - Snippets Library
    if ((e.ctrlKey || e.metaKey) && e.key === "b") {
      e.preventDefault();
      showSnippetsLibrary();
    }

    // Ctrl+I - Productivity Insights
    if ((e.ctrlKey || e.metaKey) && e.key === "i") {
      e.preventDefault();
      showProductivityInsights();
    }

    // Ctrl+P - Pipelines
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      showPipelinesDialog();
    }

    // Ctrl+W - Workspaces
    if ((e.ctrlKey || e.metaKey) && e.key === "w") {
      e.preventDefault();
      showWorkspaceSwitcher();
    }

    // Ctrl+Shift+S - Save current workflow snapshot
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
      e.preventDefault();
      saveCurrentWorkflow(context);
    }

    // Ctrl+Shift+W - Show workflow snapshots manager
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "W") {
      e.preventDefault();
      showWorkflowSnapshotsManager(context);
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
 * Set up workflow snapshot buttons
 */
function setupSnapshotButtons() {
  const saveBtn = document.querySelector('#save-snapshot-btn');
  const manageBtn = document.querySelector('#manage-snapshots-btn');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveCurrentWorkflow(context);
    });
  }

  if (manageBtn) {
    manageBtn.addEventListener('click', () => {
      showWorkflowSnapshotsManager(context);
    });
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

/**
 * Set up settings menu
 * @param {Object} context - Global context
 */
function setupSettingsMenu(context) {
  // Add settings button to header if not exists
  const header = document.querySelector('#sidebar header .header-content');
  if (!header) return;

  const settingsBtn = document.createElement('button');
  settingsBtn.id = 'settings-btn';
  settingsBtn.className = 'icon-btn';
  settingsBtn.title = 'Settings (Ctrl+,)';
  settingsBtn.innerHTML = '⚙️';

  settingsBtn.addEventListener('click', () => {
    showSettingsDialog(context);
  });

  header.appendChild(settingsBtn);
}

/**
 * Show settings dialog
 * @param {Object} context - Global context
 */
function showSettingsDialog(context) {
  const dialog = document.createElement('div');
  dialog.className = 'notification-dialog settings-dialog';
  dialog.innerHTML = `
    <div class="notification-dialog-overlay"></div>
    <div class="notification-dialog-content">
      <div class="notification-dialog-header">
        <h3>DevChef V2 Settings</h3>
      </div>
      <div class="notification-dialog-body settings-body">
        <div class="settings-section">
          <h4>Data Management</h4>
          <button id="export-settings" class="btn-secondary">Export Settings</button>
          <button id="import-settings" class="btn-secondary">Import Settings</button>
          <button id="clear-history" class="btn-secondary">Clear History</button>
          <button id="show-stats" class="btn-secondary">Storage Stats</button>
        </div>
        <div class="settings-section">
          <h4>Quick Actions</h4>
          <button id="show-shortcuts" class="btn-secondary">Keyboard Shortcuts</button>
          <button id="reload-tools" class="btn-secondary">Reload Tools</button>
        </div>
        <div class="settings-section">
          <h4>About</h4>
          <p>DevChef V2 - Enhanced Developer Productivity Tools</p>
          <p class="text-secondary">Loaded Tools: ${ToolRegistry.all().length}</p>
          <p class="text-secondary">Favorites: ${storage.getFavorites().length}</p>
          <p class="text-secondary">History: ${storage.getHistory().length} items</p>
        </div>
      </div>
      <div class="notification-dialog-actions">
        <button class="btn-primary" data-action="close">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  setTimeout(() => {
    dialog.classList.add('show');
  }, 10);

  const closeDialog = () => {
    dialog.classList.remove('show');
    setTimeout(() => {
      dialog.remove();
    }, 200);
  };

  // Set up button handlers
  dialog.querySelector('[data-action="close"]').addEventListener('click', closeDialog);
  dialog.querySelector('.notification-dialog-overlay').addEventListener('click', closeDialog);

  dialog.querySelector('#export-settings').addEventListener('click', () => {
    exportSettings();
  });

  dialog.querySelector('#import-settings').addEventListener('click', () => {
    importSettings();
    closeDialog();
  });

  dialog.querySelector('#clear-history').addEventListener('click', async () => {
    await clearHistory(context);
  });

  dialog.querySelector('#show-stats').addEventListener('click', () => {
    showStorageStats();
  });

  dialog.querySelector('#show-shortcuts').addEventListener('click', () => {
    closeDialog();
    showKeyboardShortcutsHelp();
  });

  dialog.querySelector('#reload-tools').addEventListener('click', () => {
    closeDialog();
    notifications.info('Reloading page...');
    setTimeout(() => {
      window.location.reload();
    }, 500);
  });

  // ESC to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeDialog();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Show keyboard shortcuts help
 */
function showKeyboardShortcutsHelp() {
  const dialog = document.createElement('div');
  dialog.className = 'notification-dialog shortcuts-dialog';
  dialog.innerHTML = `
    <div class="notification-dialog-overlay"></div>
    <div class="notification-dialog-content">
      <div class="notification-dialog-header">
        <h3>Keyboard Shortcuts</h3>
      </div>
      <div class="notification-dialog-body shortcuts-body">
        <div class="shortcut-group">
          <h4>Navigation</h4>
          <div class="shortcut-item">
            <kbd>Ctrl+K</kbd> <span>Open command palette</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl+Shift+F</kbd> <span>Focus search</span>
            <kbd>Ctrl+Alt+F</kbd> <span>Show favorites</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl+E</kbd> <span>Recent tools</span>
          </div>
          <div class="shortcut-item">
            <kbd>↑ / ↓</kbd> <span>Navigate command palette</span>
          </div>
          <div class="shortcut-item">
            <kbd>Enter</kbd> <span>Select tool</span>
          </div>
        </div>
        <div class="shortcut-group">
          <h4>Actions</h4>
          <div class="shortcut-item">
            <kbd>Ctrl+D</kbd> <span>Toggle favorite</span>
          </div>
          <div class="shortcut-item">
            <kbd>Right Click</kbd> <span>Toggle favorite (sidebar)</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl+,</kbd> <span>Open settings</span>
          </div>
        </div>
        <div class="shortcut-group">
          <h4>Developer</h4>
          <div class="shortcut-item">
            <kbd>Ctrl+\`</kbd> <span>Toggle debug console</span>
          </div>
          <div class="shortcut-item">
            <kbd>?</kbd> <span>Show shortcuts help</span>
          </div>
        </div>
        <div class="shortcut-note">
          <em>Note: Use <kbd>Cmd</kbd> instead of <kbd>Ctrl</kbd> on macOS</em>
        </div>
      </div>
      <div class="notification-dialog-actions">
        <button class="btn-primary" data-action="close">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  setTimeout(() => {
    dialog.classList.add('show');
  }, 10);

  const closeDialog = () => {
    dialog.classList.remove('show');
    setTimeout(() => {
      dialog.remove();
    }, 200);
  };

  dialog.querySelector('[data-action="close"]').addEventListener('click', closeDialog);
  dialog.querySelector('.notification-dialog-overlay').addEventListener('click', closeDialog);

  // ESC to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeDialog();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Show quick actions dialog (V2.5)
 */
function showQuickActionsDialog() {
  const allActions = quickActions.getAllActions();
  const categories = [...new Set(allActions.map(a => a.category))];

  const dialog = document.createElement('div');
  dialog.className = 'notification-dialog quick-actions-dialog';
  dialog.innerHTML = `
    <div class="notification-dialog-overlay"></div>
    <div class="notification-dialog-content">
      <div class="notification-dialog-header">
        <h3>⚡ Quick Actions</h3>
      </div>
      <div class="notification-dialog-body quick-actions-body">
        <input type="text" class="quick-actions-search" placeholder="Search actions..." autofocus>
        <div class="quick-actions-list">
          ${categories.map(cat => `
            <div class="action-category">
              <div class="action-category-title">${cat}</div>
              ${allActions.filter(a => a.category === cat).map(action => `
                <div class="action-item" data-action-id="${action.id}">
                  <span class="action-icon">${action.icon}</span>
                  <div class="action-details">
                    <div class="action-name">${action.name}</div>
                    <div class="action-description">${action.description}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
  setTimeout(() => dialog.classList.add('show'), 10);

  const closeDialog = () => {
    dialog.classList.remove('show');
    setTimeout(() => dialog.remove(), 200);
  };

  // Execute action on click
  dialog.querySelectorAll('.action-item').forEach(item => {
    item.addEventListener('click', async () => {
      const actionId = item.dataset.actionId;
      closeDialog();
      await quickActions.executeAction(actionId);
    });
  });

  // Search functionality
  const searchInput = dialog.querySelector('.quick-actions-search');
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    dialog.querySelectorAll('.action-item').forEach(item => {
      const name = item.querySelector('.action-name').textContent.toLowerCase();
      const desc = item.querySelector('.action-description').textContent.toLowerCase();
      item.style.display = (name.includes(query) || desc.includes(query)) ? 'flex' : 'none';
    });
  });

  dialog.querySelector('.notification-dialog-overlay').addEventListener('click', closeDialog);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDialog();
  }, { once: true });
}

/**
 * Show snippets library (V2.5)
 */
function showSnippetsLibrary() {
  const snippets = snippetManager.getSnippets({ sortBy: 'recent' });

  const dialog = document.createElement('div');
  dialog.className = 'notification-dialog snippets-dialog';
  dialog.innerHTML = `
    <div class="notification-dialog-overlay"></div>
    <div class="notification-dialog-content" style="width: 800px; max-width: 90vw;">
      <div class="notification-dialog-header">
        <h3>📚 Snippet Library</h3>
      </div>
      <div class="notification-dialog-body">
        <div class="snippets-stats">
          <span>Total: ${snippets.length}</span>
          <span>Favorites: ${snippets.filter(s => s.favorite).length}</span>
        </div>
        <div class="snippets-list">
          ${snippets.length > 0 ? snippets.map(snippet => `
            <div class="snippet-item" data-snippet-id="${snippet.id}">
              <div class="snippet-header">
                <span class="snippet-title">${snippet.title}</span>
                <span class="snippet-fav">${snippet.favorite ? '★' : '☆'}</span>
              </div>
              <div class="snippet-desc">${snippet.description || ''}</div>
              <div class="snippet-meta">
                <span class="snippet-lang">${snippet.language}</span>
                <span class="snippet-uses">Used ${snippet.usageCount} times</span>
              </div>
            </div>
          `).join('') : '<p style="text-align:center;padding:40px;color:var(--text-secondary);">No snippets yet. Create your first snippet!</p>'}
        </div>
      </div>
      <div class="notification-dialog-actions">
        <button class="btn-primary" data-action="new">+ New Snippet</button>
        <button class="btn-secondary" data-action="close">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
  setTimeout(() => dialog.classList.add('show'), 10);

  const closeDialog = () => {
    dialog.classList.remove('show');
    setTimeout(() => dialog.remove(), 200);
  };

  dialog.querySelector('[data-action="close"]').addEventListener('click', closeDialog);
  dialog.querySelector('[data-action="new"]').addEventListener('click', () => {
    closeDialog();
    notifications.info('Snippet creation feature coming soon!');
  });
  dialog.querySelector('.notification-dialog-overlay').addEventListener('click', closeDialog);
}

/**
 * Show productivity insights (V2.5)
 */
function showProductivityInsights() {
  const insights = analytics.getInsights({ days: 7 });

  const dialog = document.createElement('div');
  dialog.className = 'notification-dialog insights-dialog';
  dialog.innerHTML = `
    <div class="notification-dialog-overlay"></div>
    <div class="notification-dialog-content" style="width: 900px; max-width: 90vw;">
      <div class="notification-dialog-header">
        <h3>📊 Productivity Insights (Last 7 Days)</h3>
      </div>
      <div class="notification-dialog-body insights-body">
        <div class="insights-grid">
          <div class="insight-card">
            <div class="insight-value">${insights.overview.totalSessions}</div>
            <div class="insight-label">Total Sessions</div>
          </div>
          <div class="insight-card">
            <div class="insight-value">${insights.overview.totalDurationHours}h</div>
            <div class="insight-label">Total Time</div>
          </div>
          <div class="insight-card">
            <div class="insight-value">${insights.overview.totalActions}</div>
            <div class="insight-label">Actions Performed</div>
          </div>
          <div class="insight-card">
            <div class="insight-value">${insights.overview.avgProductivity}</div>
            <div class="insight-label">Avg Productivity</div>
          </div>
        </div>

        <div class="insights-section">
          <h4>📈 Productivity Trend: ${insights.productivity.trend}</h4>
          <p>Current Score: <strong>${insights.productivity.currentScore}</strong> (${insights.productivity.change > 0 ? '+' : ''}${insights.productivity.change}%)</p>
        </div>

        <div class="insights-section">
          <h4>🔧 Top Tools</h4>
          ${insights.tools.topTools.slice(0, 5).map((tool, i) => `
            <div class="tool-stat">${i + 1}. ${tool.toolName}: <strong>${tool.count}</strong> uses</div>
          `).join('')}
        </div>

        ${insights.recommendations.length > 0 ? `
          <div class="insights-section">
            <h4>💡 Recommendations</h4>
            ${insights.recommendations.map(rec => `
              <div class="recommendation ${rec.priority}">${rec.message}</div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="notification-dialog-actions">
        <button class="btn-secondary" data-action="close">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
  setTimeout(() => dialog.classList.add('show'), 10);

  const closeDialog = () => {
    dialog.classList.remove('show');
    setTimeout(() => dialog.remove(), 200);
  };

  dialog.querySelector('[data-action="close"]').addEventListener('click', closeDialog);
  dialog.querySelector('.notification-dialog-overlay').addEventListener('click', closeDialog);
}

/**
 * Show pipelines dialog (V2.5)
 */
function showPipelinesDialog() {
  const pipelines = pipelineManager.getAllPipelines();

  notifications.info(`You have ${pipelines.length} saved pipeline(s). Full pipeline UI coming soon!`);
}

/**
 * Show workspace switcher (V2.5)
 */
function showWorkspaceSwitcher() {
  const workspaces = workspaceManager.getAllWorkspaces();

  notifications.info(`You have ${workspaces.length} workspace(s). Full workspace UI coming soon!`);
}

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Export for debugging and V2.5 access
window.DevChef = {
  // V2
  context,
  ToolRegistry,
  storage,
  notifications,
  openTool: (id) => openTool(id, context),
  showCommandPalette: () => showCommandPalette(context),
  toggleFavorite,
  exportSettings,
  importSettings,
  debugConsole,

  // V2.5 Features
  clipboardDetector,
  pipelineManager,
  snippetManager,
  workspaceManager,
  analytics,
  quickActions,

  // V2.5 UI
  showQuickActionsDialog,
  showSnippetsLibrary,
  showProductivityInsights,

  // V6 Features
  uiEngine,
  stateManager,
  toolOrchestrator,
  errorBoundary,

  // V6.5 Features
  performanceMonitor,
  advancedSearch,
  devTools,

  // V6.5 ULTIMATE Features
  snippetsPlus,
  universalFavorites,
  productivityEngine,
  quickPanel
};
