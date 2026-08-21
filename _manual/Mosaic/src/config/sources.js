import fs from 'node:fs';
import {
  IssueCollector,
  isPlainObject,
  isNonEmptyString,
  isBoolean,
  isPositiveInteger,
} from './errors.js';
import { CONTENT_DIR, contentPath, resolveWithinRoot, PathEscapeError } from './paths.js';

export const SQL_PROVIDERS = ['sqlserver', 'sqlite'];
export const FILE_PROVIDERS = ['json', 'jsonl', 'csv', 'xml'];
export const ALL_PROVIDERS = [...SQL_PROVIDERS, ...FILE_PROVIDERS];

function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function validateSqlSource(source, index, issues, env) {
  const prefix = `sources[${index}]`;

  const hasConnectionString = source.connectionString !== undefined;
  const hasConnectionStringEnvVar = source.connectionStringEnvironmentVariable !== undefined;

  if (hasConnectionString === hasConnectionStringEnvVar) {
    issues.add(
      `${prefix}`,
      'exactly one of connectionString or connectionStringEnvironmentVariable must be set',
    );
  } else if (hasConnectionString && !isNonEmptyString(source.connectionString)) {
    issues.add(`${prefix}.connectionString`, 'must be a non-empty string');
  } else if (hasConnectionStringEnvVar) {
    if (!isNonEmptyString(source.connectionStringEnvironmentVariable)) {
      issues.add(`${prefix}.connectionStringEnvironmentVariable`, 'must be a non-empty string');
    } else if (!isNonEmptyString(env[source.connectionStringEnvironmentVariable])) {
      issues.add(
        `${prefix}.connectionStringEnvironmentVariable`,
        `environment variable ${source.connectionStringEnvironmentVariable} is not set`,
      );
    }
  }

  if (source.allowWrites !== undefined && !isBoolean(source.allowWrites)) {
    issues.add(`${prefix}.allowWrites`, 'must be a boolean');
  }
  if (source.commandTimeoutMs !== undefined && !isPositiveInteger(source.commandTimeoutMs)) {
    issues.add(`${prefix}.commandTimeoutMs`, 'must be a positive integer');
  }
  for (const field of ['allowedSchemas', 'allowedTables', 'deniedSchemas', 'deniedTables']) {
    if (source[field] !== undefined && !isStringArray(source[field])) {
      issues.add(`${prefix}.${field}`, 'must be an array of strings');
    }
  }

  if (source.provider === 'sqlite') {
    const connString = hasConnectionString
      ? source.connectionString
      : env[source.connectionStringEnvironmentVariable];
    if (isNonEmptyString(connString)) {
      try {
        parseSqliteDataSource(connString);
      } catch (err) {
        issues.add(`${prefix}.connectionString`, err.message);
      }
    }
  }
}

