/**
 * DevChef V2.6 - Onboarding & Help System
 * Interactive tour, contextual help, and user guidance
 */

class OnboardingManager {
  constructor() {
    this.tourSteps = [];
    this.currentStep = 0;
    this.tourActive = false;
    this.hasCompletedTour = false;
    this.tooltips = new Map();
    this.helpTopics = new Map();
    this.initializeTour();
    this.loadProgress();
  }

  /**
   * Initialize tour steps
   */
  initializeTour() {
    this.tourSteps = [
      {
        id: 'welcome',
        title: 'Welcome to DevChef V2.6! 🎉',
        content: `
          <p>DevChef is the most powerful offline-first developer productivity platform.</p>
          <p>Let's take a quick tour of the revolutionary features!</p>
        `,
        target: null,
        position: 'center'
      },
      {
        id: 'tools',
        title: 'Developer Tools 🛠️',
        content: `
          <p>Browse 31+ built-in tools in the sidebar.</p>
          <p>Click any tool to get started, or use Ctrl+K to search.</p>
        `,
        target: '#tool-list',
        position: 'right'
      },
      {
        id: 'search',
        title: 'Smart Search 🔍',
        content: `
          <p>Use fuzzy search to find tools instantly.</p>
          <p>Press Ctrl+F or just start typing in the search box.</p>
        `,
        target: '#tool-search',
        position: 'bottom'
      },
      {
        id: 'favorites',
        title: 'Favorites System ⭐',
        content: `
          <p>Right-click any tool to add it to favorites.</p>
          <p>Favorited tools appear at the top and get priority in search.</p>
        `,
        target: '#tool-list',
        position: 'right'
      },
      {
        id: 'quick-actions',
        title: 'Quick Actions ⚡',
        content: `
          <p>Press Ctrl+Space for lightning-fast workflows!</p>
          <p>Access common actions like creating snippets, running pipelines, and viewing insights.</p>
        `,
        target: null,
        position: 'center',
        demo: 'Ctrl+Space'
      },
      {
        id: 'snippets',
        title: 'Snippet Library 📚',
        content: `
          <p>Save and organize code snippets with Ctrl+B.</p>
          <p>Tag, search, and reuse your most common code patterns.</p>
        `,
        target: null,
        position: 'center',
        demo: 'Ctrl+B'
      },
      {
        id: 'insights',
        title: 'Productivity Insights 📊',
        content: `
          <p>Track your productivity with Ctrl+I.</p>
          <p>See usage patterns, get recommendations, and optimize your workflow.</p>
        `,
        target: null,
        position: 'center',
        demo: 'Ctrl+I'
      },
      {
        id: 'pipelines',
        title: 'Tool Pipelines 🔗',
        content: `
          <p>Chain tools together with Ctrl+P.</p>
          <p>Automate multi-step workflows like "Decode Base64 → Format JSON".</p>
        `,
        target: null,
        position: 'center',
        demo: 'Ctrl+P'
      },
      {
        id: 'workspaces',
        title: 'Multi-Panel Workspaces 🖥️',
        content: `
          <p>Split your workspace with Ctrl+W.</p>
          <p>Work with multiple tools side-by-side in horizontal, vertical, or grid layouts.</p>
        `,
        target: null,
        position: 'center',
        demo: 'Ctrl+W'
      },
      {
        id: 'clipboard',
        title: 'Smart Clipboard Detection 📋',
        content: `
          <p>DevChef automatically detects what you copy!</p>
          <p>Paste JSON, JWTs, Base64, SQL, and more - we'll suggest the right tools.</p>
        `,
        target: null,
        position: 'center'
      },
      {
        id: 'settings',
        title: 'Settings & Backup 💾',
        content: `
          <p>Press Ctrl+, to access settings.</p>
          <p>Export/import your data, manage backups, and customize DevChef.</p>
        `,
        target: null,
        position: 'center',
        demo: 'Ctrl+,'
      },
      {
        id: 'complete',
        title: 'You\'re All Set! 🚀',
        content: `
          <p>You now know all the key features!</p>
          <p>Press <kbd>?</kbd> anytime to see keyboard shortcuts.</p>
          <p>Happy coding! 💻</p>
        `,
        target: null,
        position: 'center'
      }
    ];
  }

  /**
   * Load progress from storage
   */
  loadProgress() {
    try {
      const completed = localStorage.getItem('devchef-tour-completed');
      this.hasCompletedTour = completed === 'true';
    } catch (e) {
      console.warn('Could not load tour progress:', e);
    }
  }

  /**
   * Save progress to storage
   */
  saveProgress() {
    try {
      localStorage.setItem('devchef-tour-completed', 'true');
    } catch (e) {
      console.warn('Could not save tour progress:', e);
    }
  }

  /**
   * Start the onboarding tour
   */
  startTour() {
    if (this.tourActive) return;

    this.tourActive = true;
    this.currentStep = 0;
    this.showStep(0);
  }

  /**
   * Show specific tour step
   */
  showStep(index) {
    if (index < 0 || index >= this.tourSteps.length) return;

    this.currentStep = index;
    const step = this.tourSteps[index];

    // Create tour overlay
    this.createTourOverlay(step);
  }

