import { Router } from 'express';
import { TransferController } from '../controllers/transfer.controller.js';
import { createTransferSchema, validate } from '../middleware/validate.js';

export function createTransferRoutes(transferController: TransferController): Router {
  const router = Router();

  // Execute money transfer
  router.post('/', validate(createTransferSchema), transferController.transferMoney);

  return router;
}
