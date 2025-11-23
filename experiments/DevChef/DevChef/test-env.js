/**
 * Test Environment Setup
 * Mock browser APIs for Node.js testing
 */

// Mock localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }

  key(index) {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  get length() {
    return Object.keys(this.store).length;
  }
}

// Mock window object
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  localStorage: new LocalStorageMock(),
  DevChef: {},
  location: {
    hostname: 'localhost',
    href: 'http://localhost:8000'
  },
  navigator: {
    userAgent: 'Test Browser',
    platform: 'Test Platform',
    clipboard: {
      readText: async () => 'test',
      writeText: async () => {}
    }
  },
  performance: {
    timing: {
      navigationStart: Date.now(),
      loadEventEnd: Date.now() + 1000
    },
    mark: () => {},
    measure: () => ({ duration: 10 }),
    getEntriesByName: () => [{ duration: 10 }],
    clearMarks: () => {},
    clearMeasures: () => {},
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 10000000,
      jsHeapSizeLimit: 100000000
    }
  },
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  CustomEvent: class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  }
};

// Mock document object
const mockElements = new Map();

const createMockElement = (tag = 'div') => ({
  tagName: tag.toUpperCase(),
  innerHTML: '',
  textContent: '',
  value: '',
  style: {},
  classList: {
    add: () => {},
    remove: () => {},
    contains: () => false,
    toggle: () => {}
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  click: () => {},
  setAttribute: (name, value) => {},
  getAttribute: (name) => null,
  appendChild: () => {},
  removeChild: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  children: [],
  parentElement: null,
  id: ''
});

global.document = {
  createElement: createMockElement,
  getElementById: (id) => {
    // Return cached mock element or create new one
    if (!mockElements.has(id)) {
      const element = createMockElement('div');
      element.id = id;
      mockElements.set(id, element);
    }
    return mockElements.get(id);
  },
  body: {
    dataset: {},
    appendChild: () => {},
    removeChild: () => {}
  },
  documentElement: {
    style: {
      setProperty: () => {},
      getPropertyValue: () => ''
    }
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {}
};

// Mock localStorage globally
global.localStorage = global.window.localStorage;

// Mock performance globally
global.performance = global.window.performance;

// Mock navigator globally
global.navigator = global.window.navigator;

console.log('✓ Test environment initialized');
