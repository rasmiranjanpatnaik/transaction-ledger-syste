import { NextFunction, Request, Response } from 'express';
import { TransferService } from '../services/transfer.service.js';
import { successResponse } from '../utils/response.js';

export class TransferController {
  constructor(private transferService: TransferService) {}

  transferMoney = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = this.transferService.transferMoney(req.body);
      res.status(201).json(
        successResponse({
          ...result.transfer,
          source_new_balance: result.source_new_balance,
          destination_new_balance: result.destination_new_balance,
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
