import { NextFunction, Request, Response } from 'express';
import { LedgerService } from '../services/ledger.service.js';
import { TransactionType } from '../types/transaction.js';
import { BadRequestError } from '../utils/errors.js';
import { successResponse } from '../utils/response.js';

export class TransactionController {
  constructor(private ledgerService: LedgerService) {}

  addTransaction = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const paramAccountId = Array.isArray(req.params.accountId)
        ? req.params.accountId[0]
        : req.params.accountId;
      const bodyAccountId = req.body.account_id;

      if (paramAccountId && bodyAccountId && paramAccountId !== bodyAccountId) {
        throw new BadRequestError(
          `Account ID in URL ('${paramAccountId}') does not match account_id in request body ('${bodyAccountId}')`,
          'ACCOUNT_ID_MISMATCH'
        );
      }

      const accountId = paramAccountId || bodyAccountId;

      const result = this.ledgerService.addTransaction({
        ...req.body,
        account_id: accountId,
      });

      res.status(201).json(
        successResponse({
          ...result.transaction,
          account_balance: result.new_balance,
        })
      );
    } catch (error) {
      next(error);
    }
  };

  getTransactionHistory = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const accountId = Array.isArray(req.params.accountId)
        ? req.params.accountId[0]
        : req.params.accountId;
      const type = req.query.type as TransactionType | undefined;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      const response = this.ledgerService.getTransactionHistory({
        account_id: accountId,
        type,
        page,
        limit,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}
