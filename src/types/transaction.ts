export type TransactionType = 'credit' | 'debit';

export interface Transaction {
  id: string;
  account_id: string;
  type: TransactionType;
  amount: number;
  description: string;
  reference_id: string;
  created_at: string;
  transfer_id?: string | null;
}

export interface TransactionEntity {
  id: string;
  account_id: string;
  type: TransactionType;
  amount_cents: number;
  description: string;
  reference_id: string;
  created_at: string;
  transfer_id: string | null;
}

export interface CreateTransactionDTO {
  account_id?: string;
  type: TransactionType;
  amount: number;
  description?: string;
  reference_id: string;
}

export interface TransactionCreatedResult {
  transaction: Transaction;
  new_balance: number;
}

export interface TransactionQueryFilters {
  account_id: string;
  type?: TransactionType;
  page: number;
  limit: number;
}
