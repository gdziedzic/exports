/**
 * DevChef Ultimate - Quick Panel
 * Floating quick access panel with gestures and shortcuts
 *
 * Features:
 * - Floating action button
 * - Quick access to all features
 * - Gesture controls
 * - Customizable shortcuts
 * - One-click productivity boost
 */

class QuickPanel {
  constructor() {
    this.isOpen = false;
    this.position = { x: window.innerWidth - 80, y: window.innerHeight - 80 };
    this.isDragging = false;
    this.quickActions = [];
    this.init();
  }

  /**
   * Initialize Quick Panel
   */
  init() {
    this.createFloatingButton();
    this.setupQuickActions();
    this.setupGestures();
    console.log('🚀 Quick Panel initialized - One-click productivity at your fingertips');
  }

  /**
   * Create floating action button
   */
  createFloatingButton() {
    const fab = document.createElement('div');
    fab.id = 'quick-panel-fab';
    fab.className = 'quick-panel-fab';
    fab.innerHTML = `
      <div class="fab-icon">⚡</div>
      <div class="fab-ring"></div>
    `;
    fab.style.left = `${this.position.x}px`;
    fab.style.top = `${this.position.y}px`;

    document.body.appendChild(fab);

    // Click to toggle panel
    fab.addEventListener('click', (e) => {
      if (!this.isDragging) {
        this.togglePanel();
      }
    });

    // Make draggable
    this.makeDraggable(fab);

    this.fab = fab;
  }

  /**
   * Make element draggable
   */
  makeDraggable(element) {
    let startX, startY, startPosX, startPosY;
    let hasMoved = false;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click

      startX = e.clientX;
      startY = e.clientY;
      startPosX = this.position.x;
      startPosY = this.position.y;
      hasMoved = false;

      const onMouseMove = (e) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          hasMoved = true;
          this.isDragging = true;
        }

        this.position.x = Math.max(0, Math.min(window.innerWidth - 60, startPosX + dx));
        this.position.y = Math.max(0, Math.min(window.innerHeight - 60, startPosY + dy));

        element.style.left = `${this.position.x}px`;
        element.style.top = `${this.position.y}px`;
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        setTimeout(() => {
          this.isDragging = false;
        }, 100);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  /**
   * Setup quick actions
   */
  setupQuickActions() {
    this.quickActions = [
      {
        id: 'favorites',
        icon: '⭐',
        label: 'Favorites',
        description: 'View all favorites',
        shortcut: 'Ctrl+Alt+F',
        action: () => window.universalFavorites?.showFavoritesPanel()
      },
      {
        id: 'recent',
        icon: '🕐',
        label: 'Recent',
        description: 'Recently used items',
        shortcut: 'Ctrl+Shift+R',
        action: () => window.universalFavorites?.showRecentPanel()
      },
      {
        id: 'search',
        icon: '🔍',
        label: 'Search',
        description: 'Advanced search',
        shortcut: 'Ctrl+K',
        action: () => window.advancedSearch?.showPanel()
      },
      {
        id: 'snippets',
        icon: '📝',
        label: 'Snippets',
        description: 'Snippet library',
        shortcut: 'Ctrl+B',
        action: () => window.DevChef?.showSnippetsLibrary()
      },
      {
        id: 'macros',
        icon: '🔴',
        label: 'Record Macro',
        description: 'Start/stop recording',
        shortcut: 'Ctrl+Shift+M',
        action: () => window.productivityEngine?.toggleRecording()
      },
      {
        id: 'batch',
        icon: '⚡',
        label: 'Batch Process',
        description: 'Process multiple items',
        shortcut: 'Ctrl+Shift+B',
        action: () => window.productivityEngine?.showBatchProcessor()
      },
      {
        id: 'history',
        icon: '📜',
        label: 'Command History',
        description: 'View command history',
        shortcut: 'Ctrl+Shift+H',
        action: () => window.productivityEngine?.showCommandHistory()
      },
      {
        id: 'devtools',
        icon: '🛠️',
        label: 'DevTools',
        description: 'Open developer tools',
        shortcut: 'F12',
        action: () => window.devTools?.toggle()
      },
      {
        id: 'performance',
        icon: '🚀',
        label: 'Performance',
        description: 'Performance monitor',
        shortcut: '',
        action: () => window.performanceMonitor?.showPanel()
      },
      {
        id: 'quick-actions',
        icon: '⚡',
        label: 'Quick Actions',
        description: 'All quick actions',
        shortcut: 'Ctrl+Space',
        action: () => window.DevChef?.showQuickActionsDialog()
      }
    ];
  }

  /**
   * Setup gestures
   */
  setupGestures() {
    // Double-tap ESC to show quick panel
    let lastEscPress = 0;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const now = Date.now();
        if (now - lastEscPress < 500) {
          // Double ESC
          this.togglePanel();
        }
        lastEscPress = now;
      }

