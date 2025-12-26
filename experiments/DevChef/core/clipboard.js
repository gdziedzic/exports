/**
 * DevChef V2.5 - Smart Clipboard Detection System
 * Automatically detects clipboard content and suggests relevant tools
 */

class ClipboardDetector {
  constructor() {
    this.patterns = {
      json: /^[\s]*[{[]/,
      jwt: /^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
      base64: /^[A-Za-z0-9+/]+=*$/,
      url: /^https?:\/\//,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      timestamp: /^\d{10,13}$/,
      sql: /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s/i,
      hex: /^#?[0-9A-Fa-f]{6}$/,
      xml: /^<\?xml|^<[a-z]/i,
      csv: /^[^,\n]+,[^,\n]+/,
      hash: /^[a-f0-9]{32,128}$/i,
      ipv4: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      markdown: /^#+\s|^\*\*|^-\s|\[.*\]\(.*\)/,
      regex: /^\/.*\/[gimuy]*$/
    };

    this.toolSuggestions = {
      json: ['json-formatter'],
      jwt: ['jwt-decoder'],
      base64: ['base64-tool'],
      url: ['url-encoder', 'curl-builder'],
      uuid: ['uuid-generator'],
      timestamp: ['timestamp-converter'],
      sql: ['sql-formatter', 'sql-join-helper'],
      hex: ['color-picker'],
      xml: ['html-converter'],
      csv: ['csv-json-converter'],
      hash: ['hash-generator'],
      markdown: ['html-converter'],
      regex: ['regex-tester']
    };

    this.clipboardHistory = [];
    this.maxHistory = 20;
    this.isMonitoring = false;
  }

  /**
   * Detect content type from text
   * @param {string} text - Text to analyze
   * @returns {Object} Detection result
   */
  detect(text) {
    if (!text || text.length === 0) {
      return { type: 'unknown', confidence: 0, suggestions: [] };
    }

    const trimmed = text.trim();
    const results = [];

    // Check each pattern
    for (const [type, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(trimmed)) {
        const confidence = this.calculateConfidence(type, trimmed);
        results.push({
          type,
          confidence,
          suggestions: this.toolSuggestions[type] || []
        });
      }
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    return results.length > 0
      ? results[0]
      : { type: 'text', confidence: 50, suggestions: ['string-cleaner', 'diff-checker'] };
  }

  /**
   * Calculate confidence score for a match
   * @param {string} type - Content type
   * @param {string} text - Text content
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidence(type, text) {
    let confidence = 60; // Base confidence

    // Type-specific confidence adjustments
    switch (type) {
      case 'json':
        try {
          JSON.parse(text);
          confidence = 95;
        } catch {
          confidence = 50;
        }
        break;

      case 'jwt':
        const parts = text.split('.');
        confidence = parts.length === 3 ? 90 : 60;
        break;

      case 'base64':
        confidence = text.length % 4 === 0 ? 80 : 50;
        break;

      case 'sql':
        const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INSERT', 'UPDATE'];
        const matches = keywords.filter(kw => text.toUpperCase().includes(kw)).length;
        confidence = 60 + (matches * 10);
        break;

      case 'uuid':
        confidence = 95;
        break;

      case 'timestamp':
        const num = parseInt(text);
        const now = Date.now();
        confidence = (num > 1000000000 && num < now * 2) ? 90 : 60;
        break;

      default:
        confidence = 70;
    }

    return Math.min(100, confidence);
  }

  /**
   * Add to clipboard history
   * @param {string} text - Clipboard content
   */
  addToHistory(text) {
    if (!text || text.length === 0) return;

    const detection = this.detect(text);
    const entry = {
      text: text.substring(0, 500), // Store first 500 chars
      type: detection.type,
      confidence: detection.confidence,
      timestamp: Date.now(),
      id: `clip-${Date.now()}-${Math.random()}`
    };

    // Remove duplicates
    this.clipboardHistory = this.clipboardHistory.filter(
      item => item.text !== entry.text
    );

    // Add to front
    this.clipboardHistory.unshift(entry);

    // Limit size
    if (this.clipboardHistory.length > this.maxHistory) {
      this.clipboardHistory = this.clipboardHistory.slice(0, this.maxHistory);
    }

    return entry;
  }

  /**
   * Get clipboard history
   * @returns {Array} History entries
   */
  getHistory() {
    return this.clipboardHistory;
  }

  /**
   * Clear clipboard history
   */
  clearHistory() {
    this.clipboardHistory = [];
  }

  /**
   * Start monitoring clipboard (with permission)
   * @param {Function} callback - Called when clipboard changes
   */
  startMonitoring(callback) {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringCallback = callback;

    // Note: Clipboard API monitoring requires user interaction
    // This is a passive monitor that checks on paste events
    document.addEventListener('paste', this.handlePaste.bind(this));
  }

  /**
   * Stop monitoring clipboard
   */
  stopMonitoring() {
    this.isMonitoring = false;
    document.removeEventListener('paste', this.handlePaste.bind(this));
  }

  /**
   * Handle paste event
   * @param {ClipboardEvent} event - Paste event
   */
  handlePaste(event) {
    const text = event.clipboardData?.getData('text');
    if (text) {
      const entry = this.addToHistory(text);
      if (this.monitoringCallback) {
        this.monitoringCallback(entry);
      }
    }
  }

  /**
   * Read current clipboard content
   * @returns {Promise<Object>} Detection result
   */
  async readClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        const detection = this.detect(text);
        this.addToHistory(text);
        return { text, ...detection };
      }
    } catch (error) {
      console.warn('Clipboard access denied:', error);
      return null;
    }
  }

  /**
   * Get smart suggestions for current clipboard
   * @returns {Promise<Object>} Suggestions
   */
  async getSmartSuggestions() {
    const result = await this.readClipboard();
    if (!result) return null;

    return {
      detected: result.type,
      confidence: result.confidence,
      tools: result.suggestions,
      preview: result.text.substring(0, 100)
    };
  }
}

// Create and export singleton
export const clipboardDetector = new ClipboardDetector();
