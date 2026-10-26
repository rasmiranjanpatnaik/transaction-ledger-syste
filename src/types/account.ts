export interface Account {
  id: string;
  name: string;
  balance: number;
  created_at: string;
}

export interface AccountEntity {
  id: string;
  name: string;
  balance_cents: number;
  created_at: string;
}

export interface CreateAccountDTO {
  name: string;
}

export interface AccountBalanceResponse {
  account_id: string;
  balance: number;
}
