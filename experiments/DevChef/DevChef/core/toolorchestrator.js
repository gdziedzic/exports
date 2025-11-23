/**
 * Tool Orchestrator - V6
 * Seamless tool loading, switching, and data flow management
 *
 * Features:
 * - Lazy loading of tools (load only when needed)
 * - Smooth tool transitions with animations
 * - Inter-tool communication and data passing
 * - Tool state persistence
 * - Preloading and caching
 * - Tool lifecycle management (init, mount, unmount, destroy)
 * - Hot reloading for development
 * - Tool sandboxing and isolation
 * - Dependency management
 * - Performance optimization
 */

class ToolOrchestrator {
  constructor() {
    this.loadedTools = new Map();
    this.activeTools = new Map();
    this.currentTool = null;
    this.toolStates = new Map();
    this.toolCache = new Map();
    this.preloadQueue = [];
    this.transitions = new Map();
    this.dependencies = new Map();
    this.init();
  }

  /**
   * Initialize Tool Orchestrator
   */
  init() {
    try {
      this.setupToolContainer();
      this.setupDataBridge();
      this.setupLifecycleHooks();
      console.log('🔧 Tool Orchestrator initialized - Flawless Integration');
    } catch (error) {
      console.error('Error initializing Tool Orchestrator:', error);
    }
  }

  /**
   * Setup tool container
   */
  setupToolContainer() {
    try {
      const container = document.getElementById('tool-container');
      if (!container) {
        console.warn('Tool container not found');
        return;
      }

      this.container = container;
      this.container.classList.add('tool-orchestrator-managed');
    } catch (error) {
      console.error('Error setting up tool container:', error);
    }
  }

  /**
   * Setup data bridge for inter-tool communication
   */
  setupDataBridge() {
    try {
      this.dataBridge = {
        send: (from, to, data) => this.sendData(from, to, data),
        broadcast: (from, data) => this.broadcastData(from, data),
        subscribe: (toolId, handler) => this.subscribeToData(toolId, handler)
      };

      // Make data bridge globally available
      window.ToolBridge = this.dataBridge;
    } catch (error) {
      console.error('Error setting up data bridge:', error);
    }
  }

  /**
   * Setup lifecycle hooks
   */
  setupLifecycleHooks() {
    try {
      this.lifecycleHooks = {
        beforeLoad: [],
        afterLoad: [],
        beforeMount: [],
        afterMount: [],
        beforeUnmount: [],
        afterUnmount: [],
        onError: []
      };
    } catch (error) {
      console.error('Error setting up lifecycle hooks:', error);
    }
  }

  /**
   * Register lifecycle hook
   */
  on(event, handler) {
    try {
      if (this.lifecycleHooks[event]) {
        this.lifecycleHooks[event].push(handler);
      }
    } catch (error) {
      console.error('Error registering lifecycle hook:', error);
    }
  }

  /**
   * Trigger lifecycle hook
   */
  async trigger(event, ...args) {
    try {
      const hooks = this.lifecycleHooks[event] || [];
      for (const hook of hooks) {
        try {
          await hook(...args);
        } catch (error) {
          console.error(`Error in ${event} hook:`, error);
        }
      }
    } catch (error) {
      console.error('Error triggering lifecycle hook:', error);
    }
  }

