import fs from 'node:fs';
import crypto from 'node:crypto';
import { IssueCollector, isPlainObject, isNonEmptyString } from './errors.js';
import { contentPath } from './paths.js';

/**
 * Structural validation only (well-formed JSON shape) - unlike sources.json/page.json this
 * file is written by the app itself (see TableActionsStore.add below), not hand-authored, so
 * there's no need to re-derive rich per-field diagnostics for a human editor. A malformed file
 * (e.g. hand-edited into a bad state) still fails startup loudly, same as any other config file.
 */
function validateAction(action, index, issues) {
  const prefix = `actions[${index}]`;
  if (!isPlainObject(action)) {
    issues.add(prefix, 'must be an object');
    return;
  }
  if (!isNonEmptyString(action.id)) issues.add(`${prefix}.id`, 'must be a non-empty string');
  if (!isNonEmptyString(action.sourceId)) issues.add(`${prefix}.sourceId`, 'must be a non-empty string');
  if (!isNonEmptyString(action.schema)) issues.add(`${prefix}.schema`, 'must be a non-empty string');
  if (!isNonEmptyString(action.table)) issues.add(`${prefix}.table`, 'must be a non-empty string');
  if (!isNonEmptyString(action.label)) issues.add(`${prefix}.label`, 'must be a non-empty string');
  if (!isNonEmptyString(action.sql)) issues.add(`${prefix}.sql`, 'must be a non-empty string');
}

export function validateTableActionsConfig(raw) {
  const issues = new IssueCollector();
  if (!isPlainObject(raw) || !Array.isArray(raw.actions)) {
    issues.add('<root>', 'must be an object with an "actions" array');
    return issues;
  }

  const seenIds = new Set();
  raw.actions.forEach((action, index) => {
    validateAction(action, index, issues);
    if (isPlainObject(action) && isNonEmptyString(action.id)) {
      if (seenIds.has(action.id)) issues.add(`actions[${index}].id`, `duplicate action id "${action.id}"`);
      seenIds.add(action.id);
    }
  });

  return issues;
}

/**
 * File-backed store of user-defined per-table custom SQL actions (e.g. "increment this row's
 * counter"). Unlike sources.json/pages/ - which are read once at startup and never written by
 * the app - this store is mutated at runtime (an action is created through the browser, not by
 * hand-editing JSON) and persists every change to disk immediately, so actions survive a
 * restart. Kept intentionally simple: one JSON file, rewritten whole on every change. Table
 * actions are not schema-validated against real DB metadata here (this module has no DB
 * connections) - that happens where an action is created/executed (src/explorer/tableActions.js),
 * which does have adapter access.
 */
export class TableActionsStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.actions = this._load();
  }

  _load() {
    if (!fs.existsSync(this.filePath)) return [];
    const text = fs.readFileSync(this.filePath, 'utf8');
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (err) {
      const issues = new IssueCollector();
      issues.add('<root>', `table-actions.json is not valid JSON: ${err.message}`);
      issues.throwIfInvalid('table-actions.json');
    }
    const issues = validateTableActionsConfig(raw);
    issues.throwIfInvalid('table-actions.json');
    return raw.actions;
  }

  _save() {
    fs.writeFileSync(this.filePath, JSON.stringify({ actions: this.actions }, null, 2) + '\n', 'utf8');
  }

  listForTable(sourceId, schema, table) {
    return this.actions.filter((a) => a.sourceId === sourceId && a.schema === schema && a.table === table);
  }

  findForTable(actionId, sourceId, schema, table) {
    return this.actions.find((a) => a.id === actionId && a.sourceId === sourceId && a.schema === schema && a.table === table) ?? null;
  }

  add({ sourceId, schema, table, label, sql }) {
    const action = { id: crypto.randomUUID(), sourceId, schema, table, label, sql, createdAt: new Date().toISOString() };
    this.actions.push(action);
    this._save();
    return action;
  }

  remove(actionId) {
    const before = this.actions.length;
    this.actions = this.actions.filter((a) => a.id !== actionId);
    if (this.actions.length !== before) this._save();
  }
}

export function loadTableActionsStore({ filePath = contentPath('table-actions.json') } = {}) {
  return new TableActionsStore(filePath);
}
