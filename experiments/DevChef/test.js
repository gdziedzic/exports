/**
 * DevChef Test Suite
 * Comprehensive tests for all core modules
 */

// Load test environment (browser API mocks)
require('./test-env.js');

// Test utilities
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};

const assertEquals = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
};

const assertThrows = (fn, message) => {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
  }
  if (!threw) {
    throw new Error(`Expected function to throw: ${message}`);
  }
};

// Test runner
class TestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running DevChef Test Suite...\n');

    for (const { name, fn } of this.tests) {
      try {
        await fn();
        this.results.passed++;
        console.log(`✓ ${name}`);
      } catch (error) {
        this.results.failed++;
        this.results.errors.push({ test: name, error: error.message });
        console.error(`✗ ${name}`);
        console.error(`  ${error.message}`);
      }
    }

    console.log(`\n📊 Test Results:`);
    console.log(`   Passed: ${this.results.passed}`);
    console.log(`   Failed: ${this.results.failed}`);
    console.log(`   Total: ${this.tests.length}`);

    if (this.results.failed > 0) {
      console.log('\n❌ Some tests failed');
      return false;
    } else {
      console.log('\n✅ All tests passed!');
      return true;
    }
  }
}

// Initialize test runner
const runner = new TestRunner();

// Storage Manager Tests
runner.test('Storage: Initialize storage manager', () => {
  const { StorageManager } = require('./core/storage.js');
  const storage = new StorageManager();
  assert(storage !== null, 'Storage manager should initialize');
});

runner.test('Storage: Add and get favorites', () => {
  const { StorageManager } = require('./core/storage.js');
  const storage = new StorageManager();

  storage.addFavorite('test-tool');
  const favorites = storage.getFavorites();

  assert(favorites.includes('test-tool'), 'Favorite should be added');
});

runner.test('Storage: Remove favorites', () => {
  const { StorageManager } = require('./core/storage.js');
  const storage = new StorageManager();

  storage.addFavorite('test-tool');
  storage.removeFavorite('test-tool');
  const favorites = storage.getFavorites();

  assert(!favorites.includes('test-tool'), 'Favorite should be removed');
});

runner.test('Storage: Add to history', () => {
  const { StorageManager } = require('./core/storage.js');
  const storage = new StorageManager();

  storage.addToHistory('test-tool', 'Test Tool');
  const history = storage.getHistory();

  assert(history.length > 0, 'History should have entries');
  assert(history[0].toolId === 'test-tool', 'History should contain tool');
});

// Validator Tests
runner.test('Validator: Required field validation', () => {
  const { Validator } = require('./core/validator.js');
  const validator = new Validator();

  const result = validator.validate('', { required: true });
  assert(!result.valid, 'Empty string should fail required validation');
});

runner.test('Validator: Email validation', () => {
  const { Validator } = require('./core/validator.js');
  const validator = new Validator();

  const valid = validator.validate('test@example.com', { email: true });
  const invalid = validator.validate('invalid-email', { email: true });

  assert(valid.valid, 'Valid email should pass');
  assert(!invalid.valid, 'Invalid email should fail');
});

runner.test('Validator: JSON validation', () => {
  const { Validator } = require('./core/validator.js');
  const validator = new Validator();

  const valid = validator.validate('{"key":"value"}', { json: true });
  const invalid = validator.validate('{invalid json}', { json: true });

  assert(valid.valid, 'Valid JSON should pass');
  assert(!invalid.valid, 'Invalid JSON should fail');
});

runner.test('Validator: Sanitize HTML', () => {
  const { Validator } = require('./core/validator.js');
  const validator = new Validator();

  const result = validator.sanitize('<script>alert("xss")</script>Hello', { noScripts: true });
  assert(!result.includes('<script>'), 'Scripts should be removed');
  assert(result.includes('Hello'), 'Text should remain');
});

