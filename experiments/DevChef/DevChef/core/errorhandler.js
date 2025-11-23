/**
 * DevChef V2.6 - Error Handler
 * Comprehensive error handling, logging, and recovery system
 */

class ErrorHandler {
  constructor() {
    this.errors = [];
    this.maxErrors = 100;
    this.errorCallbacks = [];
    this.recoveryStrategies = new Map();
    this.setupGlobalHandlers();
  }

  /**
   * Setup global error handlers
   */
  setupGlobalHandlers() {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'uncaught',
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error,
        timestamp: Date.now()
      });

      // Prevent default browser error handling
      event.preventDefault();
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'promise',
        message: event.reason?.message || 'Unhandled promise rejection',
        error: event.reason,
        timestamp: Date.now()
      });

      event.preventDefault();
    });

    console.log('✓ Global error handlers initialized');
  }

  /**
   * Handle error with logging and recovery
   */
  handleError(errorInfo) {
    // Add to error log
    this.errors.push(errorInfo);

    // Keep only last N errors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log to console in development
    if (this.isDevelopment()) {
      console.error('DevChef Error:', errorInfo);
    }

    // Store in localStorage for persistence
    this.persistError(errorInfo);

    // Attempt recovery
    this.attemptRecovery(errorInfo);

    // Notify registered callbacks
    this.notifyCallbacks(errorInfo);

    // Show user-friendly error message
    this.showUserError(errorInfo);
  }

  /**
   * Wrap function with error handling
   */
  wrap(fn, context = 'unknown') {
    return async (...args) => {
      try {
        const result = await fn(...args);
        return result;
      } catch (error) {
        this.handleError({
          type: 'wrapped',
          context,
          message: error.message,
          error,
          timestamp: Date.now()
        });
        return null;
      }
    };
  }

  /**
   * Attempt to recover from error
   */
  attemptRecovery(errorInfo) {
    const strategy = this.recoveryStrategies.get(errorInfo.type);
    if (strategy) {
      try {
        strategy(errorInfo);
      } catch (recoveryError) {
        console.error('Recovery failed:', recoveryError);
      }
    }
  }

  /**
   * Register recovery strategy
   */
  registerRecovery(errorType, strategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }

  /**
   * Persist error to localStorage
   */
  persistError(errorInfo) {
    try {
      const key = 'devchef-errors';
      const stored = localStorage.getItem(key);
      const errors = stored ? JSON.parse(stored) : [];

      errors.push({
        ...errorInfo,
        error: errorInfo.error?.message || 'Unknown error',
        stack: errorInfo.error?.stack || null
      });

      // Keep last 50 errors
      const trimmed = errors.slice(-50);
      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Could not persist error:', e);
    }
  }

  /**
   * Show user-friendly error message
   */
  showUserError(errorInfo) {
    // Use notification system if available
    if (window.DevChef?.notifications) {
      const message = this.getUserFriendlyMessage(errorInfo);
      window.DevChef.notifications.error(message, {
        duration: 5000,
        actions: [
          {
            label: 'Report',
            onClick: () => this.openErrorReport(errorInfo)
          }
        ]
      });
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(errorInfo) {
    const messages = {
      'storage': 'Unable to save data. Your browser storage may be full.',
      'network': 'Network error occurred. Please check your connection.',
      'tool': 'Tool failed to load. Please try refreshing the page.',
      'clipboard': 'Clipboard access denied. Please check browser permissions.',
      'default': 'An unexpected error occurred. The app will try to recover.'
    };

    // Try to match error type or message
    for (const [key, message] of Object.entries(messages)) {
      if (errorInfo.type?.includes(key) || errorInfo.message?.includes(key)) {
        return message;
      }
    }

    return messages.default;
  }

  /**
   * Register error callback
   */
  onError(callback) {
    this.errorCallbacks.push(callback);
  }

  /**
   * Notify all callbacks
   */
  notifyCallbacks(errorInfo) {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(errorInfo);
      } catch (e) {
        console.error('Error callback failed:', e);
      }
    });
  }

  /**
   * Get all errors
   */
  getErrors() {
    return [...this.errors];
  }

  /**
   * Clear error log
   */
  clearErrors() {
    this.errors = [];
    try {
      localStorage.removeItem('devchef-errors');
    } catch (e) {
      console.warn('Could not clear persisted errors:', e);
    }
  }

  /**
   * Export error log
   */
  exportErrors() {
    const data = {
      version: '2.6',
      timestamp: new Date().toISOString(),
      errors: this.errors,
      userAgent: navigator.userAgent,
      platform: navigator.platform
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devchef-errors-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Open error report dialog
   */
  openErrorReport(errorInfo) {
    if (window.DevChef?.notifications) {
      const report = this.generateErrorReport(errorInfo);
      window.DevChef.notifications.prompt('Error Report', {
        defaultValue: report,
        multiline: true,
        hint: 'Copy this report to submit to developers'
      });
    }
  }

  /**
   * Generate error report
   */
  generateErrorReport(errorInfo) {
    return `DevChef V2.6 Error Report

Time: ${new Date(errorInfo.timestamp).toISOString()}
Type: ${errorInfo.type}
Message: ${errorInfo.message}
Context: ${errorInfo.context || 'N/A'}

Browser: ${navigator.userAgent}
Platform: ${navigator.platform}

Stack Trace:
${errorInfo.error?.stack || 'Not available'}
`;
  }

  /**
   * Check if in development mode
   */
  isDevelopment() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  /**
   * Get error statistics
   */
  getStats() {
    const types = {};
    this.errors.forEach(error => {
      types[error.type] = (types[error.type] || 0) + 1;
    });

    return {
      total: this.errors.length,
      types,
      recent: this.errors.slice(-5)
    };
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Export class for testing
export { ErrorHandler };
