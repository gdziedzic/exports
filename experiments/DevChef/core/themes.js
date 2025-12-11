/**
 * DevChef V3 - Theme Engine
 * Powerful theme system with full customization
 */

class ThemeEngine {
  constructor() {
    this.themes = new Map();
    this.currentTheme = 'default-light';
    this.customColors = new Map();
    this.registerDefaultThemes();
    this.loadSavedTheme();
  }

  /**
   * Register default themes
   */
  registerDefaultThemes() {
    // Default Light
    this.register('default-light', {
      name: 'Default Light',
      type: 'light',
      colors: {
        // Base colors
        '--background': '#ffffff',
        '--background-secondary': '#f8f9fa',
        '--background-tertiary': '#e9ecef',
        '--text': '#212529',
        '--text-secondary': '#6c757d',
        '--border': '#dee2e6',

        // Accent colors
        '--accent': '#007bff',
        '--accent-hover': '#0056b3',
        '--accent-bg': 'rgba(0, 123, 255, 0.1)',

        // Status colors
        '--success': '#28a745',
        '--warning': '#ffc107',
        '--error': '#dc3545',
        '--info': '#17a2b8',

        // UI elements
        '--hover': '#f8f9fa',
        '--card-bg': '#ffffff',
        '--input-bg': '#ffffff',
        '--code-bg': '#f8f9fa',
        '--code-text': '#212529',
        '--shadow': 'rgba(0, 0, 0, 0.1)'
      }
    });

    // Default Dark
    this.register('default-dark', {
      name: 'Default Dark',
      type: 'dark',
      colors: {
        '--background': '#1a1a1a',
        '--background-secondary': '#2d2d2d',
        '--background-tertiary': '#3d3d3d',
        '--text': '#e9ecef',
        '--text-secondary': '#adb5bd',
        '--border': '#495057',

        '--accent': '#0d6efd',
        '--accent-hover': '#0b5ed7',
        '--accent-bg': 'rgba(13, 110, 253, 0.15)',

        '--success': '#198754',
        '--warning': '#ffc107',
        '--error': '#dc3545',
        '--info': '#0dcaf0',

        '--hover': '#2d2d2d',
        '--card-bg': '#2d2d2d',
        '--input-bg': '#2d2d2d',
        '--code-bg': '#1a1a1a',
        '--code-text': '#e9ecef',
        '--shadow': 'rgba(0, 0, 0, 0.5)'
      }
    });

    // Dracula
    this.register('dracula', {
      name: 'Dracula',
      type: 'dark',
      colors: {
        '--background': '#282a36',
        '--background-secondary': '#343746',
        '--background-tertiary': '#44475a',
        '--text': '#f8f8f2',
        '--text-secondary': '#6272a4',
        '--border': '#44475a',

        '--accent': '#bd93f9',
        '--accent-hover': '#a67fde',
        '--accent-bg': 'rgba(189, 147, 249, 0.15)',

        '--success': '#50fa7b',
        '--warning': '#f1fa8c',
        '--error': '#ff5555',
        '--info': '#8be9fd',

        '--hover': '#343746',
        '--card-bg': '#343746',
        '--input-bg': '#343746',
        '--code-bg': '#282a36',
        '--code-text': '#f8f8f2',
        '--shadow': 'rgba(0, 0, 0, 0.3)'
      }
    });

    // Nord
    this.register('nord', {
      name: 'Nord',
      type: 'dark',
      colors: {
        '--background': '#2e3440',
        '--background-secondary': '#3b4252',
        '--background-tertiary': '#434c5e',
        '--text': '#eceff4',
        '--text-secondary': '#d8dee9',
        '--border': '#4c566a',

        '--accent': '#88c0d0',
        '--accent-hover': '#6fa8b7',
        '--accent-bg': 'rgba(136, 192, 208, 0.15)',

        '--success': '#a3be8c',
        '--warning': '#ebcb8b',
        '--error': '#bf616a',
        '--info': '#81a1c1',

        '--hover': '#3b4252',
        '--card-bg': '#3b4252',
        '--input-bg': '#3b4252',
        '--code-bg': '#2e3440',
        '--code-text': '#eceff4',
        '--shadow': 'rgba(0, 0, 0, 0.3)'
      }
    });

    // Monokai
    this.register('monokai', {
      name: 'Monokai',
      type: 'dark',
      colors: {
        '--background': '#272822',
        '--background-secondary': '#3e3d32',
        '--background-tertiary': '#49483e',
        '--text': '#f8f8f2',
        '--text-secondary': '#75715e',
        '--border': '#49483e',

        '--accent': '#66d9ef',
        '--accent-hover': '#4fc3dc',
        '--accent-bg': 'rgba(102, 217, 239, 0.15)',

        '--success': '#a6e22e',
        '--warning': '#e6db74',
        '--error': '#f92672',
        '--info': '#ae81ff',

        '--hover': '#3e3d32',
        '--card-bg': '#3e3d32',
        '--input-bg': '#3e3d32',
        '--code-bg': '#272822',
        '--code-text': '#f8f8f2',
        '--shadow': 'rgba(0, 0, 0, 0.5)'
      }
    });

    // Solarized Light
    this.register('solarized-light', {
      name: 'Solarized Light',
      type: 'light',
      colors: {
        '--background': '#fdf6e3',
        '--background-secondary': '#eee8d5',
        '--background-tertiary': '#e3dcc8',
        '--text': '#657b83',
        '--text-secondary': '#93a1a1',
        '--border': '#e3dcc8',

        '--accent': '#268bd2',
        '--accent-hover': '#1c6ca8',
        '--accent-bg': 'rgba(38, 139, 210, 0.1)',

        '--success': '#859900',
        '--warning': '#b58900',
        '--error': '#dc322f',
        '--info': '#2aa198',

        '--hover': '#eee8d5',
        '--card-bg': '#fdf6e3',
        '--input-bg': '#fdf6e3',
        '--code-bg': '#eee8d5',
        '--code-text': '#657b83',
        '--shadow': 'rgba(0, 0, 0, 0.1)'
      }
    });

    // Solarized Dark
    this.register('solarized-dark', {
      name: 'Solarized Dark',
      type: 'dark',
      colors: {
        '--background': '#002b36',
        '--background-secondary': '#073642',
        '--background-tertiary': '#0e4b5a',
        '--text': '#839496',
        '--text-secondary': '#586e75',
        '--border': '#0e4b5a',

        '--accent': '#268bd2',
        '--accent-hover': '#1c6ca8',
        '--accent-bg': 'rgba(38, 139, 210, 0.15)',

        '--success': '#859900',
        '--warning': '#b58900',
        '--error': '#dc322f',
        '--info': '#2aa198',

        '--hover': '#073642',
        '--card-bg': '#073642',
        '--input-bg': '#073642',
        '--code-bg': '#002b36',
        '--code-text': '#839496',
        '--shadow': 'rgba(0, 0, 0, 0.5)'
      }
    });

    // GitHub Light
    this.register('github-light', {
      name: 'GitHub Light',
      type: 'light',
      colors: {
        '--background': '#ffffff',
        '--background-secondary': '#f6f8fa',
        '--background-tertiary': '#e1e4e8',
        '--text': '#24292e',
        '--text-secondary': '#586069',
        '--border': '#e1e4e8',

        '--accent': '#0366d6',
        '--accent-hover': '#005cc5',
        '--accent-bg': 'rgba(3, 102, 214, 0.1)',

        '--success': '#28a745',
        '--warning': '#ffd33d',
        '--error': '#d73a49',
        '--info': '#0366d6',

        '--hover': '#f6f8fa',
        '--card-bg': '#ffffff',
        '--input-bg': '#fafbfc',
        '--code-bg': '#f6f8fa',
        '--code-text': '#24292e',
        '--shadow': 'rgba(27, 31, 35, 0.15)'
      }
    });

    // GitHub Dark
    this.register('github-dark', {
      name: 'GitHub Dark',
      type: 'dark',
      colors: {
        '--background': '#0d1117',
        '--background-secondary': '#161b22',
        '--background-tertiary': '#21262d',
        '--text': '#c9d1d9',
        '--text-secondary': '#8b949e',
        '--border': '#30363d',

        '--accent': '#58a6ff',
        '--accent-hover': '#4493e6',
        '--accent-bg': 'rgba(88, 166, 255, 0.15)',

        '--success': '#3fb950',
        '--warning': '#d29922',
        '--error': '#f85149',
        '--info': '#58a6ff',

        '--hover': '#161b22',
        '--card-bg': '#161b22',
        '--input-bg': '#0d1117',
        '--code-bg': '#0d1117',
        '--code-text': '#c9d1d9',
        '--shadow': 'rgba(1, 4, 9, 0.5)'
      }
    });

    // Tokyo Night
    this.register('tokyo-night', {
      name: 'Tokyo Night',
      type: 'dark',
      colors: {
        '--background': '#1a1b26',
        '--background-secondary': '#24283b',
        '--background-tertiary': '#414868',
        '--text': '#c0caf5',
        '--text-secondary': '#9aa5ce',
        '--border': '#414868',

        '--accent': '#7aa2f7',
        '--accent-hover': '#6289d8',
        '--accent-bg': 'rgba(122, 162, 247, 0.15)',

        '--success': '#9ece6a',
        '--warning': '#e0af68',
        '--error': '#f7768e',
        '--info': '#7dcfff',

        '--hover': '#24283b',
        '--card-bg': '#24283b',
        '--input-bg': '#1a1b26',
        '--code-bg': '#1a1b26',
        '--code-text': '#c0caf5',
        '--shadow': 'rgba(0, 0, 0, 0.4)'
      }
    });
  }

