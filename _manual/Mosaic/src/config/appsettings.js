import fs from 'node:fs';
import {
  IssueCollector,
  isPlainObject,
  isNonEmptyString,
  isPositiveInteger,
  isInteger,
  isBoolean,
} from './errors.js';
import { applyEnvOverrides, parseBoolean, parseInteger, parseString } from './env.js';
import { contentPath } from './paths.js';

export const DEFAULT_APPSETTINGS = Object.freeze({
  host: '127.0.0.1',
  port: 4930,
  publicBaseUrl: null,
  trustedProxy: Object.freeze({
    enabled: false,
    trustedHeaders: Object.freeze(['x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host']),
  }),
  logging: Object.freeze({
    level: 'info',
    directory: 'logs',
  }),
  developmentMode: false,
  pageSize: Object.freeze({
    default: 50,
    max: 500,
  }),
  maxConcurrentQueriesPerRequest: 4,
  sqlCommandTimeoutMs: 15000,
  fileLimits: Object.freeze({
    maxFileSizeBytes: 50 * 1024 * 1024,
    maxRecordCount: 200000,
  }),
  maxRequestBodyBytes: 1024 * 1024,
  exportLimits: Object.freeze({
    maxRows: 100000,
    maxBytes: 100 * 1024 * 1024,
  }),
  metadataCacheTtlMs: 5 * 60 * 1000,
  showQueryDurationInProduction: false,
});

const LOG_LEVELS = ['error', 'warn', 'info', 'debug'];

export const ENV_OVERRIDES = [
  { envVar: 'MOSAIC_HOST', path: ['host'], parse: parseString },
  { envVar: 'MOSAIC_PORT', path: ['port'], parse: parseInteger },
  { envVar: 'MOSAIC_PUBLIC_BASE_URL', path: ['publicBaseUrl'], parse: parseString },
  { envVar: 'MOSAIC_TRUSTED_PROXY_ENABLED', path: ['trustedProxy', 'enabled'], parse: parseBoolean },
  { envVar: 'MOSAIC_LOG_LEVEL', path: ['logging', 'level'], parse: parseString },
  { envVar: 'MOSAIC_LOG_DIRECTORY', path: ['logging', 'directory'], parse: parseString },
  { envVar: 'MOSAIC_DEV_MODE', path: ['developmentMode'], parse: parseBoolean },
  { envVar: 'MOSAIC_PAGE_SIZE_DEFAULT', path: ['pageSize', 'default'], parse: parseInteger },
  { envVar: 'MOSAIC_PAGE_SIZE_MAX', path: ['pageSize', 'max'], parse: parseInteger },
  {
    envVar: 'MOSAIC_MAX_CONCURRENT_QUERIES_PER_REQUEST',
    path: ['maxConcurrentQueriesPerRequest'],
    parse: parseInteger,
  },
  { envVar: 'MOSAIC_SQL_COMMAND_TIMEOUT_MS', path: ['sqlCommandTimeoutMs'], parse: parseInteger },
  { envVar: 'MOSAIC_FILE_MAX_SIZE_BYTES', path: ['fileLimits', 'maxFileSizeBytes'], parse: parseInteger },
  { envVar: 'MOSAIC_FILE_MAX_RECORD_COUNT', path: ['fileLimits', 'maxRecordCount'], parse: parseInteger },
  { envVar: 'MOSAIC_MAX_REQUEST_BODY_BYTES', path: ['maxRequestBodyBytes'], parse: parseInteger },
  { envVar: 'MOSAIC_EXPORT_MAX_ROWS', path: ['exportLimits', 'maxRows'], parse: parseInteger },
  { envVar: 'MOSAIC_EXPORT_MAX_BYTES', path: ['exportLimits', 'maxBytes'], parse: parseInteger },
  { envVar: 'MOSAIC_METADATA_CACHE_TTL_MS', path: ['metadataCacheTtlMs'], parse: parseInteger },
  {
    envVar: 'MOSAIC_SHOW_QUERY_DURATION',
    path: ['showQueryDurationInProduction'],
    parse: parseBoolean,
  },
];

function mergeWithDefaults(raw) {
  const r = isPlainObject(raw) ? raw : {};
  const d = DEFAULT_APPSETTINGS;
  return {
    host: r.host ?? d.host,
    port: r.port ?? d.port,
    publicBaseUrl: r.publicBaseUrl ?? d.publicBaseUrl,
    trustedProxy: {
      enabled: r.trustedProxy?.enabled ?? d.trustedProxy.enabled,
      trustedHeaders: r.trustedProxy?.trustedHeaders ?? [...d.trustedProxy.trustedHeaders],
    },
    logging: {
      level: r.logging?.level ?? d.logging.level,
      directory: r.logging?.directory ?? d.logging.directory,
    },
    developmentMode: r.developmentMode ?? d.developmentMode,
    pageSize: {
      default: r.pageSize?.default ?? d.pageSize.default,
      max: r.pageSize?.max ?? d.pageSize.max,
    },
    maxConcurrentQueriesPerRequest: r.maxConcurrentQueriesPerRequest ?? d.maxConcurrentQueriesPerRequest,
    sqlCommandTimeoutMs: r.sqlCommandTimeoutMs ?? d.sqlCommandTimeoutMs,
    fileLimits: {
      maxFileSizeBytes: r.fileLimits?.maxFileSizeBytes ?? d.fileLimits.maxFileSizeBytes,
      maxRecordCount: r.fileLimits?.maxRecordCount ?? d.fileLimits.maxRecordCount,
    },
    maxRequestBodyBytes: r.maxRequestBodyBytes ?? d.maxRequestBodyBytes,
    exportLimits: {
      maxRows: r.exportLimits?.maxRows ?? d.exportLimits.maxRows,
      maxBytes: r.exportLimits?.maxBytes ?? d.exportLimits.maxBytes,
    },
    metadataCacheTtlMs: r.metadataCacheTtlMs ?? d.metadataCacheTtlMs,
    showQueryDurationInProduction: r.showQueryDurationInProduction ?? d.showQueryDurationInProduction,
  };
}

