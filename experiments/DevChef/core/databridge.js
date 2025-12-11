/**
 * Universal Data Bridge
 * Connect DevChef to everything, everywhere
 */

class DataBridge {
  constructor() {
    this.connections = new Map();
    this.watchers = new Map();
    this.init();
  }

  init() {
    this.setupBrowserIntegration();
    this.setupFileWatcher();
    this.setupAPIBridge();
    this.setupClipboardBridge();
    console.log('Universal Data Bridge initialized - Connected to everything');
  }

  setupBrowserIntegration() {
    // Capture data from browser
    // Inject DevChef into web pages (via bookmarklet)
    this.createBookmarklet();
  }

  createBookmarklet() {
    const code = `
javascript:(function(){
  const data = window.getSelection().toString() || document.body.innerText;
  localStorage.setItem('devchef-import', data);
  alert('Data captured! Open DevChef to process.');
})();
    `.trim();

    this.bookmarklet = code;
    console.log('📌 Bookmarklet ready - drag to bookmarks bar');
  }

  setupFileWatcher() {
    // Watch files for changes
    // Auto-process when files update
  }

  setupAPIBridge() {
    // Proxy for API calls
    // Cache and transform responses
  }

  setupClipboardBridge() {
    // Enhanced clipboard monitoring
    // Auto-import to DevChef
    setInterval(() => {
      this.checkClipboard();
    }, 2000);
  }

  async checkClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text !== this.lastClipboard) {
        this.lastClipboard = text;
        this.processClipboardData(text);
      }
    } catch (e) {
      // Clipboard access denied
    }
  }

  processClipboardData(data) {
    try {
      // Auto-detect and suggest actions
      if (window.contextEngine) {
        window.contextEngine.onClipboardChange(data, {
          type: this.detectType(data),
          confidence: 0.9
        });
      }
    } catch (error) {
      console.error('Error processing clipboard data:', error);
    }
  }

  detectType(data) {
    if (data.startsWith('{') || data.startsWith('[')) return 'json';
    if (data.startsWith('http')) return 'url';
    if (data.match(/^[0-9a-f]{8}-[0-9a-f]{4}/i)) return 'uuid';
    return 'text';
  }

  connectToAPI(name, baseUrl, headers = {}) {
    this.connections.set(name, {
      baseUrl,
      headers,
      request: async (endpoint, options) => {
        const url = `${baseUrl}${endpoint}`;
        const response = await fetch(url, {
          ...options,
          headers: { ...headers, ...options.headers }
        });
        return response.json();
      }
    });
  }

  importFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      this.processImportedData(data);
    };
    reader.readAsText(file);
  }

  processImportedData(data) {
    // Auto-detect format and process
    console.log('Processing imported data...');
  }

  exportToFile(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }
}

export const dataBridge = new DataBridge();
export { DataBridge };
