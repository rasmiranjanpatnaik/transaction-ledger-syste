import { DatabaseSync } from 'node:sqlite';
import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../db/database.js';
import { AccountRepository } from '../repositories/account.repository.js';
import { TransactionRepository } from '../repositories/transaction.repository.js';
import { TransferRepository } from '../repositories/transfer.repository.js';
import { CreateTransferDTO, Transfer, TransferResult } from '../types/transfer.js';
import { fromCents, toCents } from '../utils/currency.js';
import {
  BadRequestError,
  DuplicateError,
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
} from '../utils/errors.js';

export class TransferService {
  constructor(
    private db: DatabaseSync,
    private accountRepo: AccountRepository,
    private transactionRepo: TransactionRepository,
    private transferRepo: TransferRepository
  ) {}

  /**
   * Executes an atomic money transfer between two accounts.
   */
  transferMoney(dto: CreateTransferDTO): TransferResult {
    const sourceId = dto.source_account_id?.trim();
    const destId = dto.destination_account_id?.trim();
    const referenceId = dto.reference_id?.trim();
    const description = (dto.description || '').trim();

    if (!sourceId) {
      throw new ValidationError('source_account_id is required');
    }
    if (!destId) {
      throw new ValidationError('destination_account_id is required');
    }
    if (sourceId === destId) {
      throw new BadRequestError('Source and destination accounts must be different', 'IDENTICAL_ACCOUNTS');
    }
    if (!referenceId) {
      throw new ValidationError('reference_id is required');
    }

    const amountCents = toCents(dto.amount);

    return withTransaction(this.db, () => {
      // Check duplicate transfer reference_id
      const existingTransfer = this.transferRepo.findByReferenceId(referenceId);
      if (existingTransfer) {
        throw new DuplicateError(
          `Transfer with reference_id '${referenceId}' already exists`,
          'DUPLICATE_TRANSFER_REFERENCE'
        );
      }

      // Verify both accounts exist
      const sourceAccount = this.accountRepo.findById(sourceId);
      if (!sourceAccount) {
        throw new NotFoundError(`Source account with ID '${sourceId}' not found`, 'SOURCE_ACCOUNT_NOT_FOUND');
      }

      const destAccount = this.accountRepo.findById(destId);
      if (!destAccount) {
        throw new NotFoundError(`Destination account with ID '${destId}' not found`, 'DEST_ACCOUNT_NOT_FOUND');
      }

      // Check sufficient funds in source account
      if (sourceAccount.balance_cents < amountCents) {
        throw new InsufficientFundsError(
          `Source account has insufficient balance. Current: ${fromCents(sourceAccount.balance_cents)}, requested transfer: ${fromCents(amountCents)}`
        );
      }

      // Perform debit on source account
      const debitOk = this.accountRepo.debitBalance(sourceId, amountCents);
      if (!debitOk) {
        throw new InsufficientFundsError('Failed to debit source account due to insufficient balance');
      }

      // Perform credit on destination account
      const creditOk = this.accountRepo.creditBalance(destId, amountCents);
      if (!creditOk) {
        throw new ValidationError('Failed to credit destination account');
      }

      const transferId = uuidv4();
      const createdAt = new Date().toISOString();

      // Record transfer entity
      try {
        this.transferRepo.create({
          id: transferId,
          source_account_id: sourceId,
          destination_account_id: destId,
          amount_cents: amountCents,
          description,
          reference_id: referenceId,
          created_at: createdAt,
        });
      } catch (err: unknown) {
        const errMessage = (err as Error)?.message || '';
        if (errMessage.includes('UNIQUE constraint failed')) {
          throw new DuplicateError(
            `Transfer with reference_id '${referenceId}' already exists`,
            'DUPLICATE_TRANSFER_REFERENCE'
          );
        }
        throw err;
      }

      // Create ledger transaction for source account (Debit)
      const debitTxId = uuidv4();
      const sourceTxRef = `txfr_${referenceId}_debit`;
      const debitDesc = description ? `Transfer to ${destAccount.name}: ${description}` : `Transfer to ${destAccount.name}`;
      this.transactionRepo.create({
        id: debitTxId,
        account_id: sourceId,
        type: 'debit',
        amount_cents: amountCents,
        description: debitDesc,
        reference_id: sourceTxRef,
        created_at: createdAt,
        transfer_id: transferId,
      });

      // Create ledger transaction for destination account (Credit)
      const creditTxId = uuidv4();
      const destTxRef = `txfr_${referenceId}_credit`;
      const creditDesc = description ? `Transfer from ${sourceAccount.name}: ${description}` : `Transfer from ${sourceAccount.name}`;
      this.transactionRepo.create({
        id: creditTxId,
        account_id: destId,
        type: 'credit',
        amount_cents: amountCents,
        description: creditDesc,
        reference_id: destTxRef,
        created_at: createdAt,
        transfer_id: transferId,
      });

      const updatedSource = this.accountRepo.findById(sourceId)!;
      const updatedDest = this.accountRepo.findById(destId)!;

      const transfer: Transfer = {
        id: transferId,
        source_account_id: sourceId,
        destination_account_id: destId,
        amount: fromCents(amountCents),
        description,
        reference_id: referenceId,
        created_at: createdAt,
      };

      return {
        transfer,
        source_new_balance: fromCents(updatedSource.balance_cents),
        destination_new_balance: fromCents(updatedDest.balance_cents),
      };
    });
  }
}
