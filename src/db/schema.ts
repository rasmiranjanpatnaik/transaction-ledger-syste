export const SCHEMA_SQL = `
-- Enforce Foreign Keys
PRAGMA foreign_keys = ON;

-- Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TEXT NOT NULL
);

-- Transfers Table (for Money Transfer Bonus)
CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  source_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  destination_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  reference_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  CONSTRAINT chk_diff_accounts CHECK (source_account_id <> destination_account_id)
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  reference_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  transfer_id TEXT NULL REFERENCES transfers(id) ON DELETE RESTRICT,
  CONSTRAINT unique_account_reference UNIQUE (account_id, reference_id)
);

-- Indexes for performance & latest-first sorting
CREATE INDEX IF NOT EXISTS idx_transactions_account_created 
  ON transactions(account_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_account_type_created 
  ON transactions(account_id, type, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_transfers_source 
  ON transfers(source_account_id);

CREATE INDEX IF NOT EXISTS idx_transfers_dest 
  ON transfers(destination_account_id);

-- Immutability Triggers for Transactions
CREATE TRIGGER IF NOT EXISTS trg_prevent_transaction_update
BEFORE UPDATE ON transactions
BEGIN
  SELECT RAISE(ABORT, 'Transactions are immutable and cannot be modified');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_transaction_delete
BEFORE DELETE ON transactions
BEGIN
  SELECT RAISE(ABORT, 'Transactions are immutable and cannot be deleted');
END;

-- Immutability Triggers for Transfers
CREATE TRIGGER IF NOT EXISTS trg_prevent_transfer_update
BEFORE UPDATE ON transfers
BEGIN
  SELECT RAISE(ABORT, 'Transfers are immutable and cannot be modified');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_transfer_delete
BEFORE DELETE ON transfers
BEGIN
  SELECT RAISE(ABORT, 'Transfers are immutable and cannot be deleted');
END;
`;
