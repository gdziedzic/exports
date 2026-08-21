import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateTableActionsConfig, loadTableActionsStore, TableActionsStore } from '../../src/config/tableActions.js';

function tmpFilePath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-table-actions-')), 'table-actions.json');
}

test('validateTableActionsConfig accepts a well-formed config', () => {
  const config = {
    actions: [
      { id: 'a1', sourceId: 's', schema: 'main', table: 'products', label: 'Increment', sql: 'UPDATE products SET stock = stock + 1 WHERE id = @id' },
    ],
  };
  const issues = validateTableActionsConfig(config);
  assert.ok(issues.ok, JSON.stringify(issues.issues));
});

test('validateTableActionsConfig rejects a non-array root', () => {
  assert.ok(!validateTableActionsConfig({}).ok);
  assert.ok(!validateTableActionsConfig({ actions: 'nope' }).ok);
});

test('validateTableActionsConfig rejects an action missing required fields', () => {
  const issues = validateTableActionsConfig({ actions: [{ id: 'a1' }] });
  assert.ok(!issues.ok);
  assert.ok(issues.issues.some((i) => i.path === 'actions[0].sourceId'));
  assert.ok(issues.issues.some((i) => i.path === 'actions[0].label'));
  assert.ok(issues.issues.some((i) => i.path === 'actions[0].sql'));
});

test('validateTableActionsConfig rejects duplicate ids', () => {
  const action = { id: 'dup', sourceId: 's', schema: 'main', table: 't', label: 'L', sql: 'SELECT 1' };
  const issues = validateTableActionsConfig({ actions: [action, { ...action }] });
  assert.ok(!issues.ok);
  assert.ok(issues.issues.some((i) => i.message.includes('duplicate')));
});

test('loadTableActionsStore returns an empty store when the file does not exist', () => {
  const store = loadTableActionsStore({ filePath: tmpFilePath() });
  assert.deepEqual(store.actions, []);
});

test('TableActionsStore.add persists the action to disk immediately, and a fresh store reads it back (survives a restart)', () => {
  const filePath = tmpFilePath();
  const store = new TableActionsStore(filePath);
  const action = store.add({ sourceId: 's1', schema: 'main', table: 'products', label: 'Increment stock', sql: 'UPDATE products SET stock = stock + 1 WHERE id = @id' });

  assert.ok(fs.existsSync(filePath));
  const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(onDisk.actions.length, 1);
  assert.equal(onDisk.actions[0].id, action.id);

  // Simulates a restart: a brand new store instance reading the same file.
  const reloaded = new TableActionsStore(filePath);
  assert.equal(reloaded.actions.length, 1);
  assert.deepEqual(reloaded.listForTable('s1', 'main', 'products'), [action]);
});

test('TableActionsStore.listForTable scopes by sourceId/schema/table', () => {
  const store = new TableActionsStore(tmpFilePath());
  store.add({ sourceId: 's1', schema: 'main', table: 'products', label: 'A', sql: 'SELECT 1' });
  store.add({ sourceId: 's1', schema: 'main', table: 'orders', label: 'B', sql: 'SELECT 1' });
  store.add({ sourceId: 's2', schema: 'main', table: 'products', label: 'C', sql: 'SELECT 1' });

  const forProducts = store.listForTable('s1', 'main', 'products');
  assert.equal(forProducts.length, 1);
  assert.equal(forProducts[0].label, 'A');
});

test('TableActionsStore.remove deletes the action and persists the removal', () => {
  const filePath = tmpFilePath();
  const store = new TableActionsStore(filePath);
  const action = store.add({ sourceId: 's1', schema: 'main', table: 'products', label: 'A', sql: 'SELECT 1' });
  store.remove(action.id);

  assert.equal(store.actions.length, 0);
  const reloaded = new TableActionsStore(filePath);
  assert.equal(reloaded.actions.length, 0);
});

test('loading a malformed table-actions.json throws with a clear message', () => {
  const filePath = tmpFilePath();
  fs.writeFileSync(filePath, 'not json');
  assert.throws(() => new TableActionsStore(filePath), /table-actions\.json/);
});
