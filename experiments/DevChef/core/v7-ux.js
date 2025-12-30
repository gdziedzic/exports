/**
 * DevChef V7 - UX Excellence Module
 * Flawless interactions, smooth animations, and delightful user experience
 */

class V7UX {
  constructor() {
    this.initialized = false;
    this.observers = new Map();
    this.activeTooltips = new Set();
    this.feedbackQueue = [];
  }

  /**
   * Initialize V7 UX enhancements
   */
  async init() {
    if (this.initialized) return;

    console.log('✨ Initializing V7 UX Excellence...');

    // Initialize all V7 features
    this.initSmartTooltips();
    this.initContextualHelp();
    this.initHapticFeedback();
    this.initSmartLoading();
    this.initAccessibility();
    this.initPerformanceOptimizations();

    this.initialized = true;
    console.log('✅ V7 UX Excellence initialized');
  }

  /**
   * Smart Tooltips System
   * Automatically adds helpful tooltips to interactive elements
   */
  initSmartTooltips() {
    // Add tooltips to elements that don't have them
    const addTooltipToElement = (element, text) => {
      if (!element.hasAttribute('data-tooltip') && !element.hasAttribute('title')) {
        element.classList.add('v7-tooltip');
        element.setAttribute('data-tooltip', text);
      }
    };

    // Observe DOM for new elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            this.enhanceElement(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.set('tooltips', observer);

    // Enhance existing elements
    document.querySelectorAll('button, .tool-item, .action-btn').forEach(el => {
      this.enhanceElement(el);
    });
  }

  /**
   * Enhance element with V7 UX features
   */
  enhanceElement(element) {
    // Add ripple effect class
    if (element.tagName === 'BUTTON' && !element.classList.contains('v7-enhanced')) {
      element.classList.add('v7-enhanced');
    }

    // Add tooltip if has title attribute
    if (element.hasAttribute('title') && !element.classList.contains('v7-tooltip')) {
      const title = element.getAttribute('title');
      element.setAttribute('data-tooltip', title);
      element.removeAttribute('title');
      element.classList.add('v7-tooltip');
    }
  }

