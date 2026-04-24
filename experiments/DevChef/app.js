/**
 * DevChef V7 Main Application
 * State-of-the-Art Excellence - Flawless UX & Smooth Performance
 */

import { context } from './core/state.js';
import { initializeTools, getLoadingErrors } from './core/loader.js';
import { renderToolList, showCommandPalette, openTool, showHome, updateRecentTools, toggleFavorite, exportSettings, importSettings, clearHistory, showStorageStats, getCurrentToolId, saveCurrentWorkflow, showWorkflowSnapshotsManager } from './core/ui.js';
import { ToolRegistry } from './core/registry.js';
import { debugConsole } from './core/console.js';
import { storage } from './core/storage.js';
import { notifications } from './core/notifications.js';
import { initWorkflowSnapshots } from './core/workflowsnapshots.js';
import { registerComponents } from './core/components.js';

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
import { unifiedSearch as advancedSearch } from './core/search-unified.js';
import { devTools } from './core/devtools.js';

// V6.5 ULTIMATE Productivity Features
import { snippetsPlus } from './core/snippetsplus.js';
import { universalFavorites } from './core/universalfavorites.js';
import { productivityEngine } from './core/productivityengine.js';
import { quickPanel } from './core/quickpanel.js';

// Unified Search Feature (consolidates search.js, advancedsearch.js, deepsearch.js)
import { unifiedSearch as deepSearch } from './core/search-unified.js';
import { showDeepSearch, toggleDeepSearch } from './core/deepsearch-ui.js';

// V7 State-of-the-Art UX Excellence
import { v7UX } from './core/v7-ux.js';
import { onboarding } from './core/onboarding.js';
import { showToolHealthDashboard } from './core/tool-health.js';

/**
 * ============================================================================
 * PWA (Progressive Web App) Module
 * ============================================================================
 * Handles service worker registration, install prompts, and update notifications
 */

let deferredInstallPrompt = null;
let serviceWorkerRegistration = null;
const APP_VERSION = '11.0';
const APP_TAGLINE = 'True Game Changer, Zero-Friction Flow';

/**
 * Initialize PWA functionality
 */
async function initializePWA() {
  console.log('🔧 Initializing PWA...');

  // Register service worker
  if ('serviceWorker' in navigator) {
    try {
      serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registered:', serviceWorkerRegistration.scope);

      // Check for updates every 60 seconds
      setInterval(() => {
        serviceWorkerRegistration.update();
      }, 60000);

      // Handle service worker updates
      serviceWorkerRegistration.addEventListener('updatefound', () => {
        const newWorker = serviceWorkerRegistration.installing;
        console.log('🔄 Service Worker update found');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available
            console.log('✅ New Service Worker installed');
            showUpdateNotification();
          }
        });
      });

      // Handle controlled state changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service Worker controller changed - reloading page');
        window.location.reload();
      });

    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  } else {
    console.warn('⚠️ Service Workers are not supported in this browser');
  }

  // Handle install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('💡 beforeinstallprompt event fired');

    // Prevent the default mini-infobar
    e.preventDefault();

    // Store the event for later use
    deferredInstallPrompt = e;

    // Show custom install banner
    showInstallBanner();
  });

  // Handle successful installation
  window.addEventListener('appinstalled', () => {
    console.log('✅ PWA installed successfully');
    deferredInstallPrompt = null;
    hideInstallBanner();

    if (notifications) {
      notifications.success('DevChef installed successfully! 🎉', { duration: 5000 });
    }
  });

  // Check if already installed (standalone mode)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('✅ Running in standalone mode (PWA installed)');
  } else {
    console.log('ℹ️ Running in browser mode');
  }
}

/**
 * Show install banner
 */
function showInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (!banner) return;

  // Check if user previously dismissed the banner
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  if (dismissed === 'true') {
    console.log('Install banner previously dismissed');
    return;
  }

  banner.style.display = 'block';

  // Install button handler
  const installBtn = document.getElementById('pwa-install-btn');
  const dismissBtn = document.getElementById('pwa-dismiss-btn');

  if (installBtn) {
    installBtn.onclick = async () => {
      if (!deferredInstallPrompt) {
        console.warn('No deferred install prompt available');
        return;
      }

      // Show the install prompt
      deferredInstallPrompt.prompt();

      // Wait for the user's response
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);

      if (outcome === 'accepted') {
        console.log('✅ User accepted the install prompt');
      } else {
        console.log('❌ User dismissed the install prompt');
      }

      // Clear the deferred prompt
      deferredInstallPrompt = null;
      hideInstallBanner();
    };
  }

  if (dismissBtn) {
    dismissBtn.onclick = () => {
      hideInstallBanner();
      localStorage.setItem('pwa-install-dismissed', 'true');
      console.log('Install banner dismissed by user');
    };
  }
}

/**
 * Hide install banner
 */
function hideInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.style.display = 'none';
  }
}

/**
 * Show update notification
 */
function showUpdateNotification() {
  const notification = document.getElementById('pwa-update-notification');
  if (!notification) return;

  notification.style.display = 'block';

  // Update button handler
  const updateBtn = document.getElementById('pwa-update-btn');
  const dismissBtn = document.getElementById('pwa-update-dismiss-btn');

  if (updateBtn) {
    updateBtn.onclick = () => {
      if (serviceWorkerRegistration && serviceWorkerRegistration.waiting) {
        // Tell the service worker to skip waiting
        serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      hideUpdateNotification();
    };
  }

  if (dismissBtn) {
    dismissBtn.onclick = () => {
      hideUpdateNotification();
    };
  }
}

/**
 * Hide update notification
 */
function hideUpdateNotification() {
  const notification = document.getElementById('pwa-update-notification');
  if (notification) {
    notification.style.display = 'none';
  }
}

/**
 * Get PWA installation status
 * @returns {Object} PWA status information
 */
function getPWAStatus() {
  return {
    isStandalone: window.matchMedia('(display-mode: standalone)').matches,
    isInstalled: window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    serviceWorkerRegistered: serviceWorkerRegistration !== null,
    installPromptAvailable: deferredInstallPrompt !== null
  };
}

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
  console.log(`✨ DevChef V${APP_VERSION}: ${APP_TAGLINE} starting...`);

  // Initialize PWA (service worker, install prompt, updates)
  await initializePWA();

  // Initialize V7 UX Excellence FIRST
  await initializeV7Features();

  // Initialize V6 features (they provide infrastructure)
  initializeV6Features();

  // Initialize V6.5 enhancements
  initializeV65Features();

  // Initialize V6.5 ULTIMATE features
  initializeUltimateFeatures();

  // Show splash notification (using V6 UI Engine)
  if (window.uiEngine) {
    window.uiEngine.showToast(`DevChef V${APP_VERSION} - ${APP_TAGLINE} ✨`, {
      type: 'success',
      duration: 5000,
      icon: '✨'
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

  // Set up home navigation affordance
  setupHomeNavigation();

  // Set up workflow snapshot buttons
  setupSnapshotButtons();

  // Set up debug console
  setupDebugConsole();

  // Set up settings menu
  setupSettingsMenu(context);

  // Set up guided onboarding affordances
  setupGuidedOnboarding();
  setupGettingStartedPanel();
  setupV8BoostDock();
  setupV10ProductivityRail();
  setupAdaptiveClarity();
  if (localStorage.getItem('devchef-focus-mode') === 'true') {
    document.body.classList.add('focus-mode');
  }

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

  console.log(`✓ DevChef V${APP_VERSION} ${APP_TAGLINE} ready - ${toolCount} tools loaded 🚀🌙`);
  console.log(`🎨 V11 Features: Quick Resume | Clipboard Sprint | Clip-to-Snippet | Smart Automation | One-Click Home`);
  console.log(`⚡ Core Features: Performance Monitor | Advanced Search (Ctrl+K) | DevTools (F12)`);
  console.log(`🌙 ULTIMATE Features: Snippets++ | Universal Favorites | Macros | Batch | Quick Panel`);
  console.log(``);
  console.log(`📌 ULTIMATE SHORTCUTS:`);
  console.log(`   ⚡ Quick Panel: Ctrl+Shift+Q  |  🚀 V11 Boost: Ctrl+Shift+0  |  🏠 Home: DevChef title  |  🎯 Focus Mode: Ctrl+Shift+9`);
  console.log(`   1️⃣ Resume: Ctrl+Shift+1  |  2️⃣ Clipboard Sprint: Ctrl+Shift+2  |  3️⃣ Clip→Snippet: Ctrl+Shift+3`);
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
    } else if (e.state && e.state.home) {
      showHome(context, "#workspace", false);
    } else {
      // No state, check URL parameter
      const toolFromUrl = getQueryParam('tool');
      if (toolFromUrl && ToolRegistry.get(toolFromUrl)) {
        openTool(toolFromUrl, context, "#workspace", false);
      } else {
        showHome(context, "#workspace", false);
      }
    }
  });

  // Set initial state
  const currentToolId = getQueryParam('tool');
  if (currentToolId) {
    window.history.replaceState({ toolId: currentToolId }, '');
  } else {
    window.history.replaceState({ home: true }, '');
  }
}

