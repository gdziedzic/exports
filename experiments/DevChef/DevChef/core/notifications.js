/**
 * DevChef V2 Notifications System
 * Toast notifications and user feedback
 */

class NotificationManager {
  constructor() {
    this.container = null;
    this.notifications = [];
    this.maxNotifications = 5;
    this.defaultDuration = 3000;
    this.initialize();
  }

  /**
   * Initialize notification container
   */
  initialize() {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);
  }

  /**
   * Show a notification
   * @param {string} message - Notification message
   * @param {Object} options - Notification options
   * @returns {string} Notification ID
   */
  show(message, options = {}) {
    const {
      type = 'info', // 'info', 'success', 'warning', 'error'
      duration = this.defaultDuration,
      icon = null,
      action = null,
      persistent = false
    } = options;

    const id = `notification-${Date.now()}-${Math.random()}`;

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.dataset.id = id;

    const iconHtml = icon || this.getDefaultIcon(type);

    notification.innerHTML = `
      <div class="notification-icon">${iconHtml}</div>
      <div class="notification-content">
        <div class="notification-message">${this.escapeHtml(message)}</div>
        ${action ? `<button class="notification-action">${action.text}</button>` : ''}
      </div>
      <button class="notification-close" title="Close">✕</button>
    `;

    // Set up close button
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      this.dismiss(id);
    });

    // Set up action button if present
    if (action) {
      const actionBtn = notification.querySelector('.notification-action');
      actionBtn.addEventListener('click', () => {
        action.callback();
        this.dismiss(id);
      });
    }

    // Add to container
    this.container.appendChild(notification);

    // Trigger animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    // Store notification
    this.notifications.push({
      id,
      element: notification,
      type,
      message
    });

    // Limit number of notifications
    if (this.notifications.length > this.maxNotifications) {
      const oldest = this.notifications[0];
      this.dismiss(oldest.id);
    }

    // Auto-dismiss if not persistent
    if (!persistent && duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  /**
   * Show info notification
   * @param {string} message - Message
   * @param {Object} options - Options
   * @returns {string} Notification ID
   */
  info(message, options = {}) {
    return this.show(message, { ...options, type: 'info' });
  }

  /**
   * Show success notification
   * @param {string} message - Message
   * @param {Object} options - Options
   * @returns {string} Notification ID
   */
  success(message, options = {}) {
    return this.show(message, { ...options, type: 'success' });
  }

  /**
   * Show warning notification
   * @param {string} message - Message
   * @param {Object} options - Options
   * @returns {string} Notification ID
   */
  warning(message, options = {}) {
    return this.show(message, { ...options, type: 'warning' });
  }

  /**
   * Show error notification
   * @param {string} message - Message
   * @param {Object} options - Options
   * @returns {string} Notification ID
   */
  error(message, options = {}) {
    return this.show(message, { ...options, type: 'error', duration: 5000 });
  }

  /**
   * Dismiss notification
   * @param {string} id - Notification ID
   */
  dismiss(id) {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index === -1) return;

    const notification = this.notifications[index];
    notification.element.classList.remove('show');
    notification.element.classList.add('hide');

    setTimeout(() => {
      notification.element.remove();
      this.notifications.splice(index, 1);
    }, 300);
  }

  /**
   * Dismiss all notifications
   */
  dismissAll() {
    [...this.notifications].forEach(n => {
      this.dismiss(n.id);
    });
  }

  /**
   * Get default icon for notification type
   * @param {string} type - Notification type
   * @returns {string} Icon HTML
   */
  getDefaultIcon(type) {
    const icons = {
      info: 'ℹ️',
      success: '✓',
      warning: '⚠️',
      error: '✕'
    };
    return icons[type] || icons.info;
  }

  /**
   * Escape HTML for safe display
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show confirmation dialog
   * @param {string} message - Message
   * @param {Object} options - Options
   * @returns {Promise<boolean>} User confirmation
   */
  confirm(message, options = {}) {
    const {
      title = 'Confirm',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      type = 'info'
    } = options;

    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'notification-dialog';
      dialog.innerHTML = `
        <div class="notification-dialog-overlay"></div>
        <div class="notification-dialog-content">
          <div class="notification-dialog-header">
            <h3>${this.escapeHtml(title)}</h3>
          </div>
          <div class="notification-dialog-body">
            <p>${this.escapeHtml(message)}</p>
          </div>
          <div class="notification-dialog-actions">
            <button class="btn-secondary" data-action="cancel">${cancelText}</button>
            <button class="btn-primary" data-action="confirm">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      // Trigger animation
      setTimeout(() => {
        dialog.classList.add('show');
      }, 10);

      const closeDialog = (confirmed) => {
        dialog.classList.remove('show');
        setTimeout(() => {
          dialog.remove();
          resolve(confirmed);
        }, 200);
      };

      // Set up button handlers
      dialog.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        closeDialog(true);
      });

      dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        closeDialog(false);
      });

      dialog.querySelector('.notification-dialog-overlay').addEventListener('click', () => {
        closeDialog(false);
      });

      // ESC key to cancel
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          closeDialog(false);
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);
    });
  }

  /**
   * Show prompt dialog
   * @param {string} message - Message
   * @param {Object} options - Options
   * @returns {Promise<string|null>} User input or null
   */
  prompt(message, options = {}) {
    const {
      title = 'Input',
      defaultValue = '',
      placeholder = '',
      confirmText = 'OK',
      cancelText = 'Cancel'
    } = options;

    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'notification-dialog';
      dialog.innerHTML = `
        <div class="notification-dialog-overlay"></div>
        <div class="notification-dialog-content">
          <div class="notification-dialog-header">
            <h3>${this.escapeHtml(title)}</h3>
          </div>
          <div class="notification-dialog-body">
            <p>${this.escapeHtml(message)}</p>
            <input type="text" class="notification-dialog-input"
                   placeholder="${this.escapeHtml(placeholder)}"
                   value="${this.escapeHtml(defaultValue)}">
          </div>
          <div class="notification-dialog-actions">
            <button class="btn-secondary" data-action="cancel">${cancelText}</button>
            <button class="btn-primary" data-action="confirm">${confirmText}</button>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      const input = dialog.querySelector('.notification-dialog-input');

      // Trigger animation
      setTimeout(() => {
        dialog.classList.add('show');
        input.focus();
        input.select();
      }, 10);

      const closeDialog = (confirmed) => {
        const value = confirmed ? input.value : null;
        dialog.classList.remove('show');
        setTimeout(() => {
          dialog.remove();
          resolve(value);
        }, 200);
      };

      // Set up button handlers
      dialog.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        closeDialog(true);
      });

      dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        closeDialog(false);
      });

      dialog.querySelector('.notification-dialog-overlay').addEventListener('click', () => {
        closeDialog(false);
      });

      // Enter to confirm, ESC to cancel
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          closeDialog(true);
        } else if (e.key === 'Escape') {
          closeDialog(false);
        }
      });
    });
  }
}

// Create and export singleton
export const notifications = new NotificationManager();
