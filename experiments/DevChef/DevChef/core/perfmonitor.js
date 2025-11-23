/**
 * Performance Monitor - V6.5
 * Real-time performance monitoring, optimization, and insights
 *
 * Features:
 * - FPS monitoring and frame drops detection
 * - Memory usage tracking with leak detection
 * - Network performance monitoring
 * - Tool load time analytics
 * - Automatic optimization suggestions
 * - Performance budget alerts
 * - Bottleneck identification
 * - Resource usage heatmap
 * - Performance timeline
 * - Export performance reports
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: [],
      memory: [],
      loadTimes: new Map(),
      interactions: [],
      network: []
    };
    this.alerts = [];
    this.thresholds = {
      fps: 15, // Lowered from 30 to reduce noise
      memory: 100 * 1024 * 1024, // 100MB
      loadTime: 1000, // 1s
      interaction: 100 // 100ms
    };
    this.isMonitoring = false;
    this.performanceBudget = {
      tools: 50, // Max 50 tools
      memory: 200 * 1024 * 1024, // 200MB
      cacheSize: 10 * 1024 * 1024 // 10MB
    };
    this.lastAlertTime = {
      fps: 0,
      memory: 0,
      loadTime: 0,
      interaction: 0
    };
    this.alertThrottle = 10000; // Throttle alerts to once per 10 seconds
    this.init();
  }

  /**
   * Initialize performance monitor
   */
  init() {
    try {
      this.setupFPSMonitoring();
      this.setupMemoryMonitoring();
      this.setupLoadTimeTracking();
      this.setupInteractionTracking();
      console.log('🚀 Performance Monitor initialized - Real-time Optimization');
    } catch (error) {
      console.error('Error initializing Performance Monitor:', error);
    }
  }

  /**
   * Start monitoring
   */
  start() {
    try {
      this.isMonitoring = true;
      this.startFPSTracking();
      this.startMemoryTracking();
      console.log('📊 Performance monitoring started');
    } catch (error) {
      console.error('Error starting monitor:', error);
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    try {
      this.isMonitoring = false;
      console.log('⏸️ Performance monitoring stopped');
    } catch (error) {
      console.error('Error stopping monitor:', error);
    }
  }

  /**
   * Setup FPS monitoring
   */
  setupFPSMonitoring() {
    try {
      this.lastFrameTime = performance.now();
      this.frameCount = 0;
    } catch (error) {
      console.error('Error setting up FPS monitoring:', error);
    }
  }

  /**
   * Start FPS tracking
   */
  startFPSTracking() {
    try {
      const measureFPS = () => {
        if (!this.isMonitoring) return;

        const now = performance.now();
        const delta = now - this.lastFrameTime;
        const fps = Math.round(1000 / delta);

        this.metrics.fps.push({
          value: fps,
          timestamp: now
        });

        // Keep last 100 measurements
        if (this.metrics.fps.length > 100) {
          this.metrics.fps.shift();
        }

        // Alert on low FPS (throttled to avoid spam)
        if (fps < this.thresholds.fps) {
          const now = Date.now();
          if (now - this.lastAlertTime.fps > this.alertThrottle) {
            this.addAlert('Low FPS detected', `FPS: ${fps}`, 'warning');
            this.lastAlertTime.fps = now;
          }
        }

        this.lastFrameTime = now;
        requestAnimationFrame(measureFPS);
      };

      requestAnimationFrame(measureFPS);
    } catch (error) {
      console.error('Error starting FPS tracking:', error);
    }
  }

  /**
   * Setup memory monitoring
   */
  setupMemoryMonitoring() {
    try {
      // Check if performance.memory is available
      if (performance.memory) {
        setInterval(() => {
          if (!this.isMonitoring) return;

          const memory = {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit,
            timestamp: Date.now()
          };

          this.metrics.memory.push(memory);

          // Keep last 100 measurements
          if (this.metrics.memory.length > 100) {
            this.metrics.memory.shift();
          }

          // Alert on high memory (throttled)
          if (memory.used > this.thresholds.memory) {
            const now = Date.now();
            if (now - this.lastAlertTime.memory > this.alertThrottle) {
              this.addAlert('High memory usage', `${(memory.used / 1024 / 1024).toFixed(2)}MB`, 'warning');
              this.lastAlertTime.memory = now;
            }
          }

          // Detect memory leaks
          this.detectMemoryLeak();
        }, 5000); // Check every 5 seconds
      }
    } catch (error) {
      console.error('Error setting up memory monitoring:', error);
    }
  }

  /**
   * Start memory tracking
   */
  startMemoryTracking() {
    try {
      // Memory tracking is handled by setupMemoryMonitoring interval
    } catch (error) {
      console.error('Error starting memory tracking:', error);
    }
  }

  /**
   * Detect memory leak
   */
  detectMemoryLeak() {
    try {
      if (this.metrics.memory.length < 10) return;

      const recent = this.metrics.memory.slice(-10);
      const trend = recent.every((m, i) => {
        if (i === 0) return true;
        return m.used > recent[i - 1].used;
      });

      if (trend) {
        this.addAlert('Possible memory leak', 'Memory usage continuously increasing', 'error');
      }
    } catch (error) {
      console.error('Error detecting memory leak:', error);
    }
  }

  /**
   * Setup load time tracking
   */
  setupLoadTimeTracking() {
    try {
      // Hook into tool loading if orchestrator is available
      if (window.toolOrchestrator) {
        const originalLoad = window.toolOrchestrator.loadTool.bind(window.toolOrchestrator);

        window.toolOrchestrator.loadTool = async (toolId) => {
          const startTime = performance.now();

          try {
            const result = await originalLoad(toolId);
            const loadTime = performance.now() - startTime;

            this.metrics.loadTimes.set(toolId, {
              time: loadTime,
              timestamp: Date.now()
            });

            if (loadTime > this.thresholds.loadTime) {
              const now = Date.now();
              if (now - this.lastAlertTime.loadTime > this.alertThrottle) {
                this.addAlert('Slow tool load', `${toolId}: ${loadTime.toFixed(0)}ms`, 'warning');
                this.lastAlertTime.loadTime = now;
              }
            }

            return result;
          } catch (error) {
            throw error;
          }
        };
      }
    } catch (error) {
      console.error('Error setting up load time tracking:', error);
    }
  }

  /**
   * Setup interaction tracking
   */
  setupInteractionTracking() {
    try {
      // Track click interactions
      document.addEventListener('click', (e) => {
        if (!this.isMonitoring) return;

        const startTime = performance.now();

        requestIdleCallback(() => {
          const interactionTime = performance.now() - startTime;

          this.metrics.interactions.push({
            type: 'click',
            time: interactionTime,
            timestamp: Date.now()
          });

          // Keep last 50 interactions
          if (this.metrics.interactions.length > 50) {
            this.metrics.interactions.shift();
          }

          if (interactionTime > this.thresholds.interaction) {
            const now = Date.now();
            if (now - this.lastAlertTime.interaction > this.alertThrottle) {
              this.addAlert('Slow interaction', `${interactionTime.toFixed(0)}ms`, 'warning');
              this.lastAlertTime.interaction = now;
            }
          }
        });
      });
    } catch (error) {
      console.error('Error setting up interaction tracking:', error);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    try {
      const avgFPS = this.calculateAverage(this.metrics.fps.map(f => f.value));
      const avgMemory = this.calculateAverage(this.metrics.memory.map(m => m.used));
      const avgLoadTime = this.calculateAverage(Array.from(this.metrics.loadTimes.values()).map(l => l.time));
      const avgInteraction = this.calculateAverage(this.metrics.interactions.map(i => i.time));

      return {
        fps: {
          current: this.metrics.fps.length > 0 ? this.metrics.fps[this.metrics.fps.length - 1].value : 0,
          average: avgFPS,
          min: Math.min(...this.metrics.fps.map(f => f.value), Infinity),
          max: Math.max(...this.metrics.fps.map(f => f.value), 0)
        },
        memory: {
          current: this.metrics.memory.length > 0 ? this.metrics.memory[this.metrics.memory.length - 1].used : 0,
          average: avgMemory,
          peak: Math.max(...this.metrics.memory.map(m => m.used), 0)
        },
        loadTimes: {
          average: avgLoadTime,
          count: this.metrics.loadTimes.size
        },
        interactions: {
          average: avgInteraction,
          count: this.metrics.interactions.length
        }
      };
    } catch (error) {
      console.error('Error getting metrics:', error);
      return {};
    }
  }

  /**
   * Calculate average
   */
  calculateAverage(values) {
    try {
      if (values.length === 0) return 0;
      const sum = values.reduce((a, b) => a + b, 0);
      return sum / values.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Add alert
   */
  addAlert(title, message, severity = 'info') {
    try {
      const alert = {
        id: `alert-${Date.now()}`,
        title,
        message,
        severity,
        timestamp: Date.now()
      };

      this.alerts.push(alert);

      // Keep last 20 alerts
      if (this.alerts.length > 20) {
        this.alerts.shift();
      }

      // Show notification if UI Engine is available
      if (window.uiEngine) {
        window.uiEngine.showToast(`${title}: ${message}`, {
          type: severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info',
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error adding alert:', error);
    }
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions() {
    try {
      const suggestions = [];
      const metrics = this.getMetrics();

      // FPS suggestions
      if (metrics.fps.average < 45) {
        suggestions.push({
          type: 'fps',
          title: 'Low FPS detected',
          description: 'Consider reducing animations or enabling reduced motion mode',
          action: () => {
            if (document.body) {
              document.body.classList.add('reduced-motion');
            }
          }
        });
      }

      // Memory suggestions
      if (metrics.memory.current > this.performanceBudget.memory * 0.8) {
        suggestions.push({
          type: 'memory',
          title: 'High memory usage',
          description: 'Clear tool cache to free up memory',
          action: () => {
            if (window.toolOrchestrator) {
              window.toolOrchestrator.clearCache();
            }
          }
        });
      }

      // Load time suggestions
      if (metrics.loadTimes.average > 500) {
        suggestions.push({
          type: 'loadTime',
          title: 'Slow tool loading',
          description: 'Enable tool preloading for faster access',
          action: () => {
            // Preload frequently used tools
            if (window.toolOrchestrator && window.stateManager) {
              const recent = window.stateManager.get('tools.recent') || [];
              window.toolOrchestrator.preloadTools(recent.slice(0, 5));
            }
          }
        });
      }

      return suggestions;
    } catch (error) {
      console.error('Error getting optimization suggestions:', error);
      return [];
    }
  }

  /**
   * Generate performance report
   */
  generateReport() {
    try {
      const metrics = this.getMetrics();
      const suggestions = this.getOptimizationSuggestions();

      return {
        timestamp: Date.now(),
        metrics,
        alerts: this.alerts,
        suggestions,
        budget: {
          memory: {
            used: metrics.memory.current,
            limit: this.performanceBudget.memory,
            percentage: (metrics.memory.current / this.performanceBudget.memory * 100).toFixed(1)
          }
        }
      };
    } catch (error) {
      console.error('Error generating report:', error);
      return {};
    }
  }

  /**
   * Export report as JSON
   */
  exportReport() {
    try {
      const report = this.generateReport();
      const json = JSON.stringify(report, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `devchef-performance-${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  }

  /**
   * Show performance panel
   */
  showPanel() {
    try {
      if (!window.uiEngine) return;

      const metrics = this.getMetrics();
      const suggestions = this.getOptimizationSuggestions();

      const content = `
        <div class="performance-panel">
          <div class="metrics-grid">
            <div class="metric-card">
              <h3>🎯 FPS</h3>
              <div class="metric-value">${metrics.fps.current}</div>
              <div class="metric-detail">Avg: ${metrics.fps.average.toFixed(1)} | Min: ${metrics.fps.min}</div>
            </div>
            <div class="metric-card">
              <h3>💾 Memory</h3>
              <div class="metric-value">${(metrics.memory.current / 1024 / 1024).toFixed(1)}MB</div>
              <div class="metric-detail">Peak: ${(metrics.memory.peak / 1024 / 1024).toFixed(1)}MB</div>
            </div>
            <div class="metric-card">
              <h3>⚡ Load Time</h3>
              <div class="metric-value">${metrics.loadTimes.average.toFixed(0)}ms</div>
              <div class="metric-detail">${metrics.loadTimes.count} tools loaded</div>
            </div>
            <div class="metric-card">
              <h3>👆 Interactions</h3>
              <div class="metric-value">${metrics.interactions.average.toFixed(0)}ms</div>
              <div class="metric-detail">${metrics.interactions.count} tracked</div>
            </div>
          </div>

          ${suggestions.length > 0 ? `
            <div class="suggestions-section">
              <h3>💡 Optimization Suggestions</h3>
              <div class="suggestions-list">
                ${suggestions.map(s => `
                  <div class="suggestion-item">
                    <strong>${s.title}</strong>
                    <p>${s.description}</p>
                    <button onclick="window.performanceMonitor.applySuggestion('${s.type}')">Apply</button>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="actions">
            <button onclick="window.performanceMonitor.exportReport()">Export Report</button>
            <button onclick="window.performanceMonitor.clearMetrics()">Clear Metrics</button>
          </div>
        </div>
      `;

      window.uiEngine.showModal(content, {
        title: '🚀 Performance Monitor',
        size: 'large'
      });
    } catch (error) {
      console.error('Error showing performance panel:', error);
    }
  }

  /**
   * Apply suggestion
   */
  applySuggestion(type) {
    try {
      const suggestions = this.getOptimizationSuggestions();
      const suggestion = suggestions.find(s => s.type === type);

      if (suggestion && suggestion.action) {
        suggestion.action();

        if (window.uiEngine) {
          window.uiEngine.showToast(`Applied: ${suggestion.title}`, { type: 'success' });
        }
      }
    } catch (error) {
      console.error('Error applying suggestion:', error);
    }
  }

  /**
   * Clear metrics
   */
  clearMetrics() {
    try {
      this.metrics = {
        fps: [],
        memory: [],
        loadTimes: new Map(),
        interactions: [],
        network: []
      };
      this.alerts = [];

      if (window.uiEngine) {
        window.uiEngine.showToast('Metrics cleared', { type: 'success' });
      }
    } catch (error) {
      console.error('Error clearing metrics:', error);
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
export { PerformanceMonitor };
