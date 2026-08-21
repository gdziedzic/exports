import fs from 'node:fs';
import path from 'node:path';
import { IssueCollector, isPlainObject, isNonEmptyString, isBoolean, isPositiveInteger } from './errors.js';
import { contentPath, resolveWithinRoot, PathEscapeError } from './paths.js';

export const PARAMETER_TYPES = ['text', 'multiline', 'integer', 'decimal', 'boolean', 'date', 'datetime', 'select', 'hidden'];
export const PRESENTATIONS = ['table', 'single-record', 'scalar'];
export const RESERVED_PARAMETER_NAMES = new Set(['Offset', 'PageSize']);
const PARAMETER_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function validateParameterDef(def, prefix, issues) {
  if (!isPlainObject(def)) {
    issues.add(prefix, 'must be an object');
    return;
  }
  if (!isNonEmptyString(def.name) || !PARAMETER_NAME_PATTERN.test(def.name)) {
    issues.add(`${prefix}.name`, 'must be a non-empty identifier (letters, digits, underscore; not starting with a digit)');
  } else if (RESERVED_PARAMETER_NAMES.has(def.name)) {
    issues.add(`${prefix}.name`, `"${def.name}" is reserved (automatically supplied per block) and cannot be declared`);
  } else if (def.name.startsWith('__')) {
    issues.add(`${prefix}.name`, 'names starting with "__" are reserved for engine-generated bind parameters and cannot be declared');
  }
  if (!isNonEmptyString(def.label)) issues.add(`${prefix}.label`, 'must be a non-empty string');
  if (!PARAMETER_TYPES.includes(def.type)) issues.add(`${prefix}.type`, `must be one of ${PARAMETER_TYPES.join(', ')}`);
  if (def.required !== undefined && !isBoolean(def.required)) issues.add(`${prefix}.required`, 'must be a boolean');
  if (def.type === 'select') {
    if (!Array.isArray(def.options) || def.options.length === 0) {
      issues.add(`${prefix}.options`, 'select parameters must declare a non-empty options array');
    } else {
      def.options.forEach((opt, i) => {
        if (!isPlainObject(opt) || opt.value === undefined || !isNonEmptyString(opt.label)) {
          issues.add(`${prefix}.options[${i}]`, 'must be an object with "value" and a non-empty "label"');
        }
      });
    }
  }
}

/** Naive scan for @Identifier tokens in SQL text - good enough to catch obviously-undeclared parameters at startup without parsing SQL. */
export function referencedParamNames(sqlText) {
  const names = new Set();
  for (const match of sqlText.matchAll(/@([A-Za-z_][A-Za-z0-9_]*)/g)) names.add(match[1]);
  return names;
}

