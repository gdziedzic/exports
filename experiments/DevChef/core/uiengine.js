/**
 * UI Engine - V6
 * Modern, responsive UI system with smooth animations and transitions
 *
 * Features:
 * - Smooth page transitions and animations
 * - Responsive layout management
 * - Component-based UI system
 * - Gesture support (swipe, pinch, etc.)
 * - Accessibility features (ARIA, keyboard navigation)
 * - Toast notifications with queue management
 * - Modal system with backdrop
 * - Loading states and skeletons
 * - Micro-interactions and feedback
 */

class UIEngine {
  constructor() {
    this.components = new Map();
    this.animations = new Map();
    this.transitions = new Map();
    this.toastQueue = [];
    this.modals = new Map();
    this.theme = 'dark';
    this.reducedMotion = false;
    this.touchSupport = 'ontouchstart' in window;
    this.init();
  }

  /**
   * Initialize UI Engine
   */
  init() {
    try {
      this.detectUserPreferences();
      this.setupAnimationFramework();
      this.setupGestureHandlers();
      this.setupAccessibility();
      this.createUIComponents();
      this.setupResponsiveListeners();
      console.log('🎨 UI Engine initialized - Smooth, Modern, Responsive');
    } catch (error) {
      console.error('Error initializing UI Engine:', error);
    }
  }

  /**
   * Detect user preferences (reduced motion, theme, etc.)
   */
  detectUserPreferences() {
    try {
      // Detect reduced motion preference
      const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = reducedMotionQuery.matches;

      reducedMotionQuery.addEventListener('change', (e) => {
        this.reducedMotion = e.matches;
        this.updateAnimationSettings();
      });

      // Detect color scheme preference
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (darkModeQuery.matches) {
        this.theme = 'dark';
      } else {
        this.theme = 'light';
      }

      darkModeQuery.addEventListener('change', (e) => {
        this.theme = e.matches ? 'dark' : 'light';
        this.applyTheme();
      });
    } catch (error) {
      console.error('Error detecting user preferences:', error);
    }
  }