function setupHomeNavigation() {
  const homeButton = document.getElementById('home-button');
  if (!homeButton) return;

  homeButton.addEventListener('click', () => {
    showHome(context);
  });
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
  analytics.trackEvent('app_init', { version: APP_VERSION });

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
 * Initialize V7 State-of-the-Art Excellence
 */
async function initializeV7Features() {
  // Initialize V7 UX Excellence
  await v7UX.init();

  // Make V7 globally available
  window.v7UX = v7UX;

  console.log('✨ V7: State-of-the-Art Excellence initialized');
  console.log('   ✨ FLAWLESS UX | SMOOTH ANIMATIONS | DELIGHTFUL INTERACTIONS');
  console.log('   - Smart Tooltips: Context-aware help everywhere');
  console.log('   - Haptic Feedback: Visual feedback for all interactions');
  console.log('   - Smooth Transitions: Buttery-smooth animations (60 FPS)');
  console.log('   - Loading States: Beautiful skeleton screens');
  console.log('   - Accessibility: WCAG 2.1 AA compliant');
  console.log('   - Performance: Optimized rendering & lazy loading');
  console.log('   🎯 EXCELLENCE IN EVERY DETAIL | 🚀 STATE-OF-THE-ART UX');
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
  window.deepSearch = deepSearch;

  // Initialize deep search index in the background
  setTimeout(() => {
    deepSearch.initialize();
    console.log('🔍 Deep Search: Index built and ready');
  }, 1000);

  // All ULTIMATE modules are auto-initialized on import
  console.log('🚀 V6.5 ULTIMATE: Productivity Features initialized');
  console.log('   🌙 MOON-SHOT PRODUCTIVITY MODE ACTIVATED');
  console.log('   - Snippets Plus: Variable substitution {{var}} & templates');
  console.log('   - Universal Favorites: Unified favorites (Ctrl+Alt+F)');
  console.log('   - Productivity Engine: Macros (Ctrl+Shift+M), Batch (Ctrl+Shift+B)');
  console.log('   - Quick Panel: Floating action button (Ctrl+Shift+Q)');
  console.log('   - Deep Search: Search all content (Ctrl+Shift+F)');
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

    // / - focus sidebar search for fast tool switching
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      focusToolSearch();
      return;
    }

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

    // F1 - Start guided tour
    if (e.key === "F1") {
      e.preventDefault();
      onboarding.startTour();
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

    // Ctrl+Shift+F - Deep Search (always active, even in inputs)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
      e.preventDefault();
      toggleDeepSearch(context);
      return;
    }

    // Ctrl+Shift+0 - Open V10 Boost Dock
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "0") {
      e.preventDefault();
      openV8BoostDock();
      return;
    }

    // Ctrl+Shift+9 - Toggle Focus Mode
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "9") {
      e.preventDefault();
      toggleFocusMode();
      return;
    }

    // Ctrl+Shift+1 - Quick Resume (last used tool)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "1") {
      e.preventDefault();
      quickResumeLastTool();
      return;
    }

    // Ctrl+Shift+2 - Clipboard Sprint (open quick input and process clipboard)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "2") {
      e.preventDefault();
      runClipboardSprint();
      return;
    }

    // Ctrl+Shift+3 - Save clipboard as snippet
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "3") {
      e.preventDefault();
      captureClipboardToSnippet();
      return;
    }

    // Ctrl+Shift+. - Toggle adaptive clarity mode
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === ".") {
      e.preventDefault();
      toggleAdaptiveClarity();
      return;
    }

    // Ctrl+Shift+L - Toggle compact sidebar
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      toggleCompactSidebar();
      return;
    }
  });
}

