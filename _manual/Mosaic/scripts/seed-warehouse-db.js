// Rebuilds data/warehouse.db - a second, independent SQLite database used to
// demonstrate a configured page pulling blocks from two different database
// sources (see pages/operations-overview). Safe to re-run.
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { contentPath } from '../src/config/paths.js';

const dbPath = contentPath('data', 'warehouse.db');
fs.rmSync(dbPath, { force: true });
fs.rmSync(`${dbPath}-journal`, { force: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE stock_levels (
    sku TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const insert = db.prepare('INSERT INTO stock_levels (sku, description, quantity) VALUES (?, ?, ?)');
insert.run('SKU-1001', 'Trail Runner 200', 42);
insert.run('SKU-1002', 'Summit Pack, 30L', 7);
insert.run('SKU-1004', 'Camp Stove Mini', 15);

db.close();
console.log(`Seeded ${dbPath}`);
