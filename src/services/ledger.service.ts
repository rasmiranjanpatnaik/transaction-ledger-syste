import { DatabaseSync } from 'node:sqlite';
import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../db/database.js';
import { AccountRepository } from '../repositories/account.repository.js';
import { TransactionRepository } from '../repositories/transaction.repository.js';
import { PaginatedApiResponse } from '../types/common.js';
import {
  CreateTransactionDTO,
  Transaction,
  TransactionCreatedResult,
  TransactionQueryFilters,
} from '../types/transaction.js';
import { fromCents, toCents } from '../utils/currency.js';
import { DuplicateError, InsufficientFundsError, NotFoundError, ValidationError } from '../utils/errors.js';
import { paginatedResponse } from '../utils/response.js';

export class LedgerService {
  constructor(
    private db: DatabaseSync,
    private accountRepo: AccountRepository,
    private transactionRepo: TransactionRepository
  ) {}

  /**
   * Adds a transaction (credit or debit) to an account atomically.
   */
  addTransaction(dto: CreateTransactionDTO): TransactionCreatedResult {
    const accountId = dto.account_id?.trim();
    if (!accountId) {
      throw new ValidationError('Account ID is required');
    }

    const referenceId = dto.reference_id?.trim();
    if (!referenceId) {
      throw new ValidationError('Transaction reference_id is required');
    }

    const type = dto.type?.toLowerCase();
    if (type !== 'credit' && type !== 'debit') {
      throw new ValidationError("Transaction type must be either 'credit' or 'debit'");
    }

    const amountCents = toCents(dto.amount);
    const description = (dto.description || '').trim();

    // Execute atomically inside an IMMEDIATE transaction
    return withTransaction(this.db, () => {
      // 1. Verify account exists
      const account = this.accountRepo.findById(accountId);
      if (!account) {
        throw new NotFoundError(`Account with ID '${accountId}' not found`, 'ACCOUNT_NOT_FOUND');
      }

      // 2. Check for duplicate reference_id for this account
      const existingTx = this.transactionRepo.findByReferenceId(accountId, referenceId);
      if (existingTx) {
        throw new DuplicateError(
          `Transaction with reference_id '${referenceId}' already exists for account '${accountId}'`,
          'DUPLICATE_REFERENCE_ID'
        );
      }

      // 3. Balance verification and atomic update
      if (type === 'debit') {
        if (account.balance_cents < amountCents) {
          throw new InsufficientFundsError(
            `Insufficient balance. Current balance: ${fromCents(account.balance_cents)}, requested debit: ${fromCents(amountCents)}`
          );
        }

        const success = this.accountRepo.debitBalance(accountId, amountCents);
        if (!success) {
          throw new InsufficientFundsError('Insufficient balance for debit transaction');
        }
      } else {
        const success = this.accountRepo.creditBalance(accountId, amountCents);
        if (!success) {
          throw new ValidationError('Failed to credit account balance');
        }
      }

      // 4. Record the immutable transaction
      const txId = uuidv4();
      const createdAt = new Date().toISOString();

      try {
        this.transactionRepo.create({
          id: txId,
          account_id: accountId,
          type,
          amount_cents: amountCents,
          description,
          reference_id: referenceId,
          created_at: createdAt,
          transfer_id: null,
        });
      } catch (err: unknown) {
        const errMessage = (err as Error)?.message || '';
        if (errMessage.includes('UNIQUE constraint failed')) {
          throw new DuplicateError(
            `Transaction with reference_id '${referenceId}' already exists for account '${accountId}'`,
            'DUPLICATE_REFERENCE_ID'
          );
        }
        throw err;
      }

      // 5. Fetch updated balance
      const updatedAccount = this.accountRepo.findById(accountId)!;
      const newBalance = fromCents(updatedAccount.balance_cents);

      const transaction: Transaction = {
        id: txId,
        account_id: accountId,
        type,
        amount: fromCents(amountCents),
        description,
        reference_id: referenceId,
        created_at: createdAt,
      };

      return {
        transaction,
        new_balance: newBalance,
      };
    });
  }

  /**
   * Retrieves paginated and filtered transaction history for an account.
   */
  getTransactionHistory(filters: TransactionQueryFilters): PaginatedApiResponse<Transaction> {
    const accountId = filters.account_id?.trim();
    if (!accountId) {
      throw new ValidationError('Account ID is required');
    }

    // Verify account exists
    const account = this.accountRepo.findById(accountId);
    if (!account) {
      throw new NotFoundError(`Account with ID '${accountId}' not found`, 'ACCOUNT_NOT_FOUND');
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));

    if (filters.type && filters.type !== 'credit' && filters.type !== 'debit') {
      throw new ValidationError("Filter type must be either 'credit' or 'debit'");
    }

    const { transactions, total } = this.transactionRepo.findByAccount({
      account_id: accountId,
      type: filters.type,
      page,
      limit,
    });

    const formattedTransactions: Transaction[] = transactions.map((t) => ({
      id: t.id,
      account_id: t.account_id,
      type: t.type,
      amount: fromCents(t.amount_cents),
      description: t.description,
      reference_id: t.reference_id,
      created_at: t.created_at,
      ...(t.transfer_id ? { transfer_id: t.transfer_id } : {}),
    }));

    return paginatedResponse(formattedTransactions, page, limit, total);
  }
}