function validateFileSource(source, index, issues) {
  const prefix = `sources[${index}]`;

  if (!isNonEmptyString(source.path)) {
    issues.add(`${prefix}.path`, 'must be a non-empty string');
  } else {
    let resolved;
    try {
      resolved = resolveWithinRoot(CONTENT_DIR, source.path);
    } catch (err) {
      if (err instanceof PathEscapeError) {
        issues.add(`${prefix}.path`, 'must resolve to a location beneath the application content directory (no absolute paths, .., or UNC paths)');
      } else {
        throw err;
      }
    }
    if (resolved && !fs.existsSync(resolved)) {
      issues.add(`${prefix}.path`, `file does not exist: ${source.path}`);
    }
    if (resolved && fs.existsSync(resolved) && !fs.statSync(resolved).isFile()) {
      issues.add(`${prefix}.path`, `not a regular file: ${source.path}`);
    }
  }

  if (source.encoding !== undefined && !isNonEmptyString(source.encoding)) {
    issues.add(`${prefix}.encoding`, 'must be a non-empty string');
  }

  if (source.provider === 'json') {
    if (source.rootProperty !== undefined && !isNonEmptyString(source.rootProperty)) {
      issues.add(`${prefix}.rootProperty`, 'must be a non-empty string');
    }
  }

  if (source.provider === 'csv') {
    if (source.delimiter !== undefined && (typeof source.delimiter !== 'string' || source.delimiter.length !== 1)) {
      issues.add(`${prefix}.delimiter`, 'must be a single character');
    }
    if (source.hasHeader !== undefined && !isBoolean(source.hasHeader)) {
      issues.add(`${prefix}.hasHeader`, 'must be a boolean');
    }
    if (source.quote !== undefined && (typeof source.quote !== 'string' || source.quote.length !== 1)) {
      issues.add(`${prefix}.quote`, 'must be a single character');
    }
  }

  if (source.provider === 'xml') {
    if (!isNonEmptyString(source.recordPath)) {
      issues.add(`${prefix}.recordPath`, 'must be a non-empty string (e.g. "Root/Records/Record")');
    }
    if (source.attributePrefix !== undefined && typeof source.attributePrefix !== 'string') {
      issues.add(`${prefix}.attributePrefix`, 'must be a string');
    }
  }
}

export function validateSources(config, { env = process.env } = {}) {
  const issues = new IssueCollector();

  if (!isPlainObject(config) || !Array.isArray(config.sources)) {
    issues.add('<root>', 'must be an object with a "sources" array');
    return issues;
  }

  const seenIds = new Set();

  config.sources.forEach((source, index) => {
    const prefix = `sources[${index}]`;
    if (!isPlainObject(source)) {
      issues.add(prefix, 'must be an object');
      return;
    }

    if (!isNonEmptyString(source.id)) {
      issues.add(`${prefix}.id`, 'must be a non-empty string');
    } else if (seenIds.has(source.id)) {
      issues.add(`${prefix}.id`, `duplicate source id "${source.id}"`);
    } else {
      seenIds.add(source.id);
    }

    if (!isNonEmptyString(source.name)) {
      issues.add(`${prefix}.name`, 'must be a non-empty string');
    }

    if (!ALL_PROVIDERS.includes(source.provider)) {
      issues.add(`${prefix}.provider`, `must be one of ${ALL_PROVIDERS.join(', ')}`);
      return;
    }

    if (SQL_PROVIDERS.includes(source.provider)) {
      validateSqlSource(source, index, issues, env);
    } else {
      validateFileSource(source, index, issues);
    }
  });

  return issues;
}

/**
 * Parses a "Data Source=<relative-path>" SQLite connection string and
 * returns the path resolved (and containment-verified) beneath the content
 * directory. Throws PathEscapeError / Error on malformed input.
 */
export function parseSqliteDataSource(connectionString) {
  const match = /^\s*Data Source\s*=\s*(.+?)\s*$/i.exec(connectionString);
  if (!match) {
    throw new Error('sqlite connectionString must look like "Data Source=<relative path>"');
  }
  const relativePath = match[1];
  return resolveWithinRoot(CONTENT_DIR, relativePath);
}

export function resolveConnectionString(source, env = process.env) {
  return source.connectionString ?? env[source.connectionStringEnvironmentVariable];
}

export function loadSources({ filePath = contentPath('sources.json'), env = process.env } = {}) {
  let raw = { sources: [] };
  if (fs.existsSync(filePath)) {
    const text = fs.readFileSync(filePath, 'utf8');
    try {
      raw = JSON.parse(text);
    } catch (err) {
      const issues = new IssueCollector();
      issues.add('<root>', `sources.json is not valid JSON: ${err.message}`);
      issues.throwIfInvalid('sources.json');
    }
  }

  const issues = validateSources(raw, { env });
  issues.throwIfInvalid('sources.json');

  return raw.sources;
}

export function sourcesById(sources) {
  return new Map(sources.map((s) => [s.id, s]));
}