  /**
   * Setup animation framework
   */
  setupAnimationFramework() {
    try {
      // Define animation presets
      this.animations.set('fadeIn', {
        keyframes: [
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        options: { duration: 300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }
      });

      this.animations.set('fadeOut', {
        keyframes: [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(-10px)' }
        ],
        options: { duration: 200, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }
      });

      this.animations.set('slideInRight', {
        keyframes: [
          { transform: 'translateX(100%)', opacity: 0 },
          { transform: 'translateX(0)', opacity: 1 }
        ],
        options: { duration: 400, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
      });

      this.animations.set('slideInLeft', {
        keyframes: [
          { transform: 'translateX(-100%)', opacity: 0 },
          { transform: 'translateX(0)', opacity: 1 }
        ],
        options: { duration: 400, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
      });

      this.animations.set('scaleUp', {
        keyframes: [
          { transform: 'scale(0.9)', opacity: 0 },
          { transform: 'scale(1)', opacity: 1 }
        ],
        options: { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
      });

      this.animations.set('bounce', {
        keyframes: [
          { transform: 'translateY(0)' },
          { transform: 'translateY(-10px)' },
          { transform: 'translateY(0)' }
        ],
        options: { duration: 500, easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' }
      });

      this.animations.set('pulse', {
        keyframes: [
          { transform: 'scale(1)' },
          { transform: 'scale(1.05)' },
          { transform: 'scale(1)' }
        ],
        options: { duration: 600, easing: 'ease-in-out' }
      });
    } catch (error) {
      console.error('Error setting up animation framework:', error);
    }
  }

  /**
   * Animate element with preset or custom animation
   */
  animate(element, animationName, options = {}) {
    if (!element) return Promise.resolve();

    try {
      // Skip animations if reduced motion is enabled
      if (this.reducedMotion && !options.force) {
        return Promise.resolve();
      }

      const animation = this.animations.get(animationName);
      if (!animation) {
        console.warn(`Animation "${animationName}" not found`);
        return Promise.resolve();
      }

      const { keyframes, options: animOptions } = animation;
      const mergedOptions = { ...animOptions, ...options };

      const anim = element.animate(keyframes, mergedOptions);
      return anim.finished;
    } catch (error) {
      console.error('Error animating element:', error);
      return Promise.resolve();
    }
  }

  /**
   * Setup gesture handlers (swipe, pinch, etc.)
   */
  setupGestureHandlers() {
    if (!this.touchSupport) return;

    try {
      let touchStartX = 0;
      let touchStartY = 0;
      let touchEndX = 0;
      let touchEndY = 0;

      document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        this.handleGesture(touchStartX, touchStartY, touchEndX, touchEndY, e.target);
      }, { passive: true });
    } catch (error) {
      console.error('Error setting up gesture handlers:', error);
    }
  }

  /**
   * Handle gesture (swipe direction detection)
   */
  handleGesture(startX, startY, endX, endY, target) {
    try {
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const threshold = 50;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (Math.abs(deltaX) > threshold) {
          const direction = deltaX > 0 ? 'swipe-right' : 'swipe-left';
          this.dispatchGestureEvent(direction, target);
        }
      } else {
        if (Math.abs(deltaY) > threshold) {
          const direction = deltaY > 0 ? 'swipe-down' : 'swipe-up';
          this.dispatchGestureEvent(direction, target);
        }
      }
    } catch (error) {
      console.error('Error handling gesture:', error);
    }
  }

  /**
   * Dispatch custom gesture event
   */
  dispatchGestureEvent(direction, target) {
    try {
      const event = new CustomEvent('gesture', {
        detail: { direction },
        bubbles: true
      });
      target.dispatchEvent(event);
    } catch (error) {
      console.error('Error dispatching gesture event:', error);
    }
  }

  /**
   * Setup accessibility features
   */
  setupAccessibility() {
    try {
      // Enable keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeTopModal();
        }

        if (e.key === 'Tab') {
          this.highlightFocusedElement();
        }
      });

      // Add skip to content link
      this.addSkipToContent();

      // Ensure proper focus management
      this.setupFocusManagement();
    } catch (error) {
      console.error('Error setting up accessibility:', error);
    }
  }

  /**
   * Add skip to content link for screen readers
   */
  addSkipToContent() {
    try {
      const skip = document.createElement('a');
      skip.href = '#main-content';
      skip.className = 'skip-to-content';
      skip.textContent = 'Skip to main content';
      skip.style.cssText = `
        position: absolute;
        left: -9999px;
        z-index: 999999;
        padding: 1em;
        background: var(--primary-color);
        color: white;
        text-decoration: none;
      `;
      skip.addEventListener('focus', () => {
        skip.style.left = '0';
      });
      skip.addEventListener('blur', () => {
        skip.style.left = '-9999px';
      });
      document.body.insertBefore(skip, document.body.firstChild);
    } catch (error) {
      console.error('Error adding skip to content:', error);
    }
  }

  /**
   * Setup focus management
   */
  setupFocusManagement() {
    try {
      this.focusTrap = null;
      this.lastFocusedElement = null;
    } catch (error) {
      console.error('Error setting up focus management:', error);
    }
  }

  /**
   * Highlight focused element for keyboard users
   */
  highlightFocusedElement() {
    try {
      document.body.classList.add('keyboard-nav');

      // Remove on mouse click
      document.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-nav');
      }, { once: true });
    } catch (error) {
      console.error('Error highlighting focused element:', error);
    }
  }

  /**
   * Create UI components
   */
  createUIComponents() {
    try {
      this.createToastContainer();
      this.createLoadingOverlay();
      this.createModalBackdrop();
    } catch (error) {
      console.error('Error creating UI components:', error);
    }
  }

  /**
   * Create toast notification container
   */
  createToastContainer() {
    try {
      const container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
      this.components.set('toast-container', container);
    } catch (error) {
      console.error('Error creating toast container:', error);
    }
  }

  /**
   * Show toast notification
   */
  showToast(message, options = {}) {
    try {
      const {
        type = 'info', // info, success, warning, error
        duration = 4000,
        action = null,
        icon = null
      } = options;

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.setAttribute('role', 'alert');

      const iconMap = {
        info: 'ℹ️',
        success: '✓',
        warning: '⚠️',
        error: '✗'
      };

      const displayIcon = icon || iconMap[type] || '📢';

      toast.innerHTML = `
        <div class="toast-icon">${displayIcon}</div>
        <div class="toast-message">${message}</div>
        ${action ? `<button class="toast-action">${action.text}</button>` : ''}
        <button class="toast-close" aria-label="Close">×</button>
      `;

      const container = this.components.get('toast-container');
      if (!container) return;

      container.appendChild(toast);

      // Animate in
      this.animate(toast, 'slideInRight');

      // Setup action button
      if (action) {
        const actionBtn = toast.querySelector('.toast-action');
        actionBtn.addEventListener('click', () => {
          action.handler();
          this.closeToast(toast);
        });
      }

      // Setup close button
      const closeBtn = toast.querySelector('.toast-close');
      closeBtn.addEventListener('click', () => {
        this.closeToast(toast);
      });

      // Auto-close after duration
      if (duration > 0) {
        setTimeout(() => {
          if (toast.parentElement) {
            this.closeToast(toast);
          }
        }, duration);
      }

      return toast;
    } catch (error) {
      console.error('Error showing toast:', error);
    }
  }

  /**
   * Close toast notification
   */
  async closeToast(toast) {
    try {
      await this.animate(toast, 'fadeOut');
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    } catch (error) {
      console.error('Error closing toast:', error);
    }
  }

  /**
   * Create loading overlay
   */
  createLoadingOverlay() {
    try {
      const overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.style.display = 'none';
      overlay.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <div class="loading-text">Loading...</div>
        </div>
      `;
      document.body.appendChild(overlay);
      this.components.set('loading-overlay', overlay);
    } catch (error) {
      console.error('Error creating loading overlay:', error);
    }
  }

  /**
   * Show loading overlay
   */
  async showLoading(message = 'Loading...') {
    try {
      const overlay = this.components.get('loading-overlay');
      if (!overlay) return;

      const textEl = overlay.querySelector('.loading-text');
      if (textEl) {
        textEl.textContent = message;
      }

      overlay.style.display = 'flex';
      await this.animate(overlay, 'fadeIn');
    } catch (error) {
      console.error('Error showing loading:', error);
    }
  }

  /**
   * Hide loading overlay
   */
  async hideLoading() {
    try {
      const overlay = this.components.get('loading-overlay');
      if (!overlay) return;

      await this.animate(overlay, 'fadeOut');
      overlay.style.display = 'none';
    } catch (error) {
      console.error('Error hiding loading:', error);
    }
  }

  /**
   * Create modal backdrop
   */
  createModalBackdrop() {
    try {
      const backdrop = document.createElement('div');
      backdrop.id = 'modal-backdrop';
      backdrop.className = 'modal-backdrop';
      backdrop.style.display = 'none';
      backdrop.addEventListener('click', () => {
        this.closeTopModal();
      });
      document.body.appendChild(backdrop);
      this.components.set('modal-backdrop', backdrop);
    } catch (error) {
      console.error('Error creating modal backdrop:', error);
    }
  }

  /**
   * Show modal
   */
  async showModal(content, options = {}) {
    try {
      const {
        title = '',
        closeButton = true,
        backdrop = true,
        size = 'medium', // small, medium, large
        className = ''
      } = options;

      const modalId = `modal-${Date.now()}`;
      const modal = document.createElement('div');
      modal.id = modalId;
      modal.className = `modal modal-${size} ${className}`;
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');

      if (title) {
        modal.setAttribute('aria-labelledby', `${modalId}-title`);
      }

      modal.innerHTML = `
        <div class="modal-content">
          ${title ? `<div class="modal-header">
            <h2 id="${modalId}-title">${title}</h2>
            ${closeButton ? '<button class="modal-close" aria-label="Close">×</button>' : ''}
          </div>` : ''}
          <div class="modal-body">
            ${typeof content === 'string' ? content : ''}
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      if (typeof content !== 'string') {
        modal.querySelector('.modal-body').appendChild(content);
      }

      // Setup close button
      if (closeButton) {
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => {
            this.closeModal(modalId);
          });
        }
      }

      // Show backdrop
      if (backdrop) {
        const backdropEl = this.components.get('modal-backdrop');
        if (backdropEl) {
          backdropEl.style.display = 'block';
          await this.animate(backdropEl, 'fadeIn');
        }
      }

      // Animate modal
      await this.animate(modal, 'scaleUp');

      // Trap focus in modal
      this.trapFocus(modal);

      this.modals.set(modalId, modal);

      return modalId;
    } catch (error) {
      console.error('Error showing modal:', error);
    }
  }

  /**
   * Close modal
   */
  async closeModal(modalId) {
    try {
      const modal = this.modals.get(modalId);
      if (!modal) return;

      await this.animate(modal, 'fadeOut');

      if (modal.parentElement) {
        modal.parentElement.removeChild(modal);
      }

      this.modals.delete(modalId);

      // Hide backdrop if no more modals
      if (this.modals.size === 0) {
        const backdrop = this.components.get('modal-backdrop');
        if (backdrop) {
          await this.animate(backdrop, 'fadeOut');
          backdrop.style.display = 'none';
        }

        // Restore focus
        if (this.lastFocusedElement) {
          this.lastFocusedElement.focus();
        }
      }
    } catch (error) {
      console.error('Error closing modal:', error);
    }
  }

  /**
   * Close topmost modal
   */
  closeTopModal() {
    try {
      if (this.modals.size > 0) {
        const lastModalId = Array.from(this.modals.keys()).pop();
        this.closeModal(lastModalId);
      }
    } catch (error) {
      console.error('Error closing top modal:', error);
    }
  }

  /**
   * Trap focus within element
   */
  trapFocus(element) {
    try {
      this.lastFocusedElement = document.activeElement;

      const focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      firstFocusable.focus();

      const handleTabKey = (e) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      };

      element.addEventListener('keydown', handleTabKey);
    } catch (error) {
      console.error('Error trapping focus:', error);
    }
  }

  /**
   * Setup responsive listeners
   */
  setupResponsiveListeners() {
    try {
      // Listen for viewport changes
      window.addEventListener('resize', () => {
        this.handleResize();
      });

      // Listen for orientation changes
      window.addEventListener('orientationchange', () => {
        this.handleOrientationChange();
      });

      this.handleResize(); // Initial check
    } catch (error) {
      console.error('Error setting up responsive listeners:', error);
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    try {
      const width = window.innerWidth;

      let breakpoint = 'desktop';
      if (width < 768) {
        breakpoint = 'mobile';
      } else if (width < 1024) {
        breakpoint = 'tablet';
      }

      document.body.dataset.breakpoint = breakpoint;

      // Dispatch custom event
      const event = new CustomEvent('breakpoint-change', {
        detail: { breakpoint, width }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error handling resize:', error);
    }
  }

  /**
   * Handle orientation change
   */
  handleOrientationChange() {
    try {
      const orientation = window.orientation || 0;
      const mode = Math.abs(orientation) === 90 ? 'landscape' : 'portrait';

      document.body.dataset.orientation = mode;

      // Dispatch custom event
      const event = new CustomEvent('orientation-change', {
        detail: { orientation, mode }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error handling orientation change:', error);
    }
  }

  /**
   * Update animation settings based on user preference
   */
  updateAnimationSettings() {
    try {
      if (this.reducedMotion) {
        document.body.classList.add('reduced-motion');
      } else {
        document.body.classList.remove('reduced-motion');
      }
    } catch (error) {
      console.error('Error updating animation settings:', error);
    }
  }

  /**
   * Apply theme
   */
  applyTheme() {
    try {
      document.body.dataset.theme = this.theme;

      // Dispatch theme change event
      const event = new CustomEvent('theme-change', {
        detail: { theme: this.theme }
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  }

  /**
   * Create skeleton loader
   */
  createSkeleton(config = {}) {
    try {
      const {
        lines = 3,
        avatar = false,
        width = '100%'
      } = config;

      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton-loader';
      skeleton.style.width = width;

      if (avatar) {
        skeleton.innerHTML += '<div class="skeleton-avatar"></div>';
      }

      for (let i = 0; i < lines; i++) {
        const line = document.createElement('div');
        line.className = 'skeleton-line';
        if (i === lines - 1) {
          line.style.width = '70%';
        }
        skeleton.appendChild(line);
      }

      return skeleton;
    } catch (error) {
      console.error('Error creating skeleton:', error);
      return document.createElement('div');
    }
  }

  /**
   * Smooth scroll to element
   */
  scrollTo(element, options = {}) {
    try {
      const {
        behavior = 'smooth',
        block = 'start',
        inline = 'nearest',
        offset = 0
      } = options;

      if (typeof element === 'string') {
        element = document.querySelector(element);
      }

      if (!element) return;

      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: this.reducedMotion ? 'auto' : behavior
      });
    } catch (error) {
      console.error('Error scrolling to element:', error);
    }
  }
}

// Export singleton instance
export const uiEngine = new UIEngine();