// Commander Tests
runner.test('Commander: Register and execute command', async () => {
  const { Commander } = require('./core/commander.js');
  const commander = new Commander();

  let executed = false;
  commander.register('test', {
    description: 'Test command',
    handler: async () => {
      executed = true;
      return { success: true };
    }
  });

  await commander.execute('test');
  assert(executed, 'Command should execute');
});

runner.test('Commander: Command aliases', async () => {
  const { Commander } = require('./core/commander.js');
  const commander = new Commander();

  let executed = false;
  commander.register('longcommand', {
    description: 'Long command',
    handler: async () => {
      executed = true;
      return { success: true };
    }
  });

  commander.alias('lc', 'longcommand');
  await commander.execute('lc');

  assert(executed, 'Alias should execute original command');
});

runner.test('Commander: Macro execution', async () => {
  const { Commander } = require('./core/commander.js');
  const commander = new Commander();

  let count = 0;
  commander.register('increment', {
    description: 'Increment counter',
    handler: async () => {
      count++;
      return { success: true };
    }
  });

  commander.createMacro('test-macro', ['increment', 'increment', 'increment']);
  await commander.runMacro('test-macro');

  assertEquals(count, 3, 'Macro should execute all commands');
});

// Theme Engine Tests
runner.test('Theme: Initialize with default themes', () => {
  const { ThemeEngine } = require('./core/themes.js');
  const themeEngine = new ThemeEngine();

  const themes = themeEngine.getThemes();
  assert(themes.length >= 10, 'Should have at least 10 default themes');
});

runner.test('Theme: Get theme by ID', () => {
  const { ThemeEngine } = require('./core/themes.js');
  const themeEngine = new ThemeEngine();

  const theme = themeEngine.getTheme('dracula');
  assert(theme !== null, 'Should find Dracula theme');
  assertEquals(theme.name, 'Dracula', 'Theme name should match');
});

runner.test('Theme: Create custom theme', () => {
  const { ThemeEngine } = require('./core/themes.js');
  const themeEngine = new ThemeEngine();

  const created = themeEngine.createCustom('my-theme', 'My Theme', 'default-dark', {
    '--accent': '#ff0000'
  });

  assert(created, 'Custom theme should be created');

  const theme = themeEngine.getTheme('my-theme');
  assert(theme.custom, 'Theme should be marked as custom');
});

// Hotkey Manager Tests
runner.test('Hotkeys: Register hotkey', () => {
  const { HotkeyManager } = require('./core/hotkeys.js');
  const hotkeyManager = new HotkeyManager();

  let triggered = false;
  hotkeyManager.register('ctrl+t', () => {
    triggered = true;
  }, 'Test hotkey');

  const bindings = hotkeyManager.getBindings();
  assert(bindings.some(b => b.combo === 'ctrl+t'), 'Hotkey should be registered');
});

runner.test('Hotkeys: Register sequence', () => {
  const { HotkeyManager } = require('./core/hotkeys.js');
  const hotkeyManager = new HotkeyManager();

  hotkeyManager.registerSequence('g g', () => {}, 'Go to top');

  const sequences = hotkeyManager.getSequences();
  assert(sequences.some(s => s.sequence === 'g g'), 'Sequence should be registered');
});

runner.test('Hotkeys: Check availability', () => {
  const { HotkeyManager } = require('./core/hotkeys.js');
  const hotkeyManager = new HotkeyManager();

  hotkeyManager.register('ctrl+x', () => {});

  assert(!hotkeyManager.isAvailable('ctrl+x'), 'Registered hotkey should not be available');
  assert(hotkeyManager.isAvailable('ctrl+y'), 'Unregistered hotkey should be available');
});

// Plugin Manager Tests
runner.test('Plugins: Register plugin', async () => {
  const { PluginManager } = require('./core/plugins.js');
  const pluginManager = new PluginManager();

  const testPlugin = {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    init: async (api) => {
      // Plugin initialization
    }
  };

  const registered = await pluginManager.registerPlugin(testPlugin);
  assert(registered, 'Plugin should register successfully');
});