function focusToolSearch() {
  const searchInput = document.querySelector('#tool-search');
  if (!searchInput) return;
  searchInput.focus();
  searchInput.select();
}

/**
 * Set up onboarding helpers for first-time users
 */
function setupGuidedOnboarding() {
  const header = document.querySelector('#sidebar header .header-content');
  const searchInput = document.querySelector('#tool-search');
  const themeBtn = document.querySelector('#theme-toggle');

  if (searchInput) {
    searchInput.setAttribute('data-shortcut', 'Ctrl+Shift+F');
  }

  if (themeBtn) {
    themeBtn.setAttribute('data-shortcut', 'Theme');
  }

  if (header && !document.getElementById('help-tour-btn')) {
    const helpBtn = document.createElement('button');
    helpBtn.id = 'help-tour-btn';
    helpBtn.className = 'icon-btn';
    helpBtn.title = 'Start guided tour (F1)';
    helpBtn.setAttribute('interestfor', 'tooltip');
    helpBtn.setAttribute('data-tooltip', 'Start guided tour (F1)');
    helpBtn.setAttribute('data-shortcut', 'F1');
    helpBtn.innerHTML = '🧭';
    helpBtn.addEventListener('click', () => onboarding.startTour());
    header.appendChild(helpBtn);
  }

  const nudgeDismissed = localStorage.getItem('devchef-tour-nudge-dismissed') === 'true';
  if (!onboarding.shouldShowTour() || nudgeDismissed) return;

  setTimeout(() => {
    if (document.querySelector('.first-run-coach')) return;

    const nudge = document.createElement('div');
    nudge.className = 'first-run-coach';
    nudge.innerHTML = `
      <div class="coach-title">Get productive in under 2 minutes</div>
      <div class="coach-copy">
        Start the guided tour or jump straight in with <kbd>Ctrl+K</kbd> for fast tool search.
      </div>
      <div class="coach-actions">
        <button class="coach-start">Start tour</button>
        <button class="coach-skip secondary">Skip for now</button>
      </div>
    `;

    document.body.appendChild(nudge);

    const dismissNudge = () => {
      localStorage.setItem('devchef-tour-nudge-dismissed', 'true');
      nudge.remove();
    };

    nudge.querySelector('.coach-start')?.addEventListener('click', () => {
      dismissNudge();
      onboarding.startTour();
    });

    nudge.querySelector('.coach-skip')?.addEventListener('click', () => {
      dismissNudge();
    });
  }, 900);
}

/**
 * Sidebar "Start Here" panel for zero-friction onboarding
 */
