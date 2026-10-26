-- ==============================================================================
-- TRANSACTION LEDGER SYSTEM - SUPABASE POSTGRESQL SCHEMA
-- Copy and run this entire script in Supabase Dashboard -> SQL Editor -> New Query
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Accounts Table
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Transfers Table (Bonus Money Transfer Feature)
CREATE TABLE IF NOT EXISTS public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  destination_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount BIGINT NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  reference_id VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_diff_accounts CHECK (source_account_id <> destination_account_id)
);

-- 4. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  type VARCHAR(10) NOT NULL CHECK (type IN ('credit', 'debit')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  reference_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transfer_id UUID NULL REFERENCES public.transfers(id) ON DELETE RESTRICT,
  CONSTRAINT unique_account_reference UNIQUE (account_id, reference_id)
);

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_account_created 
  ON public.transactions(account_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_account_type_created 
  ON public.transactions(account_id, type, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_transfers_source 
  ON public.transfers(source_account_id);

CREATE INDEX IF NOT EXISTS idx_transfers_dest 
  ON public.transfers(destination_account_id);

-- 6. Immutability Trigger Function
CREATE OR REPLACE FUNCTION public.prevent_transaction_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Transactions and transfers are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

-- 7. Immutability Triggers for Transactions
DROP TRIGGER IF EXISTS trg_prevent_transaction_update ON public.transactions;
CREATE TRIGGER trg_prevent_transaction_update
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_transaction_modification();

DROP TRIGGER IF EXISTS trg_prevent_transaction_delete ON public.transactions;
CREATE TRIGGER trg_prevent_transaction_delete
BEFORE DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_transaction_modification();

-- 8. Immutability Triggers for Transfers
DROP TRIGGER IF EXISTS trg_prevent_transfer_update ON public.transfers;
CREATE TRIGGER trg_prevent_transfer_update
BEFORE UPDATE ON public.transfers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_transaction_modification();

DROP TRIGGER IF EXISTS trg_prevent_transfer_delete ON public.transfers;
CREATE TRIGGER trg_prevent_transfer_delete
BEFORE DELETE ON public.transfers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_transaction_modification();

-- 9. Verification Query
SELECT 
  'Schema deployed successfully!' as status,
  COUNT(*) as existing_accounts 
FROM public.accounts;
