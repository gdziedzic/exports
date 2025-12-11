/**
 * DevChef V2.6 - Input Validation & Sanitization
 * Comprehensive validation for all user inputs
 */

class Validator {
  constructor() {
    this.validators = new Map();
    this.registerDefaultValidators();
  }

  /**
   * Register default validators
   */
  registerDefaultValidators() {
    // String validators
    this.register('required', (value) => {
      return value !== null && value !== undefined && value !== '';
    }, 'This field is required');

    this.register('minLength', (value, min) => {
      return !value || value.length >= min;
    }, (min) => `Must be at least ${min} characters`);

    this.register('maxLength', (value, max) => {
      return !value || value.length <= max;
    }, (max) => `Must be at most ${max} characters`);

    this.register('pattern', (value, pattern) => {
      if (!value) return true;
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      return regex.test(value);
    }, 'Invalid format');

    this.register('email', (value) => {
      if (!value) return true;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    }, 'Invalid email address');

    this.register('url', (value) => {
      if (!value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }, 'Invalid URL');

    // Number validators
    this.register('number', (value) => {
      return !value || !isNaN(parseFloat(value));
    }, 'Must be a number');

    this.register('integer', (value) => {
      return !value || Number.isInteger(Number(value));
    }, 'Must be an integer');

    this.register('min', (value, min) => {
      return !value || Number(value) >= min;
    }, (min) => `Must be at least ${min}`);

    this.register('max', (value, max) => {
      return !value || Number(value) <= max;
    }, (max) => `Must be at most ${max}`);

    this.register('range', (value, min, max) => {
      if (!value) return true;
      const num = Number(value);
      return num >= min && num <= max;
    }, (min, max) => `Must be between ${min} and ${max}`);

    // JSON validator
    this.register('json', (value) => {
      if (!value) return true;
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    }, 'Invalid JSON');

    // Array validators
    this.register('minItems', (value, min) => {
      return !Array.isArray(value) || value.length >= min;
    }, (min) => `Must have at least ${min} items`);

    this.register('maxItems', (value, max) => {
      return !Array.isArray(value) || value.length <= max;
    }, (max) => `Must have at most ${max} items`);

    this.register('uniqueItems', (value) => {
      if (!Array.isArray(value)) return true;
      return new Set(value).size === value.length;
    }, 'All items must be unique');

    // Custom validators
    this.register('noScripts', (value) => {
      if (!value) return true;
      const scriptRegex = /<script[^>]*>.*?<\/script>/gi;
      return !scriptRegex.test(value);
    }, 'Scripts are not allowed');

    this.register('safeHTML', (value) => {
      if (!value) return true;
      const dangerousRegex = /<(script|iframe|object|embed|link)[^>]*>/gi;
      return !dangerousRegex.test(value);
    }, 'Potentially unsafe HTML detected');
  }

  /**
   * Register custom validator
   */
  register(name, fn, message) {
    this.validators.set(name, { fn, message });
  }

  /**
   * Validate value against rules
   */
  validate(value, rules) {
    const errors = [];

    for (const [name, params] of Object.entries(rules)) {
      const validator = this.validators.get(name);
      if (!validator) {
        console.warn(`Unknown validator: ${name}`);
        continue;
      }

      const args = Array.isArray(params) ? params : [params];
      const isValid = validator.fn(value, ...args);

      if (!isValid) {
        const message = typeof validator.message === 'function'
          ? validator.message(...args)
          : validator.message;
        errors.push({ rule: name, message });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate object against schema
   */
  validateObject(obj, schema) {
    const errors = {};
    let valid = true;

    for (const [field, rules] of Object.entries(schema)) {
      const value = obj[field];
      const result = this.validate(value, rules);

      if (!result.valid) {
        errors[field] = result.errors;
        valid = false;
      }
    }

    return { valid, errors };
  }

  /**
   * Sanitize string
   */
  sanitize(value, options = {}) {
    if (typeof value !== 'string') return value;

    let result = value;

    // Trim whitespace
    if (options.trim !== false) {
      result = result.trim();
    }

    // Remove HTML tags
    if (options.stripHTML) {
      result = result.replace(/<[^>]*>/g, '');
    }

    // Escape HTML entities
    if (options.escapeHTML) {
      result = this.escapeHTML(result);
    }

    // Remove scripts
    if (options.noScripts) {
      result = result.replace(/<script[^>]*>.*?<\/script>/gi, '');
    }

    // Normalize whitespace
    if (options.normalizeWhitespace) {
      result = result.replace(/\s+/g, ' ');
    }

    // Convert to lowercase
    if (options.lowercase) {
      result = result.toLowerCase();
    }

    // Convert to uppercase
    if (options.uppercase) {
      result = result.toUpperCase();
    }

    return result;
  }

  /**
   * Escape HTML entities
   */
  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Unescape HTML entities
   */
  unescapeHTML(str) {
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.textContent;
  }

  /**
   * Sanitize object
   */
  sanitizeObject(obj, schema) {
    const result = {};

    for (const [field, options] of Object.entries(schema)) {
      if (field in obj) {
        result[field] = this.sanitize(obj[field], options);
      }
    }

    return result;
  }

  /**
   * Validate and sanitize
   */
  validateAndSanitize(value, rules, sanitizeOptions = {}) {
    const sanitized = this.sanitize(value, sanitizeOptions);
    const validation = this.validate(sanitized, rules);
    return {
      ...validation,
      value: sanitized
    };
  }

  /**
   * Create field validator
   */
  field(rules, sanitizeOptions = {}) {
    return (value) => {
      return this.validateAndSanitize(value, rules, sanitizeOptions);
    };
  }

  /**
   * Validate form data
   */
  validateForm(formData, schema) {
    const errors = {};
    const sanitized = {};
    let valid = true;

    for (const [field, config] of Object.entries(schema)) {
      const value = formData[field];
      const result = this.validateAndSanitize(
        value,
        config.rules || {},
        config.sanitize || {}
      );

      if (!result.valid) {
        errors[field] = result.errors;
        valid = false;
      }

      sanitized[field] = result.value;
    }

    return { valid, errors, data: sanitized };
  }
}

// Create singleton instance
export const validator = new Validator();

// Export class for testing
export { Validator };