  /**
   * Register theme
   */
  register(id, theme) {
    this.themes.set(id, {
      id,
      ...theme,
      custom: false
    });
  }

  /**
   * Apply theme
   */
  apply(themeId) {
    const theme = this.themes.get(themeId);
    if (!theme) {
      console.error(`Theme not found: ${themeId}`);
      return false;
    }

    // Apply CSS variables
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.colors)) {
      root.style.setProperty(key, value);
    }

    // Set data attribute
    document.body.dataset.theme = theme.type;

    // Save current theme
    this.currentTheme = themeId;
    this.saveTheme();

    // Emit event
    this.emit('theme:changed', { theme: themeId });

    console.log(`✓ Theme applied: ${theme.name}`);
    return true;
  }

  /**
   * Create custom theme
   */
  createCustom(id, name, baseTheme, customColors = {}) {
    const base = this.themes.get(baseTheme);
    if (!base) {
      console.error(`Base theme not found: ${baseTheme}`);
      return false;
    }

    const theme = {
      id,
      name,
      type: base.type,
      colors: {
        ...base.colors,
        ...customColors
      },
      custom: true,
      baseTheme
    };

    this.themes.set(id, theme);
    this.saveCustomThemes();

    return true;
  }

  /**
   * Update custom theme
   */
  updateCustom(id, updates) {
    const theme = this.themes.get(id);
    if (!theme || !theme.custom) {
      return false;
    }

    if (updates.name) theme.name = updates.name;
    if (updates.colors) {
      theme.colors = { ...theme.colors, ...updates.colors };
    }

    this.themes.set(id, theme);
    this.saveCustomThemes();

    // Reapply if current
    if (this.currentTheme === id) {
      this.apply(id);
    }

    return true;
  }

  /**
   * Delete custom theme
   */
  deleteCustom(id) {
    const theme = this.themes.get(id);
    if (!theme || !theme.custom) {
      return false;
    }

    this.themes.delete(id);
    this.saveCustomThemes();

    // Switch to default if current
    if (this.currentTheme === id) {
      this.apply('default-light');
    }

    return true;
  }

  /**
   * Get all themes
   */
  getThemes() {
    return Array.from(this.themes.values()).map(theme => ({
      id: theme.id,
      name: theme.name,
      type: theme.type,
      custom: theme.custom,
      current: theme.id === this.currentTheme
    }));
  }

  /**
   * Get theme by ID
   */
  getTheme(id) {
    return this.themes.get(id);
  }

  /**
   * Get current theme
   */
  getCurrent() {
    return this.themes.get(this.currentTheme);
  }

  /**
   * Toggle between light and dark
   */
  toggle() {
    const current = this.getCurrent();
    if (!current) return;

    // Find opposite theme
    const opposite = current.type === 'light'
      ? Array.from(this.themes.values()).find(t => t.type === 'dark' && !t.custom)
      : Array.from(this.themes.values()).find(t => t.type === 'light' && !t.custom);

    if (opposite) {
      this.apply(opposite.id);
    }
  }

  /**
   * Export theme
   */
  export(themeId) {
    const theme = this.themes.get(themeId);
    if (!theme) return null;

    const data = {
      version: '3.0.0',
      theme: {
        id: theme.id,
        name: theme.name,
        type: theme.type,
        colors: theme.colors
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devchef-theme-${theme.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import theme
   */
  async import(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.theme || !data.theme.id || !data.theme.colors) {
        throw new Error('Invalid theme file');
      }

      const { id, name, type, colors } = data.theme;
      this.themes.set(id, {
        id,
        name: name || id,
        type: type || 'dark',
        colors,
        custom: true,
        imported: true
      });

      this.saveCustomThemes();
      return true;
    } catch (error) {
      console.error('Failed to import theme:', error);
      return false;
    }
  }

  /**
   * Save theme preference
   */
  saveTheme() {
    try {
      localStorage.setItem('devchef-theme', this.currentTheme);
    } catch (e) {
      console.warn('Could not save theme:', e);
    }
  }

  /**
   * Load saved theme
   */
  loadSavedTheme() {
    try {
      const saved = localStorage.getItem('devchef-theme');
      if (saved && this.themes.has(saved)) {
        this.currentTheme = saved;
      }

      // Load custom themes
      const custom = localStorage.getItem('devchef-custom-themes');
      if (custom) {
        const themes = JSON.parse(custom);
        themes.forEach(theme => {
          this.themes.set(theme.id, { ...theme, custom: true });
        });
      }
    } catch (e) {
      console.warn('Could not load saved theme:', e);
    }
  }

  /**
   * Save custom themes
   */
  saveCustomThemes() {
    try {
      const custom = Array.from(this.themes.values()).filter(t => t.custom);
      localStorage.setItem('devchef-custom-themes', JSON.stringify(custom));
    } catch (e) {
      console.warn('Could not save custom themes:', e);
    }
  }

  /**
   * Get color value
   */
  getColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }

  /**
   * Set color value
   */
  setColor(varName, value) {
    document.documentElement.style.setProperty(varName, value);
  }

  /**
   * Event emitter
   */
  emit(event, data) {
    window.dispatchEvent(new CustomEvent(event, { detail: data }));
  }
}

// Create singleton instance
export const themeEngine = new ThemeEngine();

// Export class for testing
export { ThemeEngine };
