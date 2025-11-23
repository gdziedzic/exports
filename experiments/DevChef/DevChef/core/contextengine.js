/**
 * Smart Context Engine
 * AI-powered intelligent assistant that predicts user needs and suggests tools
 *
 * Features:
 * - Pattern recognition and learning
 * - Smart tool suggestions based on context
 * - Workflow prediction
 * - Auto-completion of common operations
 * - Contextual help and tips
 * - Adaptive learning from user behavior
 */

class ContextEngine {
  constructor() {
    this.patterns = new Map();
    this.sequences = [];
    this.suggestions = [];
    this.learningEnabled = true;
    this.confidenceThreshold = 0.4; // Lower threshold for better predictions
    this.maxSequenceLength = 10;
    this.maxSuggestions = 5;
    this.contextHistory = [];
    this.userPatterns = this.loadPatterns();
    this.init();
  }

  /**
   * Initialize the context engine
   */
  init() {
    this.setupContextMonitoring();
    this.loadDefaultPatterns();
    this.startLearning();
    console.log('Smart Context Engine initialized');
  }

  /**
   * Setup context monitoring
   */
  setupContextMonitoring() {
    // Monitor clipboard changes
    if (window.ClipboardDetector) {
      const originalDetect = window.ClipboardDetector.detect;
      window.ClipboardDetector.detect = (text) => {
        const result = originalDetect.call(window.ClipboardDetector, text);
        this.onClipboardChange(text, result);
        return result;
      };
    }

    // Monitor tool usage
    this.monitorToolUsage();

    // Monitor keyboard activity
    this.monitorKeyboardActivity();
  }

  /**
   * Monitor tool usage patterns
   */
  monitorToolUsage() {
    try {
      const originalOpenTool = window.openTool || (() => {});
      window.openTool = (toolId) => {
        try {
          this.onToolOpened(toolId);
        } catch (error) {
          console.error('Error in onToolOpened:', error);
        }
        return originalOpenTool(toolId);
      };
    } catch (error) {
      console.error('Error setting up tool monitoring:', error);
    }
  }

  /**
   * Monitor keyboard activity for patterns
   */
  monitorKeyboardActivity() {
    let keySequence = [];
    let lastKeyTime = 0;

    document.addEventListener('keydown', (e) => {
      const now = Date.now();

      // Reset sequence if more than 2 seconds since last key
      if (now - lastKeyTime > 2000) {
        keySequence = [];
      }

      keySequence.push({
        key: e.key,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        time: now
      });

      // Keep only last 10 keys
      if (keySequence.length > 10) {
        keySequence.shift();
      }

      lastKeyTime = now;
      this.analyzeKeyPattern(keySequence);
    });
  }

  /**
   * Analyze key patterns for potential shortcuts
   */
  analyzeKeyPattern(sequence) {
    if (sequence.length < 3) return;

    // Detect repetitive patterns
    const pattern = sequence.map(k => k.key).join('');
    const repetitions = this.countPatternRepetitions(pattern);

    if (repetitions > 2) {
      this.suggestMacro(sequence);
    }
  }

  /**
   * Count pattern repetitions
   */
  countPatternRepetitions(pattern) {
    let count = 0;
    const half = Math.floor(pattern.length / 2);

    for (let i = 1; i <= half; i++) {
      const chunk = pattern.slice(-i);
      const prev = pattern.slice(-(i * 2), -i);
      if (chunk === prev) count++;
    }

    return count;
  }

  /**
   * Handle clipboard change event
   */
  onClipboardChange(text, detection) {
    try {
      this.addToHistory({
        type: 'clipboard',
        content: text,
        detection: detection,
        timestamp: Date.now()
      });

      // Generate suggestions based on clipboard content
      const suggestions = this.generateClipboardSuggestions(text, detection);
      this.updateSuggestions(suggestions);
    } catch (error) {
      console.error('Error handling clipboard change:', error);
    }
  }

  /**
   * Handle tool opened event
   */
  onToolOpened(toolId) {
    try {
      this.addToHistory({
        type: 'tool',
        toolId: toolId,
        timestamp: Date.now()
      });

      // Learn from tool sequence
      this.learnSequence(toolId);

      // Predict next tools
      const nextTools = this.predictNextTools(toolId);
      if (nextTools.length > 0) {
        this.updateSuggestions(nextTools);
      }
    } catch (error) {
      console.error('Error handling tool opened:', error);
    }
  }