  /**
   * Contextual Help System
   * Provides smart, context-aware help
   */
  initContextualHelp() {
    // Add keyboard shortcut hints
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        this.showKeyboardHints();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (!e.ctrlKey && !e.metaKey) {
        this.hideKeyboardHints();
      }
    });
  }

  /**
   * Show keyboard shortcut hints
   */
  showKeyboardHints() {
    const elements = document.querySelectorAll('[data-shortcut]');
    elements.forEach(el => {
      const hint = document.createElement('span');
      hint.className = 'v7-shortcut-hint';
      hint.textContent = el.getAttribute('data-shortcut');
      hint.style.cssText = `
        position: absolute;
        top: -8px;
        right: -8px;
        background: var(--accent);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: bold;
        z-index: 1000;
        animation: fadeInScale 0.2s ease-out;
      `;
      el.style.position = 'relative';
      el.appendChild(hint);
    });
  }

  /**
   * Hide keyboard shortcut hints
   */
  hideKeyboardHints() {
    document.querySelectorAll('.v7-shortcut-hint').forEach(hint => {
      hint.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(() => hint.remove(), 200);
    });
  }

  /**
   * Haptic Feedback Simulation
   * Visual feedback for interactions
   */
  initHapticFeedback() {
    // Add feedback to button clicks
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button, .action-btn');
      if (button) {
        this.triggerFeedback(button, 'click');
      }
    }, true);
  }

  /**
   * Trigger visual feedback
   */
  triggerFeedback(element, type = 'click') {
    switch (type) {
      case 'click':
        element.classList.add('v7-feedback-click');
        setTimeout(() => element.classList.remove('v7-feedback-click'), 300);
        break;
      case 'success':
        element.classList.add('v7-success');
        setTimeout(() => element.classList.remove('v7-success'), 500);
        break;
      case 'error':
        element.classList.add('v7-error');
        setTimeout(() => element.classList.remove('v7-error'), 500);
        break;
    }
  }

  /**
   * Smart Loading States
   * Beautiful loading indicators
   */
  initSmartLoading() {
    // Replace loading spinners with skeleton screens
    this.enhanceLoadingStates();
  }

  /**
   * Create skeleton loader
   */
  createSkeleton(type = 'text', count = 1) {
    const container = document.createElement('div');
    container.className = 'v7-skeleton-container';

    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'v7-skeleton';

      switch (type) {
        case 'text':
          skeleton.style.cssText = 'height: 16px; width: 100%; margin-bottom: 8px;';
          break;
        case 'title':
          skeleton.style.cssText = 'height: 24px; width: 60%; margin-bottom: 12px;';
          break;
        case 'card':
          skeleton.style.cssText = 'height: 120px; width: 100%; margin-bottom: 16px; border-radius: 8px;';
          break;
      }

      container.appendChild(skeleton);
    }

    return container;
  }

  /**
   * Enhance loading states
   */
  enhanceLoadingStates() {
    // Monitor for loading indicators and enhance them
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1 && node.classList.contains('loading')) {
            this.enhanceLoadingIndicator(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.set('loading', observer);
  }

  /**
   * Enhance loading indicator
   */
  enhanceLoadingIndicator(element) {
    if (element.classList.contains('v7-enhanced-loading')) return;
    element.classList.add('v7-enhanced-loading', 'v7-skeleton');
  }

  /**
   * Accessibility Enhancements
   */
  initAccessibility() {
    // Add ARIA labels where missing
    this.enhanceAccessibility();

    // Monitor focus for better visual feedback
    document.addEventListener('focusin', (e) => {
      if (e.target.matches('button, input, textarea, select, a')) {
        e.target.classList.add('v7-focused');
      }
    });

    document.addEventListener('focusout', (e) => {
      e.target.classList.remove('v7-focused');
    });
  }

  /**
   * Enhance accessibility
   */
  enhanceAccessibility() {
    // Add ARIA labels to buttons without text
    document.querySelectorAll('button:not([aria-label])').forEach(button => {
      const text = button.textContent.trim();
      const title = button.getAttribute('title');
      const tooltip = button.getAttribute('data-tooltip');

      if (!text && (title || tooltip)) {
        button.setAttribute('aria-label', title || tooltip);
      }
    });

    // Ensure keyboard navigation
    document.querySelectorAll('.clickable:not([tabindex])').forEach(el => {
      el.setAttribute('tabindex', '0');
    });
  }

  /**
   * Performance Optimizations
   */
  initPerformanceOptimizations() {
    // Add will-change hints to animated elements
    this.optimizeAnimations();

    // Lazy load images
    this.initLazyLoading();

    // Debounce scroll events
    this.optimizeScrollEvents();
  }

  /**
   * Optimize animations
   */
  optimizeAnimations() {
    document.querySelectorAll('.tool-item, .modal, .notification').forEach(el => {
      el.classList.add('v7-will-change');
    });
  }

  /**
   * Initialize lazy loading
   */
  initLazyLoading() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              imageObserver.unobserve(img);
            }
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });

      this.observers.set('images', imageObserver);
    }
  }

  /**
   * Optimize scroll events
   */
  optimizeScrollEvents() {
    let scrollTimeout;
    document.addEventListener('scroll', () => {
      document.body.classList.add('is-scrolling');

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        document.body.classList.remove('is-scrolling');
      }, 150);
    }, { passive: true });
  }

  /**
   * Show delightful success message
   */
  showSuccess(message, duration = 3000) {
    const notification = this.createNotification(message, 'success');
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  /**
   * Show delightful error message
   */
  showError(message, duration = 4000) {
    const notification = this.createNotification(message, 'error');
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  /**
   * Create notification element
   */
  createNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `v7-notification ${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      max-width: 400px;
      padding: 16px 20px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: var(--shadow-md);
      z-index: 10000;
      animation: slideInRight 0.3s ease-out;
    `;

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 20px;">${icon}</span>
        <span style="flex: 1; color: var(--text-primary);">${message}</span>
      </div>
    `;

    return notification;
  }

  /**
   * Add smooth page transitions
   */
  addPageTransition(callback) {
    document.body.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => {
      callback();
      document.body.style.animation = 'fadeIn 0.3s ease-out';
    }, 300);
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.activeTooltips.clear();
    this.initialized = false;
  }
}

// Export singleton instance
export const v7UX = new V7UX();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => v7UX.init());
} else {
  v7UX.init();
}
