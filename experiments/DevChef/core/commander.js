/**
 * DevChef V3 - Command Runner & Scripting Engine
 * Powerful automation and scripting for 10x developers
 */

class Commander {
  constructor() {
    this.commands = new Map();
    this.aliases = new Map();
    this.history = [];
    this.macros = new Map();
    this.scripts = new Map();
    this.registerBuiltinCommands();
  }

  /**
   * Register built-in commands
   */
  registerBuiltinCommands() {
    // Tool commands
    this.register('open', {
      description: 'Open a tool',
      usage: 'open <tool-id>',
      handler: async (args) => {
        if (!args[0]) return { error: 'Tool ID required' };
        if (window.DevChef?.openTool) {
          window.DevChef.openTool(args[0]);
          return { success: true, message: `Opened tool: ${args[0]}` };
        }
        return { error: 'Tool system not available' };
      }
    });

    this.register('tools', {
      description: 'List all tools',
      usage: 'tools [filter]',
      handler: async (args) => {
        const tools = window.DevChef?.ToolRegistry?.tools || new Map();
        const filter = args[0]?.toLowerCase();

        const filtered = Array.from(tools.values())
          .filter(tool => !filter || tool.manifest.name.toLowerCase().includes(filter));

        return {
          success: true,
          data: filtered.map(t => ({ id: t.manifest.id, name: t.manifest.name })),
          message: `Found ${filtered.length} tools`
        };
      }
    });

    // Data commands
    this.register('export', {
      description: 'Export data',
      usage: 'export <type> [format]',
      handler: async (args) => {
        const type = args[0];
        const format = args[1] || 'json';

        if (!type) return { error: 'Export type required (favorites, history, snippets, all)' };

        const data = await this.exportData(type);
        this.downloadData(data, `devchef-${type}-${Date.now()}.${format}`, format);

        return { success: true, message: `Exported ${type} as ${format}` };
      }
    });

    this.register('import', {
      description: 'Import data from file',
      usage: 'import <file>',
      handler: async (args) => {
        return { error: 'Import via file picker (interactive command)' };
      }
    });

    // Snippet commands
    this.register('snippet', {
      description: 'Manage snippets',
      usage: 'snippet <create|list|search> [query]',
      handler: async (args) => {
        const action = args[0];

        if (action === 'list') {
          const snippets = window.DevChef?.snippetManager?.getSnippets() || [];
          return { success: true, data: snippets, message: `${snippets.length} snippets` };
        }

        if (action === 'search') {
          const query = args.slice(1).join(' ');
          const snippets = window.DevChef?.snippetManager?.getSnippets({ search: query }) || [];
          return { success: true, data: snippets, message: `Found ${snippets.length} snippets` };
        }

        return { error: 'Usage: snippet <create|list|search> [query]' };
      }
    });

    // Analytics commands
    this.register('stats', {
      description: 'View analytics and stats',
      usage: 'stats [type]',
      handler: async (args) => {
        const insights = window.DevChef?.analytics?.getInsights();
        return { success: true, data: insights, message: 'Analytics data' };
      }
    });

    // Backup commands
    this.register('backup', {
      description: 'Create backup',
      usage: 'backup [type]',
      handler: async (args) => {
        if (window.DevChef?.backupManager) {
          const backup = window.DevChef.backupManager.createBackup('manual');
          return { success: true, data: backup, message: 'Backup created' };
        }
        return { error: 'Backup system not available' };
      }
    });

    // Theme commands
    this.register('theme', {
      description: 'Change theme',
      usage: 'theme <light|dark|toggle>',
      handler: async (args) => {
        const action = args[0];

        if (action === 'toggle' || !action) {
          document.body.dataset.theme =
            document.body.dataset.theme === 'dark' ? 'light' : 'dark';
          return { success: true, message: `Theme: ${document.body.dataset.theme}` };
        }

        if (action === 'light' || action === 'dark') {
          document.body.dataset.theme = action;
          return { success: true, message: `Theme: ${action}` };
        }

        return { error: 'Usage: theme <light|dark|toggle>' };
      }
    });

    // Search commands
    this.register('search', {
      description: 'Search tools',
      usage: 'search <query>',
      handler: async (args) => {
        const query = args.join(' ');
        if (!query) return { error: 'Search query required' };

        const tools = window.DevChef?.ToolRegistry?.tools || new Map();
        const results = Array.from(tools.values())
          .filter(tool =>
            tool.manifest.name.toLowerCase().includes(query.toLowerCase()) ||
            tool.manifest.description?.toLowerCase().includes(query.toLowerCase())
          );

        return { success: true, data: results, message: `Found ${results.length} results` };
      }
    });

    // System commands
    this.register('clear', {
      description: 'Clear command history',
      usage: 'clear',
      handler: async () => {
        this.history = [];
        return { success: true, message: 'History cleared' };
      }
    });

    this.register('help', {
      description: 'Show available commands',
      usage: 'help [command]',
      handler: async (args) => {
        if (args[0]) {
          const cmd = this.commands.get(args[0]);
          if (!cmd) return { error: `Unknown command: ${args[0]}` };
          return {
            success: true,
            data: {
              command: args[0],
              description: cmd.description,
              usage: cmd.usage,
              aliases: this.getAliases(args[0])
            }
          };
        }

        const commands = Array.from(this.commands.entries()).map(([name, cmd]) => ({
          name,
          description: cmd.description,
          usage: cmd.usage
        }));

        return { success: true, data: commands, message: `${commands.length} commands available` };
      }
    });

    this.register('version', {
      description: 'Show version info',
      usage: 'version',
      handler: async () => {
        return {
          success: true,
          data: {
            version: '3.0.0',
            codename: '10x Developer Edition',
            build: Date.now()
          }
        };
      }
    });

    // Macro commands
    this.register('macro', {
      description: 'Manage macros',
      usage: 'macro <create|run|list|delete> [name]',
      handler: async (args) => {
        const action = args[0];
        const name = args[1];

        if (action === 'list') {
          const macros = Array.from(this.macros.entries()).map(([n, m]) => ({
            name: n,
            commands: m.commands.length,
            description: m.description
          }));
          return { success: true, data: macros, message: `${macros.length} macros` };
        }

        if (action === 'run' && name) {
          return await this.runMacro(name);
        }

        if (action === 'delete' && name) {
          this.macros.delete(name);
          return { success: true, message: `Macro deleted: ${name}` };
        }

        return { error: 'Usage: macro <create|run|list|delete> [name]' };
      }
    });

    // Clipboard commands
    this.register('clip', {
      description: 'Clipboard operations',
      usage: 'clip <copy|paste>',
      handler: async (args) => {
        const action = args[0];

        if (action === 'paste') {
          const text = await navigator.clipboard.readText();
          return { success: true, data: text, message: 'Clipboard content' };
        }

        if (action === 'copy') {
          const text = args.slice(1).join(' ');
          await navigator.clipboard.writeText(text);
          return { success: true, message: 'Copied to clipboard' };
        }

        return { error: 'Usage: clip <copy|paste>' };
      }
    });

    // Shortcut aliases
    this.alias('o', 'open');
    this.alias('t', 'tools');
    this.alias('s', 'search');
    this.alias('e', 'export');
    this.alias('i', 'import');
    this.alias('h', 'help');
    this.alias('?', 'help');
    this.alias('v', 'version');
  }

