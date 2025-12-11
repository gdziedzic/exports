/**
 * Error Boundary - V6
 * Comprehensive error catching, recovery, and reporting
 *
 * Features:
 * - Global error catching
 * - Error recovery strategies
 * - Error reporting and logging
 * - Stack trace analysis
 * - User-friendly error messages
 * - Automatic retry mechanisms
 * - Error boundaries for components
 * - Crash reporting
 */

class ErrorBoundary {
  constructor() {
    this.errors = [];
    this.maxErrors = 100;
    this.errorCount = new Map();
    this.recoveryStrategies = new Map();
    this.errorHandlers = new Map();
    this.init();
  }

  /**
   * Initialize Error Boundary
   */
  init() {
    try {
      this.setupGlobalErrorHandlers();
      this.setupRecoveryStrategies();
      console.log('🛡️ Error Boundary initialized - Comprehensive Protection');
    } catch (error) {
      console.error('Error initializing Error Boundary:', error);
    }
  }

  /**
   * Setup global error handlers
   */
  setupGlobalErrorHandlers() {
    try {
      // Handle uncaught errors
      window.addEventListener('error', (event) => {
        this.handleError(event.error || new Error(event.message), {
          type: 'uncaught',
          source: event.filename,
          line: event.lineno,
          column: event.colno
        });
      });

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(event.reason, {
          type: 'unhandled-promise',
          promise: event.promise
        });
      });