function setupGettingStartedPanel() {
  const sidebar = document.querySelector('#sidebar');
  const searchBox = document.querySelector('.search-box');
  if (!sidebar || !searchBox) return;

  const dismissed = localStorage.getItem('devchef-start-here-dismissed') === 'true';
  if (dismissed) return;

  let panel = document.getElementById('getting-started-panel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'getting-started-panel';
    panel.className = 'getting-started-panel';
    searchBox.insertAdjacentElement('afterend', panel);
  }

  const registryTools = ToolRegistry.all();
  const tools = Array.isArray(registryTools)
    ? registryTools.filter((tool) => tool && typeof tool.id === 'string')
    : [];
  const firstTool = tools.find((tool) => tool.id);
  const firstToolId = firstTool?.id || null;
  const firstToolName = firstTool?.manifest?.name || firstTool?.id || 'first tool';

  panel.innerHTML = `
    <div class="getting-started-header">
      <h3>Start Here</h3>
      <button class="getting-started-close" interestfor="tooltip" data-tooltip="Hide this panel">✕</button>
    </div>
    <p class="getting-started-copy">Use one quick action and you are productive immediately.</p>
    <div class="getting-started-actions">
      <button class="getting-started-btn" data-action="tour" interestfor="tooltip" data-tooltip="Guided walkthrough (F1)">
        1. Guided Tour
      </button>
      <button class="getting-started-btn secondary" data-action="palette" interestfor="tooltip" data-tooltip="Find any tool fast (Ctrl+K)">
        2. Command Palette
      </button>
      <button class="getting-started-btn secondary" data-action="tool" interestfor="tooltip" data-tooltip="Open ${escapeHtml(firstToolName)}">
        3. Try ${escapeHtml(firstToolName)}
      </button>
    </div>
    <div class="getting-started-tip">
      Tip: paste data, then press <kbd>Ctrl+K</kbd> to find the right tool fast.
    </div>
  `;

  panel.querySelector('.getting-started-close')?.addEventListener('click', () => {
    localStorage.setItem('devchef-start-here-dismissed', 'true');
    panel.remove();
  });

  panel.querySelector('[data-action="tour"]')?.addEventListener('click', () => {
    onboarding.startTour();
  });

  panel.querySelector('[data-action="palette"]')?.addEventListener('click', () => {
    showCommandPalette(context);
  });

  panel.querySelector('[data-action="tool"]')?.addEventListener('click', () => {
    if (firstToolId) {
      openTool(firstToolId, context);
    }
  });
}

/**
 * V10 Productivity Rail - high-value actions with low UI noise
 */
function setupV10ProductivityRail() {
  const sidebar = document.getElementById('sidebar');
  const recentTools = document.getElementById('recent-tools');
  if (!sidebar || !recentTools) return;

  let rail = document.getElementById('v10-productivity-rail');
  if (!rail) {
    rail = document.createElement('section');
    rail.id = 'v10-productivity-rail';
    rail.className = 'v10-productivity-rail';
    rail.innerHTML = `
      <div class="v10-rail-header">
        <span class="v10-rail-title">V11 Productivity</span>
        <span class="v10-rail-shortcuts">/ • Ctrl+K • Ctrl+Shift+L</span>
      </div>
      <div class="v10-rail-actions">
        <button class="v10-rail-btn" data-v10-action="resume" interestfor="tooltip" data-tooltip="Open last tool">Resume</button>
        <button class="v10-rail-btn" data-v10-action="palette" interestfor="tooltip" data-tooltip="Open command palette">Find Tool</button>
        <button class="v10-rail-btn" data-v10-action="compact" interestfor="tooltip" data-tooltip="Toggle compact sidebar">Compact</button>
      </div>
    `;
    recentTools.insertAdjacentElement('afterend', rail);
  }

  rail.addEventListener('click', (e) => {
    const button = e.target.closest('[data-v10-action]');
    if (!button) return;
    const action = button.dataset.v10Action;
    if (action === 'resume') {
      quickResumeLastTool();
    } else if (action === 'palette') {
      showCommandPalette(context);
    } else if (action === 'compact') {
      toggleCompactSidebar();
    }
  });

  const compactSaved = localStorage.getItem('devchef-sidebar-compact') === 'true';
  document.body.classList.toggle('sidebar-compact', compactSaved);
}

function toggleCompactSidebar() {
  const enabled = document.body.classList.toggle('sidebar-compact');
  localStorage.setItem('devchef-sidebar-compact', enabled ? 'true' : 'false');
  notifications.info(`Compact sidebar ${enabled ? 'enabled' : 'disabled'}`, { duration: 1500 });
}

/**
 * V10 "Boost Dock" - one-click high-value productivity actions
 */