  /**
   * Create tour overlay UI
   */
  createTourOverlay(step) {
    // Remove existing overlay
    this.removeTourOverlay();

    // Create overlay backdrop
    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.innerHTML = `
      <div class="onboarding-spotlight ${step.position}">
        <div class="onboarding-card">
          <div class="onboarding-header">
            <h3>${step.title}</h3>
            <button class="onboarding-close" title="Skip tour">×</button>
          </div>
          <div class="onboarding-content">
            ${step.content}
            ${step.demo ? `<div class="onboarding-demo"><kbd>${step.demo}</kbd></div>` : ''}
          </div>
          <div class="onboarding-footer">
            <div class="onboarding-progress">
              ${this.currentStep + 1} / ${this.tourSteps.length}
            </div>
            <div class="onboarding-actions">
              ${this.currentStep > 0 ? '<button class="onboarding-btn-prev">← Previous</button>' : ''}
              ${this.currentStep < this.tourSteps.length - 1
                ? '<button class="onboarding-btn-next">Next →</button>'
                : '<button class="onboarding-btn-finish">Finish 🎉</button>'}
            </div>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    const closeBtn = overlay.querySelector('.onboarding-close');
    const prevBtn = overlay.querySelector('.onboarding-btn-prev');
    const nextBtn = overlay.querySelector('.onboarding-btn-next');
    const finishBtn = overlay.querySelector('.onboarding-btn-finish');

    if (closeBtn) closeBtn.addEventListener('click', () => this.skipTour());
    if (prevBtn) prevBtn.addEventListener('click', () => this.previousStep());
    if (nextBtn) nextBtn.addEventListener('click', () => this.nextStep());
    if (finishBtn) finishBtn.addEventListener('click', () => this.completeTour());

    // Highlight target element if specified
    if (step.target) {
      const target = document.querySelector(step.target);
      if (target) {
        target.classList.add('onboarding-highlight');
      }
    }

    document.body.appendChild(overlay);
  }

  /**
   * Remove tour overlay
   */
  removeTourOverlay() {
    const existing = document.querySelector('.onboarding-overlay');
    if (existing) {
      existing.remove();
    }

    // Remove highlights
    document.querySelectorAll('.onboarding-highlight').forEach(el => {
      el.classList.remove('onboarding-highlight');
    });
  }

  /**
   * Next step
   */
  nextStep() {
    if (this.currentStep < this.tourSteps.length - 1) {
      this.showStep(this.currentStep + 1);
    }
  }

  /**
   * Previous step
   */
  previousStep() {
    if (this.currentStep > 0) {
      this.showStep(this.currentStep - 1);
    }
  }

  /**
   * Skip tour
   */
  skipTour() {
    this.tourActive = false;
    this.removeTourOverlay();
  }

  /**
   * Complete tour
   */
  completeTour() {
    this.tourActive = false;
    this.hasCompletedTour = true;
    this.saveProgress();
    this.removeTourOverlay();

    if (window.DevChef?.notifications) {
      window.DevChef.notifications.success('Tour complete! Press ? anytime for help.', {
        duration: 3000
      });
    }
  }

  /**
   * Reset tour progress
   */
  resetTour() {
    this.hasCompletedTour = false;
    try {
      localStorage.removeItem('devchef-tour-completed');
    } catch (e) {
      console.warn('Could not reset tour:', e);
    }
  }

  /**
   * Register tooltip
   */
  registerTooltip(element, content, position = 'top') {
    const id = `tooltip-${this.tooltips.size}`;
    this.tooltips.set(id, { element, content, position });

    // Add hover listeners
    element.addEventListener('mouseenter', () => this.showTooltip(id));
    element.addEventListener('mouseleave', () => this.hideTooltip(id));

    return id;
  }

  /**
   * Show tooltip
   */
  showTooltip(id) {
    const tooltip = this.tooltips.get(id);
    if (!tooltip) return;

    const div = document.createElement('div');
    div.className = `tooltip tooltip-${tooltip.position}`;
    div.id = id;
    div.textContent = tooltip.content;

    document.body.appendChild(div);

    // Position tooltip
    const rect = tooltip.element.getBoundingClientRect();
    const tooltipRect = div.getBoundingClientRect();

    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    let top = rect.top - tooltipRect.height - 8;

    if (tooltip.position === 'bottom') {
      top = rect.bottom + 8;
    } else if (tooltip.position === 'left') {
      left = rect.left - tooltipRect.width - 8;
      top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
    } else if (tooltip.position === 'right') {
      left = rect.right + 8;
      top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
    }

    div.style.left = `${left}px`;
    div.style.top = `${top}px`;
  }

  /**
   * Hide tooltip
   */
  hideTooltip(id) {
    const tooltip = document.getElementById(id);
    if (tooltip) {
      tooltip.remove();
    }
  }

  /**
   * Register help topic
   */
  registerHelp(topic, title, content) {
    this.helpTopics.set(topic, { title, content });
  }

  /**
   * Show help for topic
   */
  showHelp(topic) {
    const help = this.helpTopics.get(topic);
    if (!help) return;

    if (window.DevChef?.notifications) {
      window.DevChef.notifications.show(help.content, {
        title: help.title,
        duration: 0, // Manual dismiss
        type: 'info'
      });
    }
  }

  /**
   * Check if user should see tour
   */
  shouldShowTour() {
    return !this.hasCompletedTour;
  }
}

// Create singleton instance
export const onboarding = new OnboardingManager();

// Export class for testing
export { OnboardingManager };
