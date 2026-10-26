export interface Transfer {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  description: string;
  reference_id: string;
  created_at: string;
}

export interface TransferEntity {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount_cents: number;
  description: string;
  reference_id: string;
  created_at: string;
}

export interface CreateTransferDTO {
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  description?: string;
  reference_id: string;
}

export interface TransferResult {
  transfer: Transfer;
  source_new_balance: number;
  destination_new_balance: number;
}