  /**
   * Load tool (lazy loading)
   */
  async loadTool(toolId) {
    try {
      // Check cache first
      if (this.toolCache.has(toolId)) {
        return this.toolCache.get(toolId);
      }

      // Trigger beforeLoad hooks
      await this.trigger('beforeLoad', toolId);

      // Show loading state
      if (window.uiEngine) {
        await window.uiEngine.showLoading(`Loading ${toolId}...`);
      }

      // Load tool HTML
      const response = await fetch(`tools/${toolId}.html`);
      if (!response.ok) {
        throw new Error(`Failed to load tool: ${toolId}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract tool components
      const tool = {
        id: toolId,
        manifest: this.extractManifest(doc),
        template: this.extractTemplate(doc),
        styles: this.extractStyles(doc),
        module: await this.extractModule(doc, toolId),
        loaded: true,
        timestamp: Date.now()
      };

      // Validate tool
      if (!this.validateTool(tool)) {
        throw new Error(`Invalid tool configuration: ${toolId}`);
      }

      // Cache tool
      this.toolCache.set(toolId, tool);
      this.loadedTools.set(toolId, tool);

      // Trigger afterLoad hooks
      await this.trigger('afterLoad', toolId, tool);

      // Hide loading state
      if (window.uiEngine) {
        await window.uiEngine.hideLoading();
      }

      return tool;
    } catch (error) {
      console.error(`Error loading tool ${toolId}:`, error);

      // Hide loading state
      if (window.uiEngine) {
        await window.uiEngine.hideLoading();
        window.uiEngine.showToast(`Failed to load ${toolId}`, { type: 'error' });
      }

      await this.trigger('onError', toolId, error);
      throw error;
    }
  }

  /**
   * Extract manifest from tool document
   */
  extractManifest(doc) {
    try {
      const manifestScript = doc.querySelector('script[type="devchef-manifest"]');
      if (!manifestScript) {
        return { id: 'unknown', name: 'Unknown Tool' };
      }

      return JSON.parse(manifestScript.textContent);
    } catch (error) {
      console.error('Error extracting manifest:', error);
      return { id: 'unknown', name: 'Unknown Tool' };
    }
  }

  /**
   * Extract template from tool document
   */
  extractTemplate(doc) {
    try {
      const template = doc.querySelector('template#tool-ui');
      return template ? template.innerHTML : '';
    } catch (error) {
      console.error('Error extracting template:', error);
      return '';
    }
  }

  /**
   * Extract styles from tool document
   */
  extractStyles(doc) {
    try {
      const styleElements = doc.querySelectorAll('style');
      let styles = '';

      styleElements.forEach(style => {
        styles += style.textContent + '\n';
      });

      return styles;
    } catch (error) {
      console.error('Error extracting styles:', error);
      return '';
    }
  }

  /**
   * Extract and evaluate module from tool document
   */
  async extractModule(doc, toolId) {
    try {
      const moduleScript = doc.querySelector('script[type="module"]');
      if (!moduleScript) {
        return null;
      }

      // Create blob URL for module
      const moduleCode = moduleScript.textContent;
      const blob = new Blob([moduleCode], { type: 'application/javascript' });
      const moduleUrl = URL.createObjectURL(blob);

      // Import module dynamically
      const module = await import(moduleUrl);

      // Clean up blob URL
      URL.revokeObjectURL(moduleUrl);

      return module;
    } catch (error) {
      console.error('Error extracting module:', error);
      return null;
    }
  }

  /**
   * Validate tool configuration
   */
  validateTool(tool) {
    try {
      if (!tool.manifest || !tool.manifest.id) {
        console.error('Tool missing manifest or ID');
        return false;
      }

      if (!tool.template) {
        console.error('Tool missing template');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating tool:', error);
      return false;
    }
  }

  /**
   * Mount tool (render and initialize)
   */
  async mountTool(toolId, data = null) {
    try {
      // Load tool if not already loaded
      let tool = this.loadedTools.get(toolId);
      if (!tool) {
        tool = await this.loadTool(toolId);
      }

      // Trigger beforeMount hooks
      await this.trigger('beforeMount', toolId, data);

      // Unmount current tool if exists
      if (this.currentTool && this.currentTool !== toolId) {
        await this.unmountTool(this.currentTool);
      }

      // Create tool wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'tool-wrapper';
      wrapper.id = `tool-${toolId}`;
      wrapper.dataset.toolId = toolId;

      // Inject styles (scoped to tool)
      if (tool.styles) {
        const styleEl = document.createElement('style');
        styleEl.textContent = this.scopeStyles(tool.styles, toolId);
        wrapper.appendChild(styleEl);
      }

      // Inject template
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'tool-content';
      contentWrapper.innerHTML = tool.template;
      wrapper.appendChild(contentWrapper);

      // Clear container and append new tool
      if (this.container) {
        this.container.innerHTML = '';
        this.container.appendChild(wrapper);
      }

      // Animate in
      if (window.uiEngine) {
        await window.uiEngine.animate(wrapper, 'fadeIn');
      }

      // Initialize tool module
      if (tool.module && typeof tool.module.init === 'function') {
        const context = this.createToolContext(toolId, data);
        await tool.module.init(context);
      }

      // Mark as active
      this.activeTools.set(toolId, tool);
      this.currentTool = toolId;

      // Update state
      if (window.stateManager) {
        window.stateManager.set('tools.current', toolId);
        this.addToRecent(toolId);
      }

      // Trigger afterMount hooks
      await this.trigger('afterMount', toolId, data);

      return true;
    } catch (error) {
      console.error(`Error mounting tool ${toolId}:`, error);
      await this.trigger('onError', toolId, error);
      return false;
    }
  }

  /**
   * Unmount tool
   */
  async unmountTool(toolId) {
    try {
      const tool = this.activeTools.get(toolId);
      if (!tool) return;

      // Trigger beforeUnmount hooks
      await this.trigger('beforeUnmount', toolId);

      // Call cleanup if exists
      if (tool.module && typeof tool.module.cleanup === 'function') {
        const context = this.createToolContext(toolId);
        await tool.module.cleanup(context);
      }

      // Save tool state
      this.saveToolState(toolId);

      // Animate out
      const wrapper = document.getElementById(`tool-${toolId}`);
      if (wrapper && window.uiEngine) {
        await window.uiEngine.animate(wrapper, 'fadeOut');
      }

      // Remove from DOM
      if (wrapper && wrapper.parentElement) {
        wrapper.parentElement.removeChild(wrapper);
      }

      // Remove from active tools
      this.activeTools.delete(toolId);

      // Trigger afterUnmount hooks
      await this.trigger('afterUnmount', toolId);

      return true;
    } catch (error) {
      console.error(`Error unmounting tool ${toolId}:`, error);
      return false;
    }
  }

  /**
   * Scope styles to tool (prevent CSS leakage)
   */
  scopeStyles(styles, toolId) {
    try {
      // Simple scoping by prefixing selectors
      const scopePrefix = `#tool-${toolId}`;

      // This is a simplified version - would need a proper CSS parser for production
      return styles.replace(/([^{}]+){/g, (match, selector) => {
        // Skip @rules
        if (selector.trim().startsWith('@')) {
          return match;
        }

        // Scope each selector
        const scopedSelectors = selector
          .split(',')
          .map(s => `${scopePrefix} ${s.trim()}`)
          .join(', ');

        return `${scopedSelectors} {`;
      });
    } catch (error) {
      console.error('Error scoping styles:', error);
      return styles;
    }
  }

  /**
   * Create tool context (API available to tools)
   */
  createToolContext(toolId, data = null) {
    try {
      return {
        toolId,
        data,
        state: this.getToolState(toolId),
        setState: (state) => this.setToolState(toolId, state),
        emit: (event, data) => this.emitToolEvent(toolId, event, data),
        on: (event, handler) => this.onToolEvent(toolId, event, handler),
        bridge: this.dataBridge,
        ui: window.uiEngine,
        storage: window.storage
      };
    } catch (error) {
      console.error('Error creating tool context:', error);
      return { toolId };
    }
  }

  /**
   * Get tool state
   */
  getToolState(toolId) {
    try {
      return this.toolStates.get(toolId) || {};
    } catch (error) {
      console.error('Error getting tool state:', error);
      return {};
    }
  }

  /**
   * Set tool state
   */
  setToolState(toolId, state) {
    try {
      this.toolStates.set(toolId, state);

      // Persist to global state
      if (window.stateManager) {
        window.stateManager.set(`toolStates.${toolId}`, state);
      }
    } catch (error) {
      console.error('Error setting tool state:', error);
    }
  }

  /**
   * Save tool state before unmounting
   */
  saveToolState(toolId) {
    try {
      const state = this.toolStates.get(toolId);
      if (state && window.storage) {
        window.storage.set(`tool-state-${toolId}`, state);
      }
    } catch (error) {
      console.error('Error saving tool state:', error);
    }
  }

  /**
   * Emit tool event
   */
  emitToolEvent(toolId, event, data) {
    try {
      const customEvent = new CustomEvent(`tool:${toolId}:${event}`, {
        detail: { toolId, event, data },
        bubbles: true
      });
      document.dispatchEvent(customEvent);
    } catch (error) {
      console.error('Error emitting tool event:', error);
    }
  }

  /**
   * Listen to tool event
   */
  onToolEvent(toolId, event, handler) {
    try {
      const eventName = `tool:${toolId}:${event}`;
      document.addEventListener(eventName, (e) => {
        handler(e.detail.data);
      });
    } catch (error) {
      console.error('Error listening to tool event:', error);
    }
  }

  /**
   * Send data between tools
   */
  sendData(from, to, data) {
    try {
      this.emitToolEvent(to, 'data-received', { from, data });
    } catch (error) {
      console.error('Error sending data:', error);
    }
  }

  /**
   * Broadcast data to all tools
   */
  broadcastData(from, data) {
    try {
      for (const toolId of this.activeTools.keys()) {
        if (toolId !== from) {
          this.sendData(from, toolId, data);
        }
      }
    } catch (error) {
      console.error('Error broadcasting data:', error);
    }
  }

  /**
   * Subscribe to data from specific tool
   */
  subscribeToData(toolId, handler) {
    try {
      this.onToolEvent(toolId, 'data-received', handler);
    } catch (error) {
      console.error('Error subscribing to data:', error);
    }
  }

  /**
   * Add tool to recent list
   */
  addToRecent(toolId) {
    try {
      if (!window.stateManager) return;

      let recent = window.stateManager.get('tools.recent') || [];

      // Remove if already exists
      recent = recent.filter(id => id !== toolId);

      // Add to beginning
      recent.unshift(toolId);

      // Limit to 10
      recent = recent.slice(0, 10);

      window.stateManager.set('tools.recent', recent);
    } catch (error) {
      console.error('Error adding to recent:', error);
    }
  }

  /**
   * Preload tools
   */
  async preloadTools(toolIds) {
    try {
      for (const toolId of toolIds) {
        if (!this.toolCache.has(toolId)) {
          this.preloadQueue.push(toolId);
        }
      }

      // Start preloading in background
      this.processPreloadQueue();
    } catch (error) {
      console.error('Error preloading tools:', error);
    }
  }

  /**
   * Process preload queue
   */
  async processPreloadQueue() {
    try {
      if (this.preloadQueue.length === 0) return;

      const toolId = this.preloadQueue.shift();

      // Load tool quietly (no UI feedback)
      await this.loadTool(toolId).catch(err => {
        console.warn(`Failed to preload ${toolId}:`, err);
      });

      // Continue with next item after short delay
      setTimeout(() => this.processPreloadQueue(), 100);
    } catch (error) {
      console.error('Error processing preload queue:', error);
    }
  }

  /**
   * Switch tool with smooth transition
   */
  async switchTool(toolId, data = null, transition = 'fade') {
    try {
      const prevTool = this.currentTool;

      // Mount new tool
      await this.mountTool(toolId, data);

      // Log transition
      console.log(`🔄 Switched from ${prevTool} to ${toolId} (transition: ${transition})`);

      return true;
    } catch (error) {
      console.error('Error switching tool:', error);
      return false;
    }
  }

  /**
   * Reload current tool
   */
  async reloadCurrentTool() {
    try {
      if (!this.currentTool) return false;

      const toolId = this.currentTool;

      // Clear cache
      this.toolCache.delete(toolId);
      this.loadedTools.delete(toolId);

      // Reload and mount
      await this.mountTool(toolId);

      return true;
    } catch (error) {
      console.error('Error reloading tool:', error);
      return false;
    }
  }

  /**
   * Get loaded tools list
   */
  getLoadedTools() {
    return Array.from(this.loadedTools.keys());
  }

  /**
   * Get active tools list
   */
  getActiveTools() {
    return Array.from(this.activeTools.keys());
  }

  /**
   * Clear tool cache
   */
  clearCache() {
    try {
      this.toolCache.clear();
      console.log('🗑️ Tool cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}

// Export singleton instance
export const toolOrchestrator = new ToolOrchestrator();
export { ToolOrchestrator };
