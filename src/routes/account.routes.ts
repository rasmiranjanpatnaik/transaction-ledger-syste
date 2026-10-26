import { Router } from 'express';
import { AccountController } from '../controllers/account.controller.js';
import { TransactionController } from '../controllers/transaction.controller.js';
import {
  createAccountSchema,
  createTransactionSchema,
  getTransactionsQuerySchema,
  validate,
} from '../middleware/validate.js';

export function createAccountRoutes(
  accountController: AccountController,
  transactionController: TransactionController
): Router {
  const router = Router();

  // Create new account
  router.post('/', validate(createAccountSchema), accountController.createAccount);

  // List all accounts
  router.get('/', accountController.listAccounts);

  // Get account balance
  router.get('/:id/balance', accountController.getAccountBalance);

  // Get account details
  router.get('/:id', accountController.getAccountById);

  // Add transaction to account (sub-resource route)
  router.post('/:accountId/transactions', validate(createTransactionSchema), transactionController.addTransaction);

  // Get transaction history for account
  router.get(
    '/:accountId/transactions',
    validate(getTransactionsQuerySchema),
    transactionController.getTransactionHistory
  );

  return router;
}
