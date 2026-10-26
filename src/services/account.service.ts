import { v4 as uuidv4 } from 'uuid';
import { AccountRepository } from '../repositories/account.repository.js';
import { Account, AccountBalanceResponse, CreateAccountDTO } from '../types/account.js';
import { fromCents } from '../utils/currency.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export class AccountService {
  constructor(private accountRepo: AccountRepository) {}

  createAccount(dto: CreateAccountDTO): Account {
    const trimmedName = dto.name?.trim();
    if (!trimmedName) {
      throw new ValidationError('Account holder name is required');
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    // Initial balance is strictly 0 cents
    const balanceCents = 0;

    const created = this.accountRepo.create({
      id,
      name: trimmedName,
      balance_cents: balanceCents,
      created_at: createdAt,
    });

    return {
      id: created.id,
      name: created.name,
      balance: fromCents(created.balance_cents),
      created_at: created.created_at,
    };
  }

  getAccountById(id: string): Account {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('Account ID must be provided');
    }

    const account = this.accountRepo.findById(id);
    if (!account) {
      throw new NotFoundError(`Account with ID '${id}' not found`, 'ACCOUNT_NOT_FOUND');
    }

    return {
      id: account.id,
      name: account.name,
      balance: fromCents(account.balance_cents),
      created_at: account.created_at,
    };
  }

  getAccountBalance(id: string): AccountBalanceResponse {
    const account = this.getAccountById(id);
    return {
      account_id: account.id,
      balance: account.balance,
    };
  }

  listAccounts(): Account[] {
    const accounts = this.accountRepo.findAll();
    return accounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
      balance: fromCents(acc.balance_cents),
      created_at: acc.created_at,
    }));
  }
}