export function validateAppSettings(settings) {
  const issues = new IssueCollector();

  if (!isNonEmptyString(settings.host)) issues.add('host', 'must be a non-empty string');
  if (!isPositiveInteger(settings.port) || settings.port > 65535) {
    issues.add('port', 'must be an integer between 1 and 65535');
  }
  if (settings.publicBaseUrl !== null && !isNonEmptyString(settings.publicBaseUrl)) {
    issues.add('publicBaseUrl', 'must be null or a non-empty string');
  }
  if (settings.publicBaseUrl) {
    try {
      // eslint-disable-next-line no-new
      new URL(settings.publicBaseUrl);
    } catch {
      issues.add('publicBaseUrl', 'must be a valid absolute URL');
    }
  }

  if (!isBoolean(settings.trustedProxy?.enabled)) {
    issues.add('trustedProxy.enabled', 'must be a boolean');
  }
  if (!Array.isArray(settings.trustedProxy?.trustedHeaders)) {
    issues.add('trustedProxy.trustedHeaders', 'must be an array of strings');
  }

  if (!LOG_LEVELS.includes(settings.logging?.level)) {
    issues.add('logging.level', `must be one of ${LOG_LEVELS.join(', ')}`);
  }
  if (!isNonEmptyString(settings.logging?.directory)) {
    issues.add('logging.directory', 'must be a non-empty string');
  }

  if (!isBoolean(settings.developmentMode)) issues.add('developmentMode', 'must be a boolean');

  if (!isPositiveInteger(settings.pageSize?.default)) {
    issues.add('pageSize.default', 'must be a positive integer');
  }
  if (!isPositiveInteger(settings.pageSize?.max)) {
    issues.add('pageSize.max', 'must be a positive integer');
  }
  if (
    isPositiveInteger(settings.pageSize?.default) &&
    isPositiveInteger(settings.pageSize?.max) &&
    settings.pageSize.default > settings.pageSize.max
  ) {
    issues.add('pageSize.default', 'must not exceed pageSize.max');
  }

  if (!isPositiveInteger(settings.maxConcurrentQueriesPerRequest)) {
    issues.add('maxConcurrentQueriesPerRequest', 'must be a positive integer');
  }
  if (!isPositiveInteger(settings.sqlCommandTimeoutMs)) {
    issues.add('sqlCommandTimeoutMs', 'must be a positive integer');
  }

  if (!isPositiveInteger(settings.fileLimits?.maxFileSizeBytes)) {
    issues.add('fileLimits.maxFileSizeBytes', 'must be a positive integer');
  }
  if (!isPositiveInteger(settings.fileLimits?.maxRecordCount)) {
    issues.add('fileLimits.maxRecordCount', 'must be a positive integer');
  }

  if (!isPositiveInteger(settings.maxRequestBodyBytes)) {
    issues.add('maxRequestBodyBytes', 'must be a positive integer');
  }

  if (!isPositiveInteger(settings.exportLimits?.maxRows)) {
    issues.add('exportLimits.maxRows', 'must be a positive integer');
  }
  if (!isPositiveInteger(settings.exportLimits?.maxBytes)) {
    issues.add('exportLimits.maxBytes', 'must be a positive integer');
  }

  if (!isInteger(settings.metadataCacheTtlMs) || settings.metadataCacheTtlMs < 0) {
    issues.add('metadataCacheTtlMs', 'must be a non-negative integer');
  }

  if (!isBoolean(settings.showQueryDurationInProduction)) {
    issues.add('showQueryDurationInProduction', 'must be a boolean');
  }

  return issues;
}

export function loadAppSettings({ filePath = contentPath('appsettings.json'), env = process.env } = {}) {
  let raw = {};
  if (fs.existsSync(filePath)) {
    const text = fs.readFileSync(filePath, 'utf8');
    try {
      raw = JSON.parse(text);
    } catch (err) {
      const issues = new IssueCollector();
      issues.add('<root>', `appsettings.json is not valid JSON: ${err.message}`);
      issues.throwIfInvalid('appsettings.json');
    }
  }

  const settings = mergeWithDefaults(raw);
  applyEnvOverrides(settings, ENV_OVERRIDES, env);

  const issues = validateAppSettings(settings);
  issues.throwIfInvalid('appsettings.json (after environment overrides)');

  return settings;
}

export function isLoopbackHost(host) {
  return ['127.0.0.1', 'localhost', '::1'].includes(host);
}