  /**
   * Register command
   */
  register(name, command) {
    this.commands.set(name, command);
  }

  /**
   * Create command alias
   */
  alias(alias, command) {
    this.aliases.set(alias, command);
  }

  /**
   * Get aliases for command
   */
  getAliases(command) {
    return Array.from(this.aliases.entries())
      .filter(([_, cmd]) => cmd === command)
      .map(([alias, _]) => alias);
  }

  /**
   * Execute command
   */
  async execute(input) {
    try {
      // Parse input
      const parts = input.trim().split(/\s+/);
      let commandName = parts[0];
      const args = parts.slice(1);

      // Resolve alias
      if (this.aliases.has(commandName)) {
        commandName = this.aliases.get(commandName);
      }

      // Get command
      const command = this.commands.get(commandName);
      if (!command) {
        return { error: `Unknown command: ${commandName}. Type 'help' for available commands.` };
      }

      // Add to history
      this.history.push({ input, timestamp: Date.now() });

      // Execute command
      const result = await command.handler(args);

      // Track in analytics
      if (window.DevChef?.analytics) {
        window.DevChef.analytics.trackEvent('command', { command: commandName, args });
      }

      return result;
    } catch (error) {
      return { error: error.message, stack: error.stack };
    }
  }

  /**
   * Create macro
   */
  createMacro(name, commands, description = '') {
    this.macros.set(name, {
      name,
      commands,
      description,
      createdAt: Date.now()
    });
  }