function setupV8BoostDock() {
  if (document.getElementById('v8-boost-dock')) return;

  const dock = document.createElement('section');
  dock.id = 'v8-boost-dock';
  dock.className = 'v8-boost-dock';
  dock.innerHTML = `
    <div class="v8-boost-header">
      <h3>V11 Boost</h3>
      <button class="v8-boost-close" type="button" interestfor="tooltip" data-tooltip="Hide dock">✕</button>
    </div>
    <p class="v8-boost-copy">Run high-impact actions in one click.</p>
    <div class="v8-boost-actions">
      <button class="v8-boost-btn" data-v8-action="resume">1. Quick Resume</button>
      <button class="v8-boost-btn" data-v8-action="clipboard-sprint">2. Clipboard Sprint</button>
      <button class="v8-boost-btn" data-v8-action="clip-snippet">3. Clip → Snippet</button>
      <button class="v8-boost-btn" data-v8-action="focus">Focus Mode</button>
    </div>
    <div class="v8-boost-tip">Shortcuts: <kbd>Ctrl+Shift+1</kbd> resume, <kbd>Ctrl+Shift+2</kbd> sprint, <kbd>Ctrl+Shift+3</kbd> clip.</div>
  `;

  document.body.appendChild(dock);

  const hidden = localStorage.getItem('devchef-v8-boost-hidden') === 'true';
  if (hidden) {
    dock.classList.add('hidden');
  } else {
    setTimeout(() => dock.classList.add('show'), 120);
  }

  dock.querySelector('.v8-boost-close')?.addEventListener('click', () => {
    dock.classList.remove('show');
    dock.classList.add('hidden');
    localStorage.setItem('devchef-v8-boost-hidden', 'true');
  });

  dock.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-v8-action]');
    if (!btn) return;
    runV8BoostAction(btn.dataset.v8Action);
  });
}

function openV8BoostDock() {
  const dock = document.getElementById('v8-boost-dock');
  if (!dock) {
    setupV8BoostDock();
    return;
  }
  dock.classList.remove('hidden');
  dock.classList.add('show');
  localStorage.setItem('devchef-v8-boost-hidden', 'false');
}

function runV8BoostAction(action) {
  switch (action) {
    case 'resume':
      quickResumeLastTool();
      break;
    case 'clipboard-sprint':
      runClipboardSprint();
      break;
    case 'clip-snippet':
      captureClipboardToSnippet();
      break;
    case 'focus':
      toggleFocusMode();
      break;
    default:
      break;
  }
}

function quickResumeLastTool() {
  const lastToolId = getLastUsedTool();
  if (lastToolId && ToolRegistry.get(lastToolId)) {
    openTool(lastToolId, context);
    const tool = ToolRegistry.get(lastToolId);
    const toolName = tool?.manifest?.name || lastToolId;
    notifications.success(`V11 Resume: ${toolName}`, { duration: 1800 });
    return;
  }
  showCommandPalette(context);
  notifications.info('V11 Resume: no recent tool found, opened Command Palette', { duration: 2200 });
}

async function runClipboardSprint() {
  try {
    await quickInput.open();
    notifications.success('V11 Sprint: clipboard loaded into Quick Input', { duration: 1800 });
  } catch (error) {
    quickInput.toggle();
    notifications.info('V11 Sprint: opened Quick Input', { duration: 1800 });
  }
}

async function captureClipboardToSnippet() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      notifications.warning('Clipboard is empty');
      return;
    }

    const currentToolId = getCurrentToolId();
    const snippet = snippetManager.createSnippet({
      title: `Clipboard ${new Date().toLocaleTimeString()}`,
      content: text,
      description: 'Captured via V11 Clip-to-Snippet',
      language: 'text',
      category: 'Captured',
      toolId: currentToolId || null,
      tags: ['clipboard', 'v10']
    });

    notifications.success(`V11 Clip→Snippet: saved "${snippet.title}"`, { duration: 2200 });
  } catch (error) {
    notifications.error('V11 Clip→Snippet failed: clipboard access denied');
  }
}

function toggleFocusMode() {
  const enabled = document.body.classList.toggle('focus-mode');
  localStorage.setItem('devchef-focus-mode', enabled ? 'true' : 'false');
  notifications.info(`Focus mode ${enabled ? 'enabled' : 'disabled'}`, { duration: 1800 });
}

