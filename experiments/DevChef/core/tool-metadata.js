const ARRAY_FIELDS = ['tags', 'aliases', 'examples', 'keywords'];
const REQUIRED_METADATA_FIELDS = [
  'file',
  'id',
  'name',
  'category',
  'tags',
  'aliases',
  'examples',
  'maturity',
  'lastUpdated',
  'testCoverage'
];
const ALLOWED_MATURITY = ['experimental', 'beta', 'stable', 'deprecated'];
const ALLOWED_TEST_COVERAGE = ['unknown', 'none', 'manual-smoke', 'unit', 'e2e', 'automated'];
const STALE_METADATA_DAYS = 365;

/**
 * Normalize legacy string entries and rich metadata entries from tools/index.json.
 * @param {string|Object} entry - Tool index entry
 * @returns {Object} Normalized metadata
 */
export function normalizeToolIndexEntry(entry) {
  if (typeof entry === 'string') {
    return { file: entry };
  }

  if (entry && typeof entry === 'object' && typeof entry.file === 'string') {
    return {
      ...entry,
      tags: normalizeStringArray(entry.tags),
      aliases: normalizeStringArray(entry.aliases),
      examples: normalizeStringArray(entry.examples),
      keywords: normalizeStringArray(entry.keywords)
    };
  }

  return { file: '' };
}

/**
 * Get the HTML filename for a legacy or rich index entry.
 * @param {string|Object} entry - Tool index entry
 * @returns {string} Tool filename
 */
export function getToolIndexFilename(entry) {
  return normalizeToolIndexEntry(entry).file;
}

/**
 * Merge runtime manifest data with index metadata.
 * Index metadata is intentionally allowed to refine discovery fields while the
 * manifest remains the source for runtime identity when metadata is absent.
 * @param {Object} manifest - Parsed devchef-manifest
 * @param {Object} metadata - Normalized index metadata
 * @returns {Object} Merged manifest used by registry/search/UI
 */
export function mergeToolMetadata(manifest = {}, metadata = {}) {
  const merged = {
    ...manifest,
    ...metadata,
    id: metadata.id || manifest.id,
    name: metadata.name || manifest.name,
    category: metadata.category || manifest.category,
    description: metadata.description || manifest.description,
    file: metadata.file || manifest.file,
    tags: uniqueStrings([
      ...normalizeStringArray(metadata.tags),
      ...normalizeStringArray(manifest.tags)
    ]),
    aliases: normalizeStringArray(metadata.aliases || manifest.aliases),
    examples: normalizeStringArray(metadata.examples || manifest.examples),
    keywords: uniqueStrings([
      ...normalizeStringArray(manifest.keywords),
      ...normalizeStringArray(metadata.keywords),
      ...normalizeStringArray(metadata.tags),
      ...normalizeStringArray(metadata.aliases)
    ]),
    maturity: metadata.maturity || manifest.maturity || 'experimental',
    lastUpdated: metadata.lastUpdated || manifest.lastUpdated || null,
    testCoverage: metadata.testCoverage || manifest.testCoverage || 'unknown'
  };

  ARRAY_FIELDS.forEach(field => {
    merged[field] = normalizeStringArray(merged[field]);
  });

  return merged;
}

/**
 * Build searchable metadata terms from a merged tool manifest.
 * @param {Object} tool - Tool manifest
 * @returns {Object} Searchable field arrays
 */
export function getToolSearchMetadata(tool = {}) {
  return {
    tags: normalizeStringArray(tool.tags),
    aliases: normalizeStringArray(tool.aliases),
    examples: normalizeStringArray(tool.examples),
    keywords: normalizeStringArray(tool.keywords),
    maturity: tool.maturity ? [String(tool.maturity)] : [],
    testCoverage: tool.testCoverage ? [String(tool.testCoverage)] : [],
    lastUpdated: tool.lastUpdated ? [String(tool.lastUpdated)] : []
  };
}

export function normalizeStringArray(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return uniqueStrings(values.map(item => String(item).trim()).filter(Boolean));
}

/**
 * Validate the complete tools/index.json metadata registry.
 * @param {Array} entries - Raw tools/index.json entries
 * @param {Object} options - Validation options
 * @param {Map|Object} options.manifestsByFile - Parsed manifests keyed by filename
 * @param {Date} options.now - Reference date for staleness checks
 * @returns {Object} Validation result grouped by file
 */
