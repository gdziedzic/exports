export class ConfigValidationError extends Error {
  /**
   * @param {string} source - which file failed, e.g. "appsettings.json"
   * @param {{path: string, message: string}[]} issues
   */
  constructor(source, issues) {
    const summary = issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n');
    super(`Invalid ${source}:\n${summary}`);
    this.name = 'ConfigValidationError';
    this.source = source;
    this.issues = issues;
  }
}

export class IssueCollector {
  constructor() {
    /** @type {{path: string, message: string}[]} */
    this.issues = [];
  }

  add(path, message) {
    this.issues.push({ path, message });
  }

  get ok() {
    return this.issues.length === 0;
  }

  throwIfInvalid(source) {
    if (!this.ok) {
      throw new ConfigValidationError(source, this.issues);
    }
  }
}

export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isInteger(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

export function isPositiveInteger(value) {
  return isInteger(value) && value > 0;
}

export function isBoolean(value) {
  return typeof value === 'boolean';
}