  /**
   * Add event to context history
   */
  addToHistory(event) {
    this.contextHistory.push(event);

    // Keep only last 100 events
    if (this.contextHistory.length > 100) {
      this.contextHistory.shift();
    }
  }

  /**
   * Generate suggestions based on clipboard content
   */
  generateClipboardSuggestions(text, detection) {
    const suggestions = [];

    if (!detection || !detection.type) return suggestions;

    const type = detection.type;
    const confidence = detection.confidence || 0;

    // Map data types to relevant tools
    const typeToTools = {
      'json': [
        { tool: 'json-formatter', action: 'Format JSON', confidence: 0.9, icon: '📋' },
        { tool: 'json-to-csv', action: 'Convert to CSV', confidence: 0.7, icon: '🔄' },
        { tool: 'jwt-decoder', action: 'Decode JWT', confidence: 0.5, icon: '🔓' }
      ],
      'jwt': [
        { tool: 'jwt-decoder', action: 'Decode JWT Token', confidence: 0.95, icon: '🔓' },
        { tool: 'base64', action: 'Decode Base64', confidence: 0.6, icon: '🔤' }
      ],
      'base64': [
        { tool: 'base64', action: 'Decode Base64', confidence: 0.9, icon: '🔤' },
        { tool: 'hash-generator', action: 'Generate Hash', confidence: 0.5, icon: '🔐' }
      ],
      'url': [
        { tool: 'url-encoder', action: 'Encode/Decode URL', confidence: 0.9, icon: '🔗' },
        { tool: 'curl-builder', action: 'Build cURL Command', confidence: 0.7, icon: '📡' }
      ],
      'sql': [
        { tool: 'sql-formatter', action: 'Format SQL', confidence: 0.95, icon: '🗄️' },
        { tool: 'sql-data-generator', action: 'Generate Test Data', confidence: 0.6, icon: '🎲' }
      ],
      'uuid': [
        { tool: 'uuid-generator', action: 'Generate UUID', confidence: 0.9, icon: '🆔' },
        { tool: 'hash-generator', action: 'Hash UUID', confidence: 0.4, icon: '🔐' }
      ],
      'timestamp': [
        { tool: 'timestamp-converter', action: 'Convert Timestamp', confidence: 0.95, icon: '⏰' },
        { tool: 'quick-calc', action: 'Calculate Time Difference', confidence: 0.5, icon: '🧮' }
      ],
      'xml': [
        { tool: 'html-converter', action: 'Format XML', confidence: 0.8, icon: '📄' },
        { tool: 'json-formatter', action: 'Convert to JSON', confidence: 0.6, icon: '🔄' }
      ],
      'csv': [
        { tool: 'csv-json-converter', action: 'Convert to JSON', confidence: 0.9, icon: '🔄' },
        { tool: 'sql-data-generator', action: 'Generate SQL', confidence: 0.7, icon: '🗄️' }
      ],
      'hex': [
        { tool: 'hash-generator', action: 'Validate Hash', confidence: 0.8, icon: '🔐' },
        { tool: 'base64', action: 'Encode to Base64', confidence: 0.6, icon: '🔤' }
      ]
    };

    const tools = typeToTools[type] || [];

    tools.forEach(toolSuggestion => {
      suggestions.push({
        id: `clipboard-${toolSuggestion.tool}`,
        type: 'tool',
        tool: toolSuggestion.tool,
        action: toolSuggestion.action,
        reason: `Detected ${type} in clipboard`,
        confidence: Math.min(confidence, toolSuggestion.confidence),
        icon: toolSuggestion.icon,
        data: { text, detection }
      });
    });

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, this.maxSuggestions);
  }

  /**
   * Learn from tool sequence
   */
  learnSequence(toolId) {
    if (!this.learningEnabled) return;

    this.sequences.push(toolId);

    // Keep last N tools
    if (this.sequences.length > this.maxSequenceLength) {
      this.sequences.shift();
    }

    // Update patterns
    if (this.sequences.length >= 2) {
      const previous = this.sequences[this.sequences.length - 2];
      const pattern = `${previous}->${toolId}`;

      const count = this.patterns.get(pattern) || 0;
      this.patterns.set(pattern, count + 1);
    }

    // Save patterns periodically
    if (this.patterns.size % 10 === 0) {
      this.savePatterns();
    }
  }

  /**
   * Predict next tools based on current tool
   */
  predictNextTools(currentTool) {
    const predictions = [];
    const minCount = 2; // Minimum times a pattern must occur

    // Find patterns that start with current tool
    for (const [pattern, count] of this.patterns.entries()) {
      if (pattern.startsWith(`${currentTool}->`)) {
        const nextTool = pattern.split('->')[1];
        const confidence = Math.min(0.95, count / 10); // Max 95% confidence

        if (count >= minCount && confidence >= this.confidenceThreshold) {
          predictions.push({
            id: `predict-${nextTool}`,
            type: 'tool',
            tool: nextTool,
            action: `Open ${nextTool}`,
            reason: `You often use ${nextTool} after ${currentTool}`,
            confidence: confidence,
            icon: '🎯',
            count: count
          });
        }
      }
    }

    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  /**
   * Load default patterns
   */
  loadDefaultPatterns() {
    // Common workflow patterns
    const defaults = [
      { pattern: 'json-formatter->csv-json-converter', count: 5 },
      { pattern: 'base64->json-formatter', count: 5 },
      { pattern: 'jwt-decoder->json-formatter', count: 5 },
      { pattern: 'url-encoder->curl-builder', count: 4 },
      { pattern: 'sql-formatter->sql-data-generator', count: 4 },
      { pattern: 'hash-generator->base64', count: 3 },
      { pattern: 'uuid-generator->string-cleaner', count: 3 },
      { pattern: 'timestamp-converter->quick-calc', count: 3 },
      { pattern: 'csv-json-converter->json-formatter', count: 5 },
      { pattern: 'regex-tester->string-cleaner', count: 4 }
    ];

    defaults.forEach(({ pattern, count }) => {
      if (!this.patterns.has(pattern)) {
        this.patterns.set(pattern, count);
      }
    });
  }

  /**
   * Start learning from user behavior
   */
  startLearning() {
    // Analyze context every 30 seconds
    setInterval(() => {
      this.analyzeContext();
    }, 30000);
  }

  /**
   * Analyze current context and generate insights
   */
  analyzeContext() {
    const recentEvents = this.contextHistory.slice(-20);

    // Find patterns in recent activity
    const toolUsage = recentEvents
      .filter(e => e.type === 'tool')
      .map(e => e.toolId);

    // Detect workflow loops
    if (toolUsage.length >= 4) {
      const loops = this.detectLoops(toolUsage);
      if (loops.length > 0) {
        this.suggestPipeline(loops[0]);
      }
    }

    // Detect inefficient workflows
    const inefficiencies = this.detectInefficiencies(recentEvents);
    if (inefficiencies.length > 0) {
      this.suggestOptimization(inefficiencies[0]);
    }
  }

  /**
   * Detect repeated tool sequences (loops)
   */
  detectLoops(sequence) {
    const loops = [];

    for (let len = 2; len <= Math.floor(sequence.length / 2); len++) {
      for (let i = 0; i <= sequence.length - len * 2; i++) {
        const pattern = sequence.slice(i, i + len);
        const next = sequence.slice(i + len, i + len * 2);

        if (JSON.stringify(pattern) === JSON.stringify(next)) {
          loops.push({
            pattern: pattern,
            repetitions: 2,
            position: i
          });
        }
      }
    }

    return loops;
  }

  /**
   * Detect inefficient workflows
   */
  detectInefficiencies(events) {
    const inefficiencies = [];

    // Check for manual copy-paste between tools that could be pipelined
    for (let i = 0; i < events.length - 2; i++) {
      if (events[i].type === 'tool' &&
          events[i + 1].type === 'clipboard' &&
          events[i + 2].type === 'tool') {

        inefficiencies.push({
          type: 'manual-pipeline',
          tools: [events[i].toolId, events[i + 2].toolId],
          timestamp: events[i].timestamp
        });
      }
    }

    return inefficiencies;
  }

  /**
   * Suggest pipeline creation
   */
  suggestPipeline(loop) {
    this.updateSuggestions([{
      id: 'suggest-pipeline',
      type: 'action',
      action: 'Create Pipeline',
      reason: `Detected repeated sequence: ${loop.pattern.join(' → ')}`,
      confidence: 0.85,
      icon: '⚡',
      data: { tools: loop.pattern }
    }]);
  }

  /**
   * Suggest workflow optimization
   */
  suggestOptimization(inefficiency) {
    this.updateSuggestions([{
      id: 'suggest-optimization',
      type: 'action',
      action: 'Create Pipeline',
      reason: `You can automate ${inefficiency.tools.join(' → ')}`,
      confidence: 0.8,
      icon: '🚀',
      data: { tools: inefficiency.tools }
    }]);
  }

  /**
   * Suggest macro creation
   */
  suggestMacro(sequence) {
    this.updateSuggestions([{
      id: 'suggest-macro',
      type: 'action',
      action: 'Create Macro',
      reason: 'Detected repetitive key pattern',
      confidence: 0.75,
      icon: '⌨️',
      data: { sequence }
    }]);
  }

  /**
   * Update suggestions
   */
  updateSuggestions(newSuggestions) {
    // Merge with existing suggestions
    const merged = [...this.suggestions];

    newSuggestions.forEach(newSugg => {
      const existing = merged.findIndex(s => s.id === newSugg.id);
      if (existing >= 0) {
        merged[existing] = newSugg;
      } else {
        merged.push(newSugg);
      }
    });

    // Sort by confidence and keep top suggestions
    this.suggestions = merged
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.maxSuggestions);

    // Emit event for UI update
    this.emitSuggestionsUpdate();
  }

  /**
   * Emit suggestions update event
   */
  emitSuggestionsUpdate() {
    const event = new CustomEvent('context-suggestions-updated', {
      detail: { suggestions: this.suggestions }
    });
    document.dispatchEvent(event);
  }

  /**
   * Get current suggestions
   */
  getSuggestions() {
    return this.suggestions;
  }

  /**
   * Execute suggestion
   */
  executeSuggestion(suggestionId) {
    const suggestion = this.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    if (suggestion.type === 'tool' && suggestion.tool) {
      window.openTool && window.openTool(suggestion.tool);
    } else if (suggestion.type === 'action') {
      this.executeAction(suggestion);
    }

    // Remove executed suggestion
    this.suggestions = this.suggestions.filter(s => s.id !== suggestionId);
    this.emitSuggestionsUpdate();
  }

  /**
   * Execute suggested action
   */
  executeAction(suggestion) {
    switch (suggestion.action) {
      case 'Create Pipeline':
        if (window.PipelineManager && suggestion.data.tools) {
          // Open pipeline creator with suggested tools
          console.log('Creating pipeline:', suggestion.data.tools);
        }
        break;

      case 'Create Macro':
        if (window.Commander && suggestion.data.sequence) {
          console.log('Creating macro:', suggestion.data.sequence);
        }
        break;
    }
  }

  /**
   * Load patterns from storage
   */
  loadPatterns() {
    try {
      const stored = localStorage.getItem('devchef-context-patterns');
      if (stored) {
        const data = JSON.parse(stored);
        return new Map(Object.entries(data));
      }
    } catch (e) {
      console.error('Failed to load patterns:', e);
    }
    return new Map();
  }

  /**
   * Save patterns to storage
   */
  savePatterns() {
    try {
      const data = Object.fromEntries(this.patterns);
      localStorage.setItem('devchef-context-patterns', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save patterns:', e);
    }
  }

  /**
   * Get analytics
   */
  getAnalytics() {
    return {
      totalPatterns: this.patterns.size,
      recentEvents: this.contextHistory.length,
      suggestions: this.suggestions.length,
      mostCommonPatterns: Array.from(this.patterns.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([pattern, count]) => ({ pattern, count }))
    };
  }

  /**
   * Clear learning data
   */
  clearLearning() {
    this.patterns.clear();
    this.sequences = [];
    this.contextHistory = [];
    this.suggestions = [];
    localStorage.removeItem('devchef-context-patterns');
    this.emitSuggestionsUpdate();
  }

  /**
   * Export learning data
   */
  exportLearning() {
    return {
      patterns: Object.fromEntries(this.patterns),
      sequences: this.sequences,
      timestamp: Date.now()
    };
  }

  /**
   * Import learning data
   */
  importLearning(data) {
    if (data.patterns) {
      this.patterns = new Map(Object.entries(data.patterns));
    }
    if (data.sequences) {
      this.sequences = data.sequences;
    }
    this.savePatterns();
  }
}

// Create and export singleton
export const contextEngine = new ContextEngine();
export { ContextEngine };