runner.test('Plugins: Prevent duplicate registration', async () => {
  const { PluginManager } = require('./core/plugins.js');
  const pluginManager = new PluginManager();

  const testPlugin = {
    id: 'duplicate-test',
    name: 'Duplicate Test',
    init: async () => {}
  };

  await pluginManager.registerPlugin(testPlugin);
  const duplicate = await pluginManager.registerPlugin(testPlugin);

  assert(!duplicate, 'Duplicate plugin should not register');
});

runner.test('Plugins: Unregister plugin', async () => {
  const { PluginManager } = require('./core/plugins.js');
  const pluginManager = new PluginManager();

  const testPlugin = {
    id: 'unregister-test',
    name: 'Unregister Test',
    init: async () => {}
  };

  await pluginManager.registerPlugin(testPlugin);
  const unregistered = await pluginManager.unregisterPlugin('unregister-test');

  assert(unregistered, 'Plugin should unregister successfully');
  assert(!pluginManager.getPlugin('unregister-test'), 'Plugin should be removed');
});

// Backup Manager Tests
runner.test('Backup: Create backup', () => {
  const { BackupManager } = require('./core/backup.js');
  const backupManager = new BackupManager();

  const backup = backupManager.createBackup('manual');
  assert(backup !== null, 'Backup should be created');
  assert(backup.type === 'manual', 'Backup type should match');
});

runner.test('Backup: Get backup history', () => {
  const { BackupManager } = require('./core/backup.js');
  const backupManager = new BackupManager();

  backupManager.createBackup('test');
  const history = backupManager.getHistory();

  assert(history.length > 0, 'Backup history should have entries');
});

// Error Handler Tests
runner.test('ErrorHandler: Handle error', () => {
  const { ErrorHandler } = require('./core/errorhandler.js');
  const errorHandler = new ErrorHandler();

  errorHandler.handleError({
    type: 'test',
    message: 'Test error',
    timestamp: Date.now()
  });

  const errors = errorHandler.getErrors();
  assert(errors.length > 0, 'Error should be logged');
});

runner.test('ErrorHandler: Wrap function with error handling', async () => {
  const { ErrorHandler } = require('./core/errorhandler.js');
  const errorHandler = new ErrorHandler();

  const wrapped = errorHandler.wrap(() => {
    throw new Error('Test error');
  });

  const result = await wrapped();
  assert(result === null, 'Wrapped function should return null on error');
});

// Performance Monitor Tests
runner.test('Performance: Get metrics', () => {
  const { PerformanceMonitor } = require('./core/performance.js');
  const perfMonitor = new PerformanceMonitor();

  const metrics = perfMonitor.getMetrics();
  assert(metrics !== null, 'Metrics should be available');
});

runner.test('Performance: Mark and measure', () => {
  const { PerformanceMonitor } = require('./core/performance.js');
  const perfMonitor = new PerformanceMonitor();

  perfMonitor.mark('test-operation');
  const duration = perfMonitor.measure('test-operation');

  assert(typeof duration === 'number', 'Duration should be a number');
});

// Onboarding Tests
runner.test('Onboarding: Initialize tour steps', () => {
  const { OnboardingManager } = require('./core/onboarding.js');
  const onboarding = new OnboardingManager();

  assert(onboarding.tourSteps.length >= 10, 'Should have multiple tour steps');
});

runner.test('Onboarding: Check if should show tour', () => {
  const { OnboardingManager } = require('./core/onboarding.js');
  const onboarding = new OnboardingManager();

  const shouldShow = onboarding.shouldShowTour();
  assert(typeof shouldShow === 'boolean', 'Should return boolean');
});

// Run all tests
if (typeof module !== 'undefined' && require.main === module) {
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

// Export for use in other files
if (typeof module !== 'undefined') {
  module.exports = { TestRunner, runner };
}