  /**
   * Run macro
   */
  async runMacro(name) {
    const macro = this.macros.get(name);
    if (!macro) {
      return { error: `Macro not found: ${name}` };
    }

    const results = [];
    for (const cmd of macro.commands) {
      const result = await this.execute(cmd);
      results.push({ command: cmd, result });

      // Stop on error
      if (result.error) break;
    }

    return {
      success: true,
      data: results,
      message: `Macro executed: ${name} (${results.length} commands)`
    };
  }

  /**
   * Run script
   */
  async runScript(script) {
    const lines = script.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    const results = [];

    for (const line of lines) {
      const result = await this.execute(line);
      results.push({ line, result });

      if (result.error) break;
    }

    return { success: true, data: results, message: `Script executed (${results.length} commands)` };
  }

  /**
   * Save script
   */
  saveScript(name, script, description = '') {
    this.scripts.set(name, {
      name,
      script,
      description,
      createdAt: Date.now()
    });
  }

  /**
   * Export data helper
   */
  async exportData(type) {
    const data = {};

    switch (type) {
      case 'favorites':
        data.favorites = window.DevChef?.storage?.getFavorites();
        break;
      case 'history':
        data.history = window.DevChef?.storage?.getHistory();
        break;
      case 'snippets':
        data.snippets = window.DevChef?.snippetManager?.getSnippets();
        break;
      case 'pipelines':
        data.pipelines = window.DevChef?.pipelineManager?.pipelines;
        break;
      case 'all':
        data.favorites = window.DevChef?.storage?.getFavorites();
        data.history = window.DevChef?.storage?.getHistory();
        data.snippets = window.DevChef?.snippetManager?.getSnippets();
        data.pipelines = window.DevChef?.pipelineManager?.pipelines;
        data.analytics = window.DevChef?.analytics?.sessions;
        break;
      default:
        throw new Error(`Unknown export type: ${type}`);
    }

    return data;
  }

  /**
   * Download data helper
   */
  downloadData(data, filename, format) {
    let content, mimeType;

    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json';
    } else if (format === 'csv') {
      content = this.convertToCSV(data);
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(data, null, 2);
      mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Convert to CSV
   */
  convertToCSV(data) {
    // Simple CSV conversion for arrays
    if (Array.isArray(data)) {
      const headers = Object.keys(data[0] || {});
      const rows = data.map(item =>
        headers.map(h => JSON.stringify(item[h] || '')).join(',')
      );
      return [headers.join(','), ...rows].join('\n');
    }
    return JSON.stringify(data);
  }

  /**
   * Get command history
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Get all commands
   */
  getCommands() {
    return Array.from(this.commands.keys());
  }

  /**
   * Auto-complete command
   */
  autocomplete(partial) {
    const commands = this.getCommands();
    const aliases = Array.from(this.aliases.keys());
    const all = [...commands, ...aliases];

    return all.filter(cmd => cmd.startsWith(partial));
  }
}

// Create singleton instance
export const commander = new Commander();

// Export class for testing
export { Commander };