// "table" presentation blocks are wrapped by the engine to add dynamic sort/filter/pagination
// (see pages/blockExecutor.js, providers/*/rawQuery.js's runTableBlockQuery), so the author's own
// SQL must be a plain SELECT with no ordering/pagination of its own - these would either be
// silently discarded by the wrap or (ORDER BY in a SQL Server derived table with no TOP) fail
// outright. Naive, word-boundary regex checks - good enough to catch the obvious case at
// config-load time, not a real SQL parser (won't see through string literals/comments).
const TABLE_BLOCK_FORBIDDEN_SQL = [
  { pattern: /\bORDER\s+BY\b/i, label: 'ORDER BY' },
  { pattern: /\bLIMIT\b/i, label: 'LIMIT' },
  { pattern: /\bOFFSET\b/i, label: 'OFFSET' },
  { pattern: /\bTOP\s*\(?\s*\d/i, label: 'TOP' },
];

function checkTableBlockSqlShape(sql, prefix, issues) {
  for (const { pattern, label } of TABLE_BLOCK_FORBIDDEN_SQL) {
    if (pattern.test(sql)) {
      issues.add(
        prefix,
        `must not contain ${label} - sort, filter, and pagination for "table" blocks are now supplied automatically by the engine; write only SELECT ... FROM ... [WHERE ...]`,
      );
    }
  }
}

function loadQueryFile(pageDir, relativePath, prefix, issues) {
  if (!isNonEmptyString(relativePath)) {
    issues.add(prefix, 'must be a non-empty string');
    return null;
  }
  let resolved;
  try {
    resolved = resolveWithinRoot(pageDir, relativePath);
  } catch (err) {
    if (err instanceof PathEscapeError) {
      issues.add(prefix, 'must resolve to a location beneath this page\'s own directory');
      return null;
    }
    throw err;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    issues.add(prefix, `SQL file does not exist: ${relativePath}`);
    return null;
  }
  return fs.readFileSync(resolved, 'utf8');
}

function validateBlock(block, index, pageDir, pageParamNames, sqlSourceIds, writableSourceIds, blockIds, actionIds, issues) {
  const prefix = `blocks[${index}]`;
  if (!isPlainObject(block)) {
    issues.add(prefix, 'must be an object');
    return;
  }

  if (!isNonEmptyString(block.id)) {
    issues.add(`${prefix}.id`, 'must be a non-empty string');
  } else if (blockIds.has(block.id)) {
    issues.add(`${prefix}.id`, `duplicate block id "${block.id}"`);
  } else {
    blockIds.add(block.id);
  }

  if (!isNonEmptyString(block.title)) issues.add(`${prefix}.title`, 'must be a non-empty string');
  if (!isNonEmptyString(block.sourceId) || !sqlSourceIds.has(block.sourceId)) {
    issues.add(`${prefix}.sourceId`, 'must reference a configured sqlserver or sqlite source');
  }
  if (!PRESENTATIONS.includes(block.presentation)) {
    issues.add(`${prefix}.presentation`, `must be one of ${PRESENTATIONS.join(', ')}`);
  }
  if (block.pageSize !== undefined && !isPositiveInteger(block.pageSize)) {
    issues.add(`${prefix}.pageSize`, 'must be a positive integer');
  }
  if (block.width !== undefined && !['full', 'half'].includes(block.width)) {
    issues.add(`${prefix}.width`, 'must be "full" or "half"');
  }
  if (block.allowCsvExport !== undefined && !isBoolean(block.allowCsvExport)) issues.add(`${prefix}.allowCsvExport`, 'must be a boolean');
  if (block.allowJsonExport !== undefined && !isBoolean(block.allowJsonExport)) issues.add(`${prefix}.allowJsonExport`, 'must be a boolean');
  if ((block.allowCsvExport || block.allowJsonExport) && block.presentation !== 'table') {
    issues.add(prefix, 'allowCsvExport/allowJsonExport are only supported for "table" presentation blocks');
  }

  const blockParamNames = new Set();
  (block.parameters ?? []).forEach((def, i) => {
    validateParameterDef(def, `${prefix}.parameters[${i}]`, issues);
    if (isPlainObject(def) && isNonEmptyString(def.name)) blockParamNames.add(def.name);
  });

  const declaredParamNames = new Set([...pageParamNames, ...blockParamNames, ...RESERVED_PARAMETER_NAMES]);

  const sql = loadQueryFile(pageDir, block.query, `${prefix}.query`, issues);
  if (sql !== null) {
    const referenced = referencedParamNames(sql);
    for (const name of referenced) {
      if (!declaredParamNames.has(name)) {
        issues.add(`${prefix}.query`, `references undeclared parameter @${name}`);
      }
    }
    if (block.presentation === 'table') {
      if (referenced.has('Offset') || referenced.has('PageSize')) {
        issues.add(`${prefix}.query`, '"table" blocks must not reference @Offset/@PageSize - pagination is now supplied automatically by the engine');
      }
      checkTableBlockSqlShape(sql, `${prefix}.query`, issues);
    }
  }

  if (block.columns !== undefined) {
    if (!Array.isArray(block.columns)) {
      issues.add(`${prefix}.columns`, 'must be an array');
    } else {
      block.columns.forEach((col, i) => {
        if (!isPlainObject(col) || !isNonEmptyString(col.name)) {
          issues.add(`${prefix}.columns[${i}]`, 'must be an object with a non-empty "name"');
        }
      });
    }
  }

  if (block.writeActions !== undefined) {
    if (!Array.isArray(block.writeActions)) {
      issues.add(`${prefix}.writeActions`, 'must be an array');
    } else {
      block.writeActions.forEach((action, i) => {
        validateWriteAction(action, `${prefix}.writeActions[${i}]`, pageDir, declaredParamNames, block, writableSourceIds, actionIds, issues);
      });
    }
  }
}

function validateWriteAction(action, prefix, pageDir, declaredParamNames, block, writableSourceIds, actionIds, issues) {
  if (!isPlainObject(action)) {
    issues.add(prefix, 'must be an object');
    return;
  }
  if (!isNonEmptyString(action.id)) {
    issues.add(`${prefix}.id`, 'must be a non-empty string');
  } else if (actionIds.has(action.id)) {
    issues.add(`${prefix}.id`, `duplicate write action id "${action.id}" (must be unique across the whole page)`);
  } else {
    actionIds.add(action.id);
  }
  if (!isNonEmptyString(action.label)) issues.add(`${prefix}.label`, 'must be a non-empty string');

  if (isNonEmptyString(block?.sourceId) && !writableSourceIds.has(block.sourceId)) {
    issues.add(prefix, `owning block's source "${block.sourceId}" does not have allowWrites: true`);
  }

  const actionParamNames = new Set();
  (action.parameters ?? []).forEach((def, i) => {
    validateParameterDef(def, `${prefix}.parameters[${i}]`, issues);
    if (isPlainObject(def) && isNonEmptyString(def.name)) actionParamNames.add(def.name);
  });
  const declared = new Set([...declaredParamNames, ...actionParamNames]);

  const sql = loadQueryFile(pageDir, action.query, `${prefix}.query`, issues);
  if (sql !== null) {
    for (const name of referencedParamNames(sql)) {
      if (!declared.has(name)) issues.add(`${prefix}.query`, `references undeclared parameter @${name}`);
    }
  }

  if (action.confirm !== undefined && !isBoolean(action.confirm)) issues.add(`${prefix}.confirm`, 'must be a boolean');
  if (action.destructive !== undefined && !isBoolean(action.destructive)) issues.add(`${prefix}.destructive`, 'must be a boolean');
  if (action.refreshBlockIds !== undefined && !Array.isArray(action.refreshBlockIds)) {
    issues.add(`${prefix}.refreshBlockIds`, 'must be an array of block ids');
  }
}

export function validatePageConfig(raw, { pageDir, sqlSourceIds, writableSourceIds }) {
  const issues = new IssueCollector();

  if (!isPlainObject(raw)) {
    issues.add('<root>', 'must be an object');
    return issues;
  }
  if (!isNonEmptyString(raw.id)) issues.add('id', 'must be a non-empty string');
  if (!isNonEmptyString(raw.title)) issues.add('title', 'must be a non-empty string');
  if (raw.description !== undefined && typeof raw.description !== 'string') issues.add('description', 'must be a string');

  const pageParamNames = new Set();
  if (raw.parameters !== undefined) {
    if (!Array.isArray(raw.parameters)) {
      issues.add('parameters', 'must be an array');
    } else {
      raw.parameters.forEach((def, i) => {
        validateParameterDef(def, `parameters[${i}]`, issues);
        if (isPlainObject(def) && isNonEmptyString(def.name)) pageParamNames.add(def.name);
      });
    }
  }

  if (!Array.isArray(raw.blocks) || raw.blocks.length === 0) {
    issues.add('blocks', 'must be a non-empty array');
    return issues;
  }

  const blockIds = new Set();
  const actionIds = new Set();
  raw.blocks.forEach((block, i) =>
    validateBlock(block, i, pageDir, pageParamNames, sqlSourceIds, writableSourceIds, blockIds, actionIds, issues),
  );

  // refreshBlockIds must reference real blocks on this page - checked after all block ids are known.
  raw.blocks.forEach((block, i) => {
    for (const action of block?.writeActions ?? []) {
      for (const refreshId of action?.refreshBlockIds ?? []) {
        if (!blockIds.has(refreshId)) {
          issues.add(`blocks[${i}].writeActions`, `refreshBlockIds references unknown block id "${refreshId}"`);
        }
      }
    }
  });

  return issues;
}

/**
 * Scans pages/<pageId>/page.json for every subdirectory of `pagesDir`. A
 * page with invalid configuration is isolated (added to `invalid`, with a
 * diagnostic) rather than preventing the rest of the app from starting.
 */
export function loadPages(sources, { pagesDir = contentPath('pages') } = {}) {
  const pages = new Map();
  const invalid = new Map();

  if (!fs.existsSync(pagesDir)) return { pages, invalid };

  const sqlSourceIds = new Set(sources.filter((s) => s.provider === 'sqlserver' || s.provider === 'sqlite').map((s) => s.id));
  const writableSourceIds = new Set(
    sources.filter((s) => (s.provider === 'sqlserver' || s.provider === 'sqlite') && s.allowWrites).map((s) => s.id),
  );

  const dirNames = fs
    .readdirSync(pagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const dirName of dirNames) {
    const pageDir = path.join(pagesDir, dirName);
    const pageJsonPath = path.join(pageDir, 'page.json');
    if (!fs.existsSync(pageJsonPath)) continue;

    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(pageJsonPath, 'utf8'));
    } catch (err) {
      invalid.set(dirName, { reason: `page.json is not valid JSON: ${err.message}`, issues: [] });
      continue;
    }

    const issues = validatePageConfig(raw, { pageDir, sqlSourceIds, writableSourceIds });
    const pageId = isNonEmptyString(raw?.id) ? raw.id : dirName;

    if (!issues.ok) {
      invalid.set(pageId, { reason: 'Invalid page configuration', issues: issues.issues });
      continue;
    }
    if (pages.has(raw.id)) {
      invalid.set(raw.id, { reason: `Duplicate page id "${raw.id}" (already defined by another pages/ directory)`, issues: [] });
      continue;
    }
    pages.set(raw.id, { ...raw, dir: pageDir });
  }

  return { pages, invalid };
}
