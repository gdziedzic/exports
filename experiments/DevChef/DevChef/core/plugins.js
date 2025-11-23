/**
 * DevChef V3 - Plugin System
 * Extensible plugin architecture for unlimited customization
 */

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
    this.api = this.createAPI();
    this.loadedPlugins = new Set();
    this.pluginStates = new Map();
  }

  /**
   * Create plugin API
   */
  createAPI() {
    return {
      // Core API
      version: '3.0.0',
      registerTool: (manifest, handler) => this.registerTool(manifest, handler),
      registerHook: (name, callback) => this.registerHook(name, callback),
      executeHook: (name, data) => this.executeHook(name, data),

      // Storage API
      storage: {
        get: (key) => localStorage.getItem(`plugin-${key}`),
        set: (key, value) => localStorage.setItem(`plugin-${key}`, value),
        remove: (key) => localStorage.removeItem(`plugin-${key}`),
        clear: () => this.clearPluginStorage()
      },

      // UI API
      ui: {
        showNotification: (message, options) => this.showNotification(message, options),
        showDialog: (content, options) => this.showDialog(content, options),
        addMenuItem: (label, handler) => this.addMenuItem(label, handler),
        addToolbarButton: (icon, handler, tooltip) => this.addToolbarButton(icon, handler, tooltip)
      },

      // Tool API
      tools: {
        getAll: () => window.DevChef?.ToolRegistry?.tools || [],
        getCurrent: () => window.DevChef?.context?.currentTool,
        open: (toolId) => window.DevChef?.openTool?.(toolId),
        close: () => this.closeTool()
      },

      // Data API
      data: {
        getFavorites: () => window.DevChef?.storage?.getFavorites(),
        getHistory: () => window.DevChef?.storage?.getHistory(),
        getSnippets: () => window.DevChef?.snippetManager?.getSnippets(),
        getPipelines: () => window.DevChef?.pipelineManager?.pipelines
      },

      // Event API
      events: {
        on: (event, handler) => this.on(event, handler),
        off: (event, handler) => this.off(event, handler),
        emit: (event, data) => this.emit(event, data)
      },

      // HTTP API
      http: {
        get: (url, options) => fetch(url, { ...options, method: 'GET' }),
        post: (url, data, options) => fetch(url, { ...options, method: 'POST', body: JSON.stringify(data) }),
        request: (url, options) => fetch(url, options)
      },

      // Clipboard API
      clipboard: {
        read: () => navigator.clipboard.readText(),
        write: (text) => navigator.clipboard.writeText(text),
        detect: (text) => window.DevChef?.clipboardDetector?.detect(text)
      },

      // Analytics API
      analytics: {
        track: (event, data) => window.DevChef?.analytics?.trackEvent(event, data),
        getInsights: () => window.DevChef?.analytics?.getInsights()
      }
    };
  }

  /**
   * Register plugin
   */
  async registerPlugin(plugin) {
    try {
      // Validate plugin
      if (!plugin.id || !plugin.name || !plugin.init) {
        throw new Error('Invalid plugin: missing required fields (id, name, init)');
      }

      // Check if already loaded
      if (this.loadedPlugins.has(plugin.id)) {
        console.warn(`Plugin ${plugin.id} already loaded`);
        return false;
      }

      // Store plugin
      this.plugins.set(plugin.id, plugin);

      // Initialize plugin
      await plugin.init(this.api);

      // Mark as loaded
      this.loadedPlugins.add(plugin.id);
      this.pluginStates.set(plugin.id, { enabled: true, loadedAt: Date.now() });

      console.log(`✓ Plugin loaded: ${plugin.name} v${plugin.version || '1.0.0'}`);

      // Emit event
      this.emit('plugin:loaded', { id: plugin.id, plugin });

      return true;
    } catch (error) {
      console.error(`Failed to load plugin ${plugin.id}:`, error);
      this.emit('plugin:error', { id: plugin.id, error });
      return false;
    }
  }

  /**
   * Unregister plugin
   */
  async unregisterPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    try {
      // Call cleanup if available
      if (plugin.cleanup) {
        await plugin.cleanup();
      }

      // Remove plugin
      this.plugins.delete(pluginId);
      this.loadedPlugins.delete(pluginId);
      this.pluginStates.delete(pluginId);

      // Clear plugin hooks
      for (const [hookName, callbacks] of this.hooks.entries()) {
        this.hooks.set(
          hookName,
          callbacks.filter(cb => cb.pluginId !== pluginId)
        );
      }

      console.log(`✓ Plugin unloaded: ${plugin.name}`);
      this.emit('plugin:unloaded', { id: pluginId });

      return true;
    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Enable/disable plugin
   */
  togglePlugin(pluginId, enabled) {
    const state = this.pluginStates.get(pluginId);
    if (!state) return false;

    state.enabled = enabled;
    this.pluginStates.set(pluginId, state);

    this.emit('plugin:toggled', { id: pluginId, enabled });
    return true;
  }

  /**
   * Register hook callback
   */
  registerHook(name, callback, pluginId = 'core') {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }

    this.hooks.get(name).push({ callback, pluginId });
  }

  /**
   * Execute hook
   */
  async executeHook(name, data = {}) {
    const callbacks = this.hooks.get(name) || [];
    const results = [];

    for (const { callback, pluginId } of callbacks) {
      // Skip if plugin disabled
      const state = this.pluginStates.get(pluginId);
      if (state && !state.enabled) continue;

      try {
        const result = await callback(data);
        results.push({ pluginId, result });
      } catch (error) {
        console.error(`Hook ${name} failed for plugin ${pluginId}:`, error);
        results.push({ pluginId, error });
      }
    }

    return results;
  }

  /**
   * Register custom tool
   */
  registerTool(manifest, handler) {
    // Add to tool registry
    if (window.DevChef?.ToolRegistry) {
      const tool = {
        manifest,
        handler,
        isPlugin: true
      };

      window.DevChef.ToolRegistry.tools.set(manifest.id, tool);
      console.log(`✓ Plugin tool registered: ${manifest.name}`);

      return true;
    }

    return false;
  }

  /**
   * Load plugin from URL
   */
  async loadFromURL(url) {
    try {
      const response = await fetch(url);
      const code = await response.text();

      // Create plugin context
      const pluginContext = { DevChefAPI: this.api };

      // Execute plugin code
      const pluginFactory = new Function('DevChefAPI', code);
      const plugin = pluginFactory(this.api);

      // Register plugin
      return await this.registerPlugin(plugin);
    } catch (error) {
      console.error(`Failed to load plugin from ${url}:`, error);
      return false;
    }
  }

  /**
   * Load plugin from file
   */
  async loadFromFile(file) {
    try {
      const code = await file.text();

      // Execute plugin code
      const pluginFactory = new Function('DevChefAPI', code);
      const plugin = pluginFactory(this.api);

      return await this.registerPlugin(plugin);
    } catch (error) {
      console.error('Failed to load plugin from file:', error);
      return false;
    }
  }

  /**
   * Get all plugins
   */
  getPlugins() {
    return Array.from(this.plugins.values()).map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      version: plugin.version || '1.0.0',
      description: plugin.description || '',
      author: plugin.author || 'Unknown',
      enabled: this.pluginStates.get(plugin.id)?.enabled || false,
      loadedAt: this.pluginStates.get(plugin.id)?.loadedAt
    }));
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId);
  }

  /**
   * Event system
   */
  on(event, handler) {
    this.registerHook(`event:${event}`, handler);
  }

  off(event, handler) {
    const hookName = `event:${event}`;
    const callbacks = this.hooks.get(hookName) || [];
    this.hooks.set(
      hookName,
      callbacks.filter(cb => cb.callback !== handler)
    );
  }

  emit(event, data) {
    return this.executeHook(`event:${event}`, data);
  }

  /**
   * Helper methods
   */
  showNotification(message, options) {
    if (window.DevChef?.notifications) {
      window.DevChef.notifications.show(message, options);
    }
  }

  showDialog(content, options) {
    if (window.DevChef?.notifications) {
      window.DevChef.notifications.show(content, { ...options, duration: 0 });
    }
  }

  addMenuItem(label, handler) {
    // Placeholder for menu integration
    console.log('Menu item added:', label);
  }

  addToolbarButton(icon, handler, tooltip) {
    // Placeholder for toolbar integration
    console.log('Toolbar button added:', icon);
  }

  closeTool() {
    // Placeholder for tool closing
    console.log('Close tool requested');
  }

  clearPluginStorage() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('plugin-')) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Export plugin list
   */
  exportPluginList() {
    const plugins = this.getPlugins();
    const data = {
      version: '3.0.0',
      timestamp: new Date().toISOString(),
      plugins
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devchef-plugins-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Create singleton instance
export const pluginManager = new PluginManager();

// Export class for testing
export { PluginManager };
