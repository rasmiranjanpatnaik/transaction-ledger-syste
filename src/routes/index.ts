import { Router } from 'express';
import { AccountController } from '../controllers/account.controller.js';
import { TransactionController } from '../controllers/transaction.controller.js';
import { TransferController } from '../controllers/transfer.controller.js';
import { createAccountRoutes } from './account.routes.js';
import { createTransactionRoutes } from './transaction.routes.js';
import { createTransferRoutes } from './transfer.routes.js';

export interface AppControllers {
  accountController: AccountController;
  transactionController: TransactionController;
  transferController: TransferController;
}

export function createApiRouter(controllers: AppControllers): Router {
  const router = Router();

  router.use('/accounts', createAccountRoutes(controllers.accountController, controllers.transactionController));
  router.use('/transactions', createTransactionRoutes(controllers.transactionController));
  router.use('/transfers', createTransferRoutes(controllers.transferController));

  // Health check endpoint
  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'Transaction Ledger System',
    });
  });

  return router;
}