      // Ctrl+Shift+Q - Toggle quick panel
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Q') {
        e.preventDefault();
        this.togglePanel();
      }
    });
  }

  /**
   * Toggle panel
   */
  togglePanel() {
    if (this.isOpen) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  /**
   * Open panel
   */
  openPanel() {
    if (this.isOpen) return;

    this.isOpen = true;
    this.fab?.classList.add('active');

    const panel = document.createElement('div');
    panel.id = 'quick-panel';
    panel.className = 'quick-panel';
    panel.innerHTML = `
      <div class="quick-panel-header">
        <h3>⚡ Quick Panel</h3>
        <button class="panel-close" id="quick-panel-close">✕</button>
      </div>
      <div class="quick-panel-search">
        <input type="text" id="quick-panel-search-input" placeholder="Search actions..." autofocus>
      </div>
      <div class="quick-panel-grid">
        ${this.quickActions.map(action => `
          <div class="quick-action-card" data-action-id="${action.id}">
            <div class="action-icon">${action.icon}</div>
            <div class="action-label">${action.label}</div>
            ${action.shortcut ? `<div class="action-shortcut">${action.shortcut}</div>` : ''}
          </div>
        `).join('')}
      </div>
      <div class="quick-panel-footer">
        <span class="hint">Double-tap ESC or Ctrl+Shift+Q to toggle</span>
      </div>
    `;

    // Position panel near FAB
    panel.style.position = 'fixed';
    if (this.position.x > window.innerWidth / 2) {
      panel.style.right = `${window.innerWidth - this.position.x}px`;
    } else {
      panel.style.left = `${this.position.x}px`;
    }

    if (this.position.y > window.innerHeight / 2) {
      panel.style.bottom = `${window.innerHeight - this.position.y + 70}px`;
    } else {
      panel.style.top = `${this.position.y + 70}px`;
    }

    document.body.appendChild(panel);
    setTimeout(() => panel.classList.add('show'), 10);

    // Setup event listeners
    this.setupPanelListeners(panel);

    this.panel = panel;
  }

  /**
   * Setup panel event listeners
   */
  setupPanelListeners(panel) {
    // Close button
    panel.querySelector('#quick-panel-close')?.addEventListener('click', () => {
      this.closePanel();
    });

    // Action cards
    panel.querySelectorAll('.quick-action-card').forEach(card => {
      card.addEventListener('click', () => {
        const actionId = card.dataset.actionId;
        this.executeAction(actionId);
      });
    });

    // Search
    const searchInput = panel.querySelector('#quick-panel-search-input');
    searchInput?.addEventListener('input', (e) => {
      this.filterActions(e.target.value);
    });

    // ESC to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closePanel();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Click outside to close
    const clickHandler = (e) => {
      if (!panel.contains(e.target) && !this.fab.contains(e.target)) {
        this.closePanel();
        document.removeEventListener('click', clickHandler);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', clickHandler);
    }, 100);
  }

  /**
   * Close panel
   */
  closePanel() {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.fab?.classList.remove('active');

    if (this.panel) {
      this.panel.classList.remove('show');
      setTimeout(() => {
        this.panel?.remove();
        this.panel = null;
      }, 200);
    }
  }

  /**
   * Execute action
   */
  executeAction(actionId) {
    const action = this.quickActions.find(a => a.id === actionId);
    if (action && action.action) {
      this.closePanel();
      setTimeout(() => {
        try {
          action.action();
        } catch (error) {
          console.error('Error executing action:', error);
        }
      }, 100);
    }
  }

  /**
   * Filter actions
   */
  filterActions(query) {
    if (!this.panel) return;

    const lowerQuery = query.toLowerCase();
    const cards = this.panel.querySelectorAll('.quick-action-card');

    cards.forEach(card => {
      const actionId = card.dataset.actionId;
      const action = this.quickActions.find(a => a.id === actionId);

      if (!action) return;

      const matches =
        action.label.toLowerCase().includes(lowerQuery) ||
        action.description.toLowerCase().includes(lowerQuery) ||
        (action.shortcut && action.shortcut.toLowerCase().includes(lowerQuery));

      card.style.display = matches ? 'flex' : 'none';
    });
  }

  /**
   * Add custom action
   */
  addAction(action) {
    this.quickActions.push(action);
  }

  /**
   * Remove action
   */
  removeAction(actionId) {
    this.quickActions = this.quickActions.filter(a => a.id !== actionId);
  }

  /**
   * Hide FAB
   */
  hide() {
    if (this.fab) {
      this.fab.style.display = 'none';
    }
  }

  /**
   * Show FAB
   */
  show() {
    if (this.fab) {
      this.fab.style.display = 'flex';
    }
  }
}

// Create and export singleton
export const quickPanel = new QuickPanel();
window.quickPanel = quickPanel;