export function validateToolMetadataIndex(entries, options = {}) {
  const manifestsByFile = options.manifestsByFile || new Map();
  const now = options.now || new Date();
  const normalizedEntries = Array.isArray(entries)
    ? entries.map(entry => {
      if (typeof entry === 'string') {
        return normalizeToolIndexEntry(entry);
      }
      const normalized = normalizeToolIndexEntry(entry);
      return {
        ...entry,
        file: normalized.file
      };
    })
    : [];
  const issuesByFile = new Map();
  const fileCounts = countValues(normalizedEntries.map(entry => entry.file).filter(Boolean));
  const idCounts = countValues(normalizedEntries.map(entry => entry.id).filter(Boolean));
  const aliasOwners = new Map();

  normalizedEntries.forEach(entry => {
    normalizeStringArray(entry.aliases).forEach(alias => {
      const key = alias.toLowerCase();
      const owners = aliasOwners.get(key) || [];
      owners.push(entry.file || '(missing file)');
      aliasOwners.set(key, owners);
    });
  });

  normalizedEntries.forEach(entry => {
    const issues = [];
    const file = entry.file || `(entry ${issuesByFile.size + 1})`;
    const manifest = getManifestForFile(manifestsByFile, entry.file);

    REQUIRED_METADATA_FIELDS.forEach(field => {
      const value = entry[field];
      const present = Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? value.trim() : Boolean(value);
      if (!present) {
        issues.push(errorIssue(field, `${field} is required in tools/index.json.`));
      }
    });

    if (entry.file && !entry.file.endsWith('.html')) {
      issues.push(errorIssue('file', 'file must point to an .html tool file.'));
    }

    if (entry.file && (entry.file.includes('/') || entry.file.includes('\\'))) {
      issues.push(warnIssue('file', 'file should be a flat filename inside tools/.'));
    }

    if (entry.file && fileCounts.get(entry.file) > 1) {
      issues.push(errorIssue('file', `${entry.file} appears more than once in tools/index.json.`));
    }

    if (entry.id && idCounts.get(entry.id) > 1) {
      issues.push(errorIssue('id', `${entry.id} appears more than once in tools/index.json.`));
    }

    if (manifest) {
      if (entry.id && manifest.id && entry.id !== manifest.id) {
        issues.push(errorIssue('id', `Registry id "${entry.id}" does not match manifest id "${manifest.id}".`));
      }

      if (entry.name && manifest.name && entry.name !== manifest.name) {
        issues.push(warnIssue('name', `Registry name differs from manifest name "${manifest.name}".`));
      }

      if (entry.category && manifest.category && entry.category !== manifest.category) {
        issues.push(warnIssue('category', `Registry category differs from manifest category "${manifest.category}".`));
      }
    } else if (entry.file) {
      issues.push(errorIssue('manifest', `No manifest was supplied for ${entry.file}.`));
    }

    validateArrayField(entry, 'tags', issues, { min: 2 });
    validateArrayField(entry, 'aliases', issues, { min: 1 });
    validateArrayField(entry, 'examples', issues, { min: 1 });
    validateAllowedValue(entry, 'maturity', ALLOWED_MATURITY, issues);
    validateAllowedValue(entry, 'testCoverage', ALLOWED_TEST_COVERAGE, issues);
    validateDateField(entry, 'lastUpdated', now, issues);

    normalizeStringArray(entry.aliases).forEach(alias => {
      const key = alias.toLowerCase();
      const owners = aliasOwners.get(key) || [];
      if (owners.length > 1) {
        issues.push(errorIssue('aliases', `Alias "${alias}" is shared by: ${owners.join(', ')}.`));
      }

      const conflictsWithIdentity = normalizedEntries.find(other => {
        if (other.file === entry.file) return false;
        return [other.id, other.name]
          .filter(Boolean)
          .some(value => String(value).toLowerCase() === key);
      });

      if (conflictsWithIdentity) {
        issues.push(errorIssue('aliases', `Alias "${alias}" conflicts with ${conflictsWithIdentity.file}.`));
      }
    });

    issuesByFile.set(file, issues);
  });

  const allIssues = Array.from(issuesByFile.values()).flat();
  return {
    ok: allIssues.every(issue => issue.severity !== 'error'),
    issues: allIssues,
    issuesByFile: Object.fromEntries(issuesByFile),
    totals: {
      entries: normalizedEntries.length,
      errors: allIssues.filter(issue => issue.severity === 'error').length,
      warnings: allIssues.filter(issue => issue.severity === 'warning').length
    },
    allowed: {
      maturity: ALLOWED_MATURITY,
      testCoverage: ALLOWED_TEST_COVERAGE
    }
  };
}

export {
  ALLOWED_MATURITY,
  ALLOWED_TEST_COVERAGE,
  REQUIRED_METADATA_FIELDS,
  STALE_METADATA_DAYS
};

function uniqueStrings(values) {
  return Array.from(new Set(values));
}

function validateArrayField(entry, field, issues, options = {}) {
  const raw = entry[field];
  if (!Array.isArray(raw)) {
    issues.push(errorIssue(field, `${field} must be an array.`));
    return;
  }

  const values = raw.map(item => String(item).trim()).filter(Boolean);
  if (options.min && values.length < options.min) {
    issues.push(errorIssue(field, `${field} must contain at least ${options.min} value(s).`));
  }

  const duplicates = findDuplicateValues(values.map(value => value.toLowerCase()));
  duplicates.forEach(value => {
    issues.push(errorIssue(field, `${field} contains duplicate value "${value}".`));
  });
}

function validateAllowedValue(entry, field, allowed, issues) {
  if (!allowed.includes(entry[field])) {
    issues.push(errorIssue(field, `${field} must be one of: ${allowed.join(', ')}.`));
  }
}

function validateDateField(entry, field, now, issues) {
  const value = entry[field];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    issues.push(errorIssue(field, `${field} must use YYYY-MM-DD format.`));
    return;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    issues.push(errorIssue(field, `${field} is not a valid date.`));
    return;
  }

  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (date.getTime() > nowUtc) {
    issues.push(errorIssue(field, `${field} cannot be in the future.`));
    return;
  }

  const ageDays = Math.floor((nowUtc - date.getTime()) / 86400000);
  if (ageDays > STALE_METADATA_DAYS) {
    issues.push(warnIssue(field, `${field} is stale (${ageDays} days old).`));
  }
}

function getManifestForFile(manifestsByFile, file) {
  if (!file) return null;
  if (manifestsByFile instanceof Map) {
    return manifestsByFile.get(file) || null;
  }
  return manifestsByFile[file] || null;
}

function countValues(values) {
  const counts = new Map();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  return counts;
}

function findDuplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.forEach(value => {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  });
  return Array.from(duplicates);
}

function errorIssue(field, message) {
  return { severity: 'error', field, message };
}

function warnIssue(field, message) {
  return { severity: 'warning', field, message };
}