      // Handle console errors
      const originalError = console.error;
      console.error = (...args) => {
        this.logError('console', args.join(' '));
        originalError.apply(console, args);
      };
    } catch (error) {
      console.error('Error setting up error handlers:', error);
    }
  }

  /**
   * Setup recovery strategies
   */
  setupRecoveryStrategies() {
    try {
      // Reload page strategy
      this.addRecoveryStrategy('reload', () => {
        window.location.reload();
      });

      // Reset state strategy
      this.addRecoveryStrategy('reset-state', () => {
        if (window.stateManager) {
          window.stateManager.reset();
        }
      });

      // Reload tool strategy
      this.addRecoveryStrategy('reload-tool', () => {
        if (window.toolOrchestrator) {
          window.toolOrchestrator.reloadCurrentTool();
        }
      });

      // Clear cache strategy
      this.addRecoveryStrategy('clear-cache', () => {
        if (window.toolOrchestrator) {
          window.toolOrchestrator.clearCache();
        }
        localStorage.clear();
      });
    } catch (error) {
      console.error('Error setting up recovery strategies:', error);
    }
  }

  /**
   * Handle error
   */
  handleError(error, context = {}) {
    try {
      // Create error record
      const errorRecord = {
        message: error?.message || String(error),
        stack: error?.stack,
        context,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      // Add to errors list
      this.errors.unshift(errorRecord);
      if (this.errors.length > this.maxErrors) {
        this.errors.pop();
      }

      // Track error count
      const errorKey = errorRecord.message;
      this.errorCount.set(errorKey, (this.errorCount.get(errorKey) || 0) + 1);

      // Check if error is critical (repeated many times)
      const count = this.errorCount.get(errorKey);
      if (count >= 5) {
        this.handleCriticalError(errorRecord);
        return;
      }

      // Show user-friendly error message
      this.showErrorNotification(errorRecord);

      // Log error
      this.logError('error', errorRecord);

      // Try to recover
      this.attemptRecovery(errorRecord);
    } catch (err) {
      console.error('Error in error handler:', err);
    }
  }

  /**
   * Handle critical error (repeated failures)
   */
  handleCriticalError(errorRecord) {
    try {
      if (window.uiEngine) {
        window.uiEngine.showModal(`
          <div class="error-critical">
            <h3>⚠️ Critical Error Detected</h3>
            <p>The application has encountered a repeated error and may be unstable.</p>
            <p><strong>Error:</strong> ${this.sanitizeError(errorRecord.message)}</p>
            <div class="error-actions">
              <button onclick="window.errorBoundary.recover('reload')">Reload Page</button>
              <button onclick="window.errorBoundary.recover('reset-state')">Reset State</button>
              <button onclick="window.errorBoundary.recover('clear-cache')">Clear Cache & Reload</button>
            </div>
          </div>
        `, {
          title: 'Critical Error',
          size: 'medium',
          closeButton: false
        });
      }
    } catch (error) {
      console.error('Error handling critical error:', error);
    }
  }

  /**
   * Show error notification
   */
  showErrorNotification(errorRecord) {
    try {
      if (!window.uiEngine) return;

      const message = this.getUserFriendlyMessage(errorRecord);

      window.uiEngine.showToast(message, {
        type: 'error',
        duration: 6000,
        action: {
          text: 'Details',
          handler: () => this.showErrorDetails(errorRecord)
        }
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(errorRecord) {
    try {
      const { message, context } = errorRecord;

      // Map common errors to friendly messages
      const friendlyMessages = {
        'Failed to fetch': 'Unable to load resource. Please check your connection.',
        'NetworkError': 'Network error occurred. Please try again.',
        'SyntaxError': 'An unexpected error occurred. Please refresh the page.',
        'TypeError': 'Something went wrong. The page will attempt to recover.',
        'ReferenceError': 'A component failed to load properly.'
      };

      for (const [key, friendlyMsg] of Object.entries(friendlyMessages)) {
        if (message.includes(key)) {
          return friendlyMsg;
        }
      }

      return 'An error occurred. We\'re working to recover.';
    } catch (error) {
      return 'An error occurred';
    }
  }

  /**
   * Show error details
   */
  showErrorDetails(errorRecord) {
    try {
      if (!window.uiEngine) return;

      window.uiEngine.showModal(`
        <div class="error-details">
          <p><strong>Message:</strong> ${this.sanitizeError(errorRecord.message)}</p>
          <p><strong>Time:</strong> ${new Date(errorRecord.timestamp).toLocaleString()}</p>
          ${errorRecord.stack ? `
            <p><strong>Stack Trace:</strong></p>
            <pre>${this.sanitizeError(errorRecord.stack)}</pre>
          ` : ''}
          <p><strong>Context:</strong></p>
          <pre>${JSON.stringify(errorRecord.context, null, 2)}</pre>
        </div>
      `, {
        title: 'Error Details',
        size: 'large'
      });
    } catch (error) {
      console.error('Error showing details:', error);
    }
  }

  /**
   * Sanitize error message (prevent XSS)
   */
  sanitizeError(text) {
    try {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    } catch (error) {
      return String(text);
    }
  }

  /**
   * Attempt recovery
   */
  attemptRecovery(errorRecord) {
    try {
      const { context } = errorRecord;

      // Choose recovery strategy based on error type
      if (context.type === 'uncaught' && context.source?.includes('tools/')) {
        // Tool error - reload tool
        setTimeout(() => this.recover('reload-tool'), 1000);
      }
    } catch (error) {
      console.error('Error attempting recovery:', error);
    }
  }

  /**
   * Add recovery strategy
   */
  addRecoveryStrategy(name, handler) {
    try {
      this.recoveryStrategies.set(name, handler);
    } catch (error) {
      console.error('Error adding recovery strategy:', error);
    }
  }

  /**
   * Recover using strategy
   */
  recover(strategyName) {
    try {
      const strategy = this.recoveryStrategies.get(strategyName);
      if (!strategy) {
        console.warn(`Recovery strategy "${strategyName}" not found`);
        return false;
      }

      strategy();
      return true;
    } catch (error) {
      console.error('Error executing recovery strategy:', error);
      return false;
    }
  }

  /**
   * Log error
   */
  logError(level, data) {
    try {
      const logEntry = {
        level,
        data,
        timestamp: Date.now()
      };

      // Store in session storage for debugging
      const logs = JSON.parse(sessionStorage.getItem('devchef-error-logs') || '[]');
      logs.unshift(logEntry);
      logs.splice(100); // Keep last 100
      sessionStorage.setItem('devchef-error-logs', JSON.stringify(logs));
    } catch (error) {
      console.error('Error logging:', error);
    }
  }

  /**
   * Get error logs
   */
  getErrorLogs() {
    try {
      return JSON.parse(sessionStorage.getItem('devchef-error-logs') || '[]');
    } catch (error) {
      return [];
    }
  }

  /**
   * Clear errors
   */
  clearErrors() {
    try {
      this.errors = [];
      this.errorCount.clear();
      sessionStorage.removeItem('devchef-error-logs');
    } catch (error) {
      console.error('Error clearing errors:', error);
    }
  }

  /**
   * Get error statistics
   */
  getStatistics() {
    try {
      return {
        totalErrors: this.errors.length,
        uniqueErrors: this.errorCount.size,
        topErrors: Array.from(this.errorCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([message, count]) => ({ message, count }))
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      return { totalErrors: 0, uniqueErrors: 0, topErrors: [] };
    }
  }

  /**
   * Wrap function with error boundary
   */
  wrap(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error, { ...context, function: fn.name });
        throw error;
      }
    };
  }

  /**
   * Wrap async function with retry
   */
  wrapWithRetry(fn, maxRetries = 3, delay = 1000) {
    return async (...args) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fn(...args);
        } catch (error) {
          if (attempt === maxRetries) {
            this.handleError(error, { function: fn.name, attempts: attempt });
            throw error;
          }

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    };
  }
}

// Export singleton instance
export const errorBoundary = new ErrorBoundary();
// Make globally available for recovery buttons
window.errorBoundary = errorBoundary;
export { ErrorBoundary };
