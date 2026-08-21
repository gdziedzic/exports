// Rebuilds data/reference.db from scratch with a small, deliberately varied
// sample schema (composite keys, a generated column, a FK, a keyless table,
// a view) so the automatic explorer has something interesting to browse in
// development. Safe to re-run - deletes and recreates the file.
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { contentPath } from '../src/config/paths.js';

const dbPath = contentPath('data', 'reference.db');
fs.rmSync(dbPath, { force: true });
fs.rmSync(`${dbPath}-journal`, { force: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    qty INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total REAL GENERATED ALWAYS AS (qty * unit_price) STORED,
    ordered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE exchange_rates (
    currency_code TEXT PRIMARY KEY,
    rate REAL NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE tags (
    name TEXT PRIMARY KEY
  );

  CREATE TABLE order_tags (
    order_id INTEGER NOT NULL REFERENCES orders(id),
    tag TEXT NOT NULL REFERENCES tags(name),
    PRIMARY KEY (order_id, tag)
  );

  CREATE TABLE session_pings (
    ip TEXT NOT NULL,
    pinged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE VIEW active_customers AS
    SELECT id, name, email, created_at FROM customers WHERE is_active = 1;
`);

const insertCustomer = db.prepare('INSERT INTO customers (name, email, is_active) VALUES (@name, @email, @is_active)');
insertCustomer.run({ name: 'Alice Chen', email: 'alice@example.com', is_active: 1 });
insertCustomer.run({ name: 'Bilal Rahman', email: 'bilal@example.com', is_active: 1 });
insertCustomer.run({ name: 'Carmen Diaz', email: 'carmen@example.com', is_active: 0 });

const insertOrder = db.prepare(
  'INSERT INTO orders (customer_id, qty, unit_price) VALUES (@customer_id, @qty, @unit_price)',
);
insertOrder.run({ customer_id: 1, qty: 3, unit_price: 12.5 });
insertOrder.run({ customer_id: 1, qty: 1, unit_price: 89.99 });
insertOrder.run({ customer_id: 2, qty: 5, unit_price: 4.2 });

const insertRate = db.prepare('INSERT INTO exchange_rates (currency_code, rate) VALUES (@currency_code, @rate)');
insertRate.run({ currency_code: 'USD', rate: 1.0 });
insertRate.run({ currency_code: 'EUR', rate: 0.92 });
insertRate.run({ currency_code: 'GBP', rate: 0.79 });

const insertTag = db.prepare('INSERT INTO tags (name) VALUES (?)');
for (const tag of ['priority', 'wholesale', 'gift']) insertTag.run(tag);

const insertOrderTag = db.prepare('INSERT INTO order_tags (order_id, tag) VALUES (?, ?)');
insertOrderTag.run(1, 'priority');
insertOrderTag.run(1, 'gift');
insertOrderTag.run(2, 'wholesale');

const insertPing = db.prepare('INSERT INTO session_pings (ip) VALUES (?)');
insertPing.run('127.0.0.1');
insertPing.run('127.0.0.1');

db.close();
console.log(`Seeded ${dbPath}`);
