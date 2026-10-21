import { DatabaseSync } from "node:sqlite";

export const db = new DatabaseSync(":memory:");

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash BLOB NOT NULL,
    street TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT
  ) STRICT;

  CREATE TABLE accounts (
    customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    account_number TEXT NOT NULL UNIQUE,
    balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
    loan_balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (loan_balance_cents >= 0)
  ) STRICT;

  CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE
  ) STRICT;

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (
      type IN ('DEPOSIT', 'WITHDRAWAL', 'LOAN_DRAW', 'LOAN_PAYMENT', 'WIRE_IN', 'WIRE_OUT')
    ),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    direction TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    resulting_balance_cents INTEGER NOT NULL CHECK (resulting_balance_cents >= 0),
    memo TEXT,
    wire_id TEXT
  ) STRICT;

  CREATE INDEX transactions_by_customer
    ON transactions(customer_id, id DESC);

  CREATE TABLE avatars (
    customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg')),
    data BLOB NOT NULL
  ) STRICT;
`);

export function withDatabaseTransaction<T>(operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
