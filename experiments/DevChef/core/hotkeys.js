/**
 * DevChef V3 - Hotkey Manager
 * Keyboard maestro-level shortcut management for 10x developers
 */

class HotkeyManager {
  constructor() {
    this.bindings = new Map();
    this.sequences = new Map();
    this.sequenceBuffer = [];
    this.sequenceTimeout = null;
    this.recordingMode = false;
    this.recordedKeys = [];
    this.modifiers = {
      ctrl: false,
      alt: false,
      shift: false,
      meta: false
    };
    this.init();
  }

  /**
   * Initialize hotkey system
   */
  init() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    this.registerDefaultHotkeys();
  }

  /**
   * Register default hotkeys
   */
  registerDefaultHotkeys() {
    // Navigation
    this.register('ctrl+k, cmd+k', () => this.emit('command-palette'));
    this.register('ctrl+/, ctrl+shift+f, cmd+shift+f', () => this.emit('search-tools'));
    this.register('ctrl+p, cmd+p', () => this.emit('show-pipelines'));
    this.register('ctrl+b, cmd+b', () => this.emit('show-snippets'));
    this.register('ctrl+i, cmd+i', () => this.emit('show-insights'));
    this.register('ctrl+space, cmd+space', () => this.emit('quick-actions'));

    // Tool operations
    this.register('ctrl+d, cmd+d', () => this.emit('toggle-favorite'));
    this.register('ctrl+e, cmd+e', () => this.emit('recent-tools'));
    this.register('ctrl+w, cmd+w', () => this.emit('close-tool'));
    this.register('ctrl+shift+w, cmd+shift+w', () => this.emit('close-all-tools'));

    // UI
    this.register('ctrl+\\, cmd+\\', () => this.emit('toggle-console'));
    this.register('ctrl+,, cmd+,', () => this.emit('open-settings'));
    this.register('?', () => this.emit('show-help'));
    this.register('esc', () => this.emit('close-dialog'));

    // Theme
    this.register('ctrl+shift+t, cmd+shift+t', () => this.emit('toggle-theme'));

    // Sequences (vim-like)
    this.registerSequence('g g', () => this.emit('scroll-top'));
    this.registerSequence('G', () => this.emit('scroll-bottom'));
    this.registerSequence('g d', () => this.emit('go-definition'));
    this.registerSequence('g f', () => this.emit('go-file'));

    // Leader key sequences (space as leader)
    this.registerSequence('space f f', () => this.emit('find-file'));
    this.registerSequence('space f r', () => this.emit('recent-files'));
    this.registerSequence('space b b', () => this.emit('switch-buffer'));
    this.registerSequence('space s s', () => this.emit('save'));
    this.registerSequence('space q q', () => this.emit('quit'));

    // Numbers for quick tool access
    for (let i = 1; i <= 9; i++) {
      this.register(`alt+${i}`, () => this.emit('quick-tool', { index: i - 1 }));
    }
  }

  /**
   * Handle key down
   */
  handleKeyDown(e) {
    // Update modifier state
    this.modifiers.ctrl = e.ctrlKey;
    this.modifiers.alt = e.altKey;
    this.modifiers.shift = e.shiftKey;
    this.modifiers.meta = e.metaKey;

    // Recording mode
    if (this.recordingMode) {
      this.recordedKeys.push(this.getKeyCombo(e));
      e.preventDefault();
      return;
    }

    // Check for hotkey match
    const combo = this.getKeyCombo(e);
    const binding = this.bindings.get(combo);

    if (binding) {
      e.preventDefault();
      binding.handler(e);
      binding.lastUsed = Date.now();
      binding.useCount = (binding.useCount || 0) + 1;
      return;
    }

    // Check for sequence
    this.handleSequence(e);
  }

  /**
   * Handle key up
   */
  handleKeyUp(e) {
    this.modifiers.ctrl = e.ctrlKey;
    this.modifiers.alt = e.altKey;
    this.modifiers.shift = e.shiftKey;
    this.modifiers.meta = e.metaKey;
  }

  /**
   * Handle key sequence
   */
  handleSequence(e) {
    const key = this.getKey(e);

    // Add to buffer
    this.sequenceBuffer.push(key);

    // Clear timeout
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout);
    }

    // Set new timeout
    this.sequenceTimeout = setTimeout(() => {
      this.sequenceBuffer = [];
    }, 1000);

    // Check for sequence match
    const sequence = this.sequenceBuffer.join(' ');
    const binding = this.sequences.get(sequence);

    if (binding) {
      e.preventDefault();
      binding.handler(e);
      binding.lastUsed = Date.now();
      binding.useCount = (binding.useCount || 0) + 1;
      this.sequenceBuffer = [];
      clearTimeout(this.sequenceTimeout);
    }
  }

  /**
   * Register hotkey
   */
  register(combo, handler, description = '') {
    // Handle multiple combos (e.g., "ctrl+k, cmd+k")
    const combos = combo.split(',').map(c => c.trim());

    combos.forEach(c => {
      this.bindings.set(c, {
        combo: c,
        handler,
        description,
        createdAt: Date.now(),
        useCount: 0
      });
    });

    return true;
  }

  /**
   * Unregister hotkey
   */
  unregister(combo) {
    const combos = combo.split(',').map(c => c.trim());
    combos.forEach(c => this.bindings.delete(c));
    return true;
  }

  /**
   * Register key sequence
   */
  registerSequence(sequence, handler, description = '') {
    this.sequences.set(sequence, {
      sequence,
      handler,
      description,
      createdAt: Date.now(),
      useCount: 0
    });
    return true;
  }

  /**
   * Unregister sequence
   */
  unregisterSequence(sequence) {
    this.sequences.delete(sequence);
    return true;
  }

  /**
   * Get key combo string
   */
  getKeyCombo(e) {
    const parts = [];

    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    if (e.metaKey) parts.push('cmd');

    const key = this.getKey(e);
    if (key) parts.push(key);

    return parts.join('+');
  }

  /**
   * Get key from event
   */
  getKey(e) {
    const key = e.key.toLowerCase();

    // Special keys
    const specialKeys = {
      ' ': 'space',
      'escape': 'esc',
      'arrowup': 'up',
      'arrowdown': 'down',
      'arrowleft': 'left',
      'arrowright': 'right',
      'enter': 'enter',
      'tab': 'tab',
      'backspace': 'backspace',
      'delete': 'del'
    };

    return specialKeys[key] || key;
  }

  /**
   * Start recording hotkey
   */
  startRecording() {
    this.recordingMode = true;
    this.recordedKeys = [];
    this.emit('hotkey:recording-started');
  }

  /**
   * Stop recording hotkey
   */
  stopRecording() {
    this.recordingMode = false;
    const recorded = [...this.recordedKeys];
    this.recordedKeys = [];
    this.emit('hotkey:recording-stopped', { keys: recorded });
    return recorded;
  }

  /**
   * Get all bindings
   */
  getBindings() {
    return Array.from(this.bindings.entries()).map(([combo, binding]) => ({
      combo,
      description: binding.description,
      useCount: binding.useCount,
      lastUsed: binding.lastUsed
    }));
  }

  /**
   * Get all sequences
   */
  getSequences() {
    return Array.from(this.sequences.entries()).map(([seq, binding]) => ({
      sequence: seq,
      description: binding.description,
      useCount: binding.useCount,
      lastUsed: binding.lastUsed
    }));
  }

  /**
   * Export hotkey configuration
   */
  export() {
    const data = {
      version: '3.0.0',
      bindings: this.getBindings(),
      sequences: this.getSequences()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devchef-hotkeys-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import hotkey configuration
   */
  async import(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Clear existing (optional)
      // this.bindings.clear();
      // this.sequences.clear();

      // Import bindings
      if (data.bindings) {
        data.bindings.forEach(({ combo, description }) => {
          // Note: Can't import handler functions, need to map to actions
          console.log(`Imported binding: ${combo}`);
        });
      }

      // Import sequences
      if (data.sequences) {
        data.sequences.forEach(({ sequence, description }) => {
          console.log(`Imported sequence: ${sequence}`);
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to import hotkeys:', error);
      return false;
    }
  }

  /**
   * Check if combo is available
   */
  isAvailable(combo) {
    return !this.bindings.has(combo);
  }

  /**
   * Search bindings
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    return this.getBindings().filter(b =>
      b.combo.includes(lowerQuery) ||
      b.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get most used hotkeys
   */
  getMostUsed(limit = 10) {
    return this.getBindings()
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
      .slice(0, limit);
  }

  /**
   * Reset usage statistics
   */
  resetStats() {
    this.bindings.forEach(binding => {
      binding.useCount = 0;
      binding.lastUsed = null;
    });

    this.sequences.forEach(binding => {
      binding.useCount = 0;
      binding.lastUsed = null;
    });
  }

  /**
   * Event emitter
   */
  emit(event, data = {}) {
    window.dispatchEvent(new CustomEvent(`hotkey:${event}`, { detail: data }));
  }

  /**
   * Listen to hotkey events
   */
  on(event, handler) {
    window.addEventListener(`hotkey:${event}`, (e) => handler(e.detail));
  }

  /**
   * Remove event listener
   */
  off(event, handler) {
    window.removeEventListener(`hotkey:${event}`, handler);
  }
}

// Create singleton instance
export const hotkeyManager = new HotkeyManager();

// Export class for testing
export { HotkeyManager };