function setupAdaptiveClarity() {
  const body = document.body;
  const sidebar = document.getElementById('sidebar');
  const workspace = document.getElementById('workspace');
  const headerActions = document.querySelector('#sidebar .header-actions');
  if (!body || !sidebar || !workspace) return;

  const saved = localStorage.getItem('devchef-clarity-mode');
  const enabled = saved === null ? true : saved === 'true';
  body.classList.toggle('clarity-mode', enabled);

  let clarityBtn = document.getElementById('clarity-toggle-btn');
  if (!clarityBtn && headerActions) {
    clarityBtn = document.createElement('button');
    clarityBtn.id = 'clarity-toggle-btn';
    clarityBtn.title = 'Toggle adaptive clarity mode (Ctrl+Shift+.)';
    clarityBtn.setAttribute('interestfor', 'tooltip');
    clarityBtn.setAttribute('data-tooltip', 'Adaptive clarity mode (Ctrl+Shift+.)');
    clarityBtn.innerHTML = '<span class="action-icon">🎯</span>';
    headerActions.prepend(clarityBtn);
  }

  clarityBtn?.addEventListener('click', toggleAdaptiveClarity);

  const syncDeepFocus = () => {
    const active = document.activeElement;
    const isEditor = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    );
    const inWorkspace = active && active.closest && active.closest('#workspace');
    body.classList.toggle('deep-focus', Boolean(body.classList.contains('clarity-mode') && inWorkspace && isEditor));
  };

  document.addEventListener('focusin', syncDeepFocus);
  document.addEventListener('focusout', () => setTimeout(syncDeepFocus, 0));

  const updateScrolledState = () => {
    body.classList.toggle('workspace-scrolled', workspace.scrollTop > 24);
  };
  workspace.addEventListener('scroll', updateScrolledState, { passive: true });
  updateScrolledState();

  const applyStagger = () => {
    const items = document.querySelectorAll('#tool-list .tool-item');
    items.forEach((item, index) => {
      item.style.setProperty('--item-index', String(Math.min(index, 40)));
    });
  };
  applyStagger();

  const observer = new MutationObserver(() => applyStagger());
  const toolList = document.getElementById('tool-list');
  if (toolList) {
    observer.observe(toolList, { childList: true, subtree: true });
  }

  sidebar.addEventListener('mouseenter', () => {
    if (body.classList.contains('clarity-mode')) body.classList.add('clarity-peek');
  });
  sidebar.addEventListener('mouseleave', () => body.classList.remove('clarity-peek'));

  requestAnimationFrame(() => body.classList.add('ui-ready'));
}

function toggleAdaptiveClarity() {
  const enabled = document.body.classList.toggle('clarity-mode');
  if (!enabled) document.body.classList.remove('deep-focus');
  localStorage.setItem('devchef-clarity-mode', enabled ? 'true' : 'false');
  notifications.info(`Adaptive clarity ${enabled ? 'enabled' : 'disabled'}`, { duration: 1700 });
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
  showHome(context, "#workspace", false);
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
      <button class="open-health-btn">Open Tool Health Dashboard</button>
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

  const healthBtn = errorBanner.querySelector('.open-health-btn');
  healthBtn.addEventListener('click', () => {
    showToolHealthDashboard(context);
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
          <button id="show-tool-health" class="btn-secondary">Tool Health Dashboard</button>
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

  dialog.querySelector('#show-tool-health').addEventListener('click', () => {
    closeDialog();
    showToolHealthDashboard(context);
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

function setupGlobalResilience() {
  window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error || event.message);
    notifications?.error?.('A runtime error occurred. Open debug console for details.');
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    notifications?.error?.('An async error occurred. Open debug console for details.');
  });
}

async function startApp() {
  try {
    setupGlobalResilience();
    await init();
  } catch (error) {
    console.error('DevChef failed to initialize:', error);
    const workspace = document.getElementById('workspace');
    if (workspace) {
      workspace.innerHTML = `
        <div class="welcome-screen">
          <h2>DevChef failed to start</h2>
          <p>Open the debug console and refresh after fixing the issue.</p>
          <p class="text-error">${escapeHtml(error?.message || 'Unknown startup error')}</p>
        </div>
      `;
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
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
  quickPanel,

  // PWA Features
  pwa: {
    status: getPWAStatus,
    showInstallBanner,
    hideInstallBanner,
    showUpdateNotification,
    hideUpdateNotification,
    registration: () => serviceWorkerRegistration
  }
};
