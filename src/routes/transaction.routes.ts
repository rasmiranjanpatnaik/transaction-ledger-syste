import { Router } from 'express';
import { TransactionController } from '../controllers/transaction.controller.js';
import { createTransactionSchema, validate } from '../middleware/validate.js';

export function createTransactionRoutes(transactionController: TransactionController): Router {
  const router = Router();

  // Add transaction (root route with account_id in body)
  router.post('/', validate(createTransactionSchema), transactionController.addTransaction);

  return router;
}
