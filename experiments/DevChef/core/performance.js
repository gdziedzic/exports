/**
 * DevChef V2.6 - Performance Monitor
 * Real-time performance tracking and optimization
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      loadTime: 0,
      renderTime: 0,
      toolLoadTimes: new Map(),
      memoryUsage: [],
      fps: [],
      interactions: []
    };
    this.marks = new Map();
    this.observers = [];
    this.isMonitoring = false;
  }

  /**
   * Initialize performance monitoring
   */
  init() {
    // Capture page load time
    if (performance.timing) {
      const timing = performance.timing;
      this.metrics.loadTime = timing.loadEventEnd - timing.navigationStart;
    }

    // Use Performance Observer API
    if ('PerformanceObserver' in window) {
      this.setupObservers();
    }

    // Monitor memory if available
    if (performance.memory) {
      this.startMemoryMonitoring();
    }

    // Monitor FPS
    this.startFPSMonitoring();

    this.isMonitoring = true;
    console.log('✓ Performance monitoring initialized');
  }

  /**
   * Setup Performance Observers
   */
  setupObservers() {
    try {
      // Observe navigation timing
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('navigation', entry);
        }
      });
      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navObserver);

      // Observe resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('resource', entry);
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);

      // Observe measures
      const measureObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('measure', entry);
        }
      });
      measureObserver.observe({ entryTypes: ['measure'] });
      this.observers.push(measureObserver);
    } catch (error) {
      console.warn('Performance Observer setup failed:', error);
    }
  }

  /**
   * Record performance metric
   */
  recordMetric(type, entry) {
    const metric = {
      type,
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
      timestamp: Date.now()
    };

    if (type === 'measure' && entry.name.startsWith('tool-')) {
      const toolId = entry.name.replace('tool-', '');
      this.metrics.toolLoadTimes.set(toolId, entry.duration);
    }

    // Store in analytics if available
    if (window.DevChef?.analytics) {
      window.DevChef.analytics.trackEvent('performance', metric);
    }
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    setInterval(() => {
      if (performance.memory) {
        const usage = {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
          timestamp: Date.now()
        };

        this.metrics.memoryUsage.push(usage);

        // Keep only last 100 measurements
        if (this.metrics.memoryUsage.length > 100) {
          this.metrics.memoryUsage.shift();
        }

        // Warn if memory usage is high
        const percentage = (usage.used / usage.limit) * 100;
        if (percentage > 80) {
          console.warn(`High memory usage: ${percentage.toFixed(1)}%`);
          this.suggestGarbageCollection();
        }
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Start FPS monitoring
   */
  startFPSMonitoring() {
    let lastTime = performance.now();
    let frames = 0;

    const measureFPS = () => {
      frames++;
      const currentTime = performance.now();
      const elapsed = currentTime - lastTime;

      if (elapsed >= 1000) {
        const fps = Math.round((frames * 1000) / elapsed);
        this.metrics.fps.push({ fps, timestamp: Date.now() });

        // Keep only last 60 measurements (1 minute)
        if (this.metrics.fps.length > 60) {
          this.metrics.fps.shift();
        }

        // Warn if FPS is low
        if (fps < 30) {
          console.warn(`Low FPS detected: ${fps}`);
        }

        frames = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);
  }

  /**
   * Mark start of operation
   */
  mark(name) {
    performance.mark(`${name}-start`);
    this.marks.set(name, Date.now());
  }

  /**
   * Measure operation duration
   */
  measure(name) {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;

    performance.mark(endMark);

    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name)[0];

      // Clean up marks
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      performance.clearMeasures(name);

      return measure.duration;
    } catch (error) {
      console.warn(`Failed to measure ${name}:`, error);
      return null;
    }
  }

  /**
   * Time async operation
   */
  async time(name, fn) {
    this.mark(name);
    try {
      const result = await fn();
      const duration = this.measure(name);
      console.log(`⏱️ ${name}: ${duration?.toFixed(2)}ms`);
      return result;
    } catch (error) {
      this.measure(name);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const current = {
      loadTime: this.metrics.loadTime,
      toolLoadTimes: Object.fromEntries(this.metrics.toolLoadTimes),
      currentMemory: this.getCurrentMemory(),
      averageFPS: this.getAverageFPS(),
      slowTools: this.getSlowTools(),
      recommendations: this.getRecommendations()
    };

    return current;
  }

  /**
   * Get current memory usage
   */
  getCurrentMemory() {
    if (!performance.memory) return null;

    return {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit,
      percentage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
    };
  }

  /**
   * Get average FPS
   */
  getAverageFPS() {
    if (this.metrics.fps.length === 0) return null;

    const sum = this.metrics.fps.reduce((acc, m) => acc + m.fps, 0);
    return Math.round(sum / this.metrics.fps.length);
  }

  /**
   * Get slow-loading tools
   */
  getSlowTools() {
    const threshold = 100; // ms
    const slow = [];

    for (const [toolId, duration] of this.metrics.toolLoadTimes) {
      if (duration > threshold) {
        slow.push({ toolId, duration });
      }
    }

    return slow.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Get performance recommendations
   */
  getRecommendations() {
    const recommendations = [];

    // Check memory usage
    const memory = this.getCurrentMemory();
    if (memory && memory.percentage > 80) {
      recommendations.push({
        type: 'memory',
        severity: 'high',
        message: 'High memory usage detected. Consider clearing browser cache or closing other tabs.'
      });
    }

    // Check FPS
    const avgFPS = this.getAverageFPS();
    if (avgFPS && avgFPS < 30) {
      recommendations.push({
        type: 'fps',
        severity: 'medium',
        message: 'Low frame rate detected. Consider disabling animations in settings.'
      });
    }

    // Check slow tools
    const slowTools = this.getSlowTools();
    if (slowTools.length > 5) {
      recommendations.push({
        type: 'tools',
        severity: 'low',
        message: `${slowTools.length} tools are loading slowly. This may impact performance.`
      });
    }

    // Check load time
    if (this.metrics.loadTime > 3000) {
      recommendations.push({
        type: 'load',
        severity: 'medium',
        message: 'Slow page load detected. Consider enabling service worker for caching.'
      });
    }

    return recommendations;
  }

  /**
   * Suggest garbage collection
   */
  suggestGarbageCollection() {
    // Trigger GC if available (Chrome DevTools)
    if (window.gc) {
      console.log('Triggering garbage collection...');
      window.gc();
    }

    // Clear old data
    this.clearOldData();
  }

  /**
   * Clear old performance data
   */
  clearOldData() {
    const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour ago

    // Clear old memory measurements
    this.metrics.memoryUsage = this.metrics.memoryUsage.filter(
      m => m.timestamp > cutoff
    );

    // Clear old FPS measurements
    this.metrics.fps = this.metrics.fps.filter(
      m => m.timestamp > cutoff
    );
  }

  /**
   * Export performance report
   */
  exportReport() {
    const report = {
      version: '2.6',
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
      rawData: {
        memoryHistory: this.metrics.memoryUsage,
        fpsHistory: this.metrics.fps,
        toolLoadTimes: Object.fromEntries(this.metrics.toolLoadTimes)
      },
      system: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        cores: navigator.hardwareConcurrency,
        memory: navigator.deviceMemory
      }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devchef-performance-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.isMonitoring = false;
    console.log('Performance monitoring stopped');
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      loadTime: 0,
      renderTime: 0,
      toolLoadTimes: new Map(),
      memoryUsage: [],
      fps: [],
      interactions: []
    };
    this.marks.clear();
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export class for testing
export { PerformanceMonitor };
