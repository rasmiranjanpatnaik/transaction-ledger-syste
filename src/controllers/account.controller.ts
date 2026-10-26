import { NextFunction, Request, Response } from 'express';
import { AccountService } from '../services/account.service.js';
import { successResponse } from '../utils/response.js';

export class AccountController {
  constructor(private accountService: AccountService) {}

  createAccount = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const account = this.accountService.createAccount(req.body);
      res.status(201).json(successResponse(account));
    } catch (error) {
      next(error);
    }
  };

  getAccountBalance = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const accountId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const balanceData = this.accountService.getAccountBalance(accountId);
      res.status(200).json(successResponse(balanceData));
    } catch (error) {
      next(error);
    }
  };

  getAccountById = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const accountId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const account = this.accountService.getAccountById(accountId);
      res.status(200).json(successResponse(account));
    } catch (error) {
      next(error);
    }
  };

  listAccounts = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const accounts = this.accountService.listAccounts();
      res.status(200).json(successResponse(accounts));
    } catch (error) {
      next(error);
    }
  };
}
