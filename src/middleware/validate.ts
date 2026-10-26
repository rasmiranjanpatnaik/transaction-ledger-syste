import { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

export const createAccountSchema = z.object({
  body: z
    .object({
      name: z
        .string({ message: 'Account name must be a string' })
        .trim()
        .min(1, 'Account name cannot be empty')
        .max(100, 'Account name must not exceed 100 characters'),
      balance: z.any().optional(),
    })
    .superRefine((data, ctx) => {
      if ('balance' in data && data.balance !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Client is not allowed to set the initial balance. Initial balance must always be 0.',
          path: ['balance'],
        });
      }
    }),
});

export const createTransactionSchema = z.object({
  body: z.object({
    account_id: z.string({ message: 'Account ID must be a string' }).trim().min(1, 'Account ID must not be empty').optional(),
    type: z
      .string({ message: "Transaction type is required ('credit' or 'debit')" })
      .trim()
      .toLowerCase()
      .refine((val) => val === 'credit' || val === 'debit', {
        message: "Transaction type must be either 'credit' or 'debit'",
      }),
    amount: z
      .number({ message: 'Transaction amount must be a number' })
      .positive('Transaction amount must be greater than 0')
      .max(100_000_000_000, 'Transaction amount cannot exceed $100,000,000,000')
      .refine((val) => Number.isFinite(val), {
        message: 'Transaction amount must be a finite number',
      })
      .refine((val) => Math.abs(val * 100 - Math.round(val * 100)) < 1e-6, {
        message: 'Transaction amount cannot have more than 2 decimal places',
      }),
    reference_id: z
      .string({ message: 'reference_id must be a string' })
      .trim()
      .min(1, 'reference_id cannot be empty')
      .max(100, 'reference_id must not exceed 100 characters'),
    description: z
      .string({ message: 'Description must be a string' })
      .trim()
      .max(255, 'Description must not exceed 255 characters')
      .optional()
      .default(''),
  }),
});

export const getTransactionsQuerySchema = z.object({
  query: z.object({
    type: z
      .string()
      .trim()
      .toLowerCase()
      .refine((val) => val === 'credit' || val === 'debit', {
        message: "Filter type must be either 'credit' or 'debit'",
      })
      .optional(),
    page: z
      .string()
      .optional()
      .transform((val) => (val !== undefined ? Number(val) : 1))
      .refine((val) => Number.isInteger(val) && val >= 1, {
        message: 'Page must be an integer greater than or equal to 1',
      }),
    limit: z
      .string()
      .optional()
      .transform((val) => (val !== undefined ? Number(val) : 20))
      .refine((val) => Number.isInteger(val) && val >= 1 && val <= 100, {
        message: 'Limit must be an integer between 1 and 100',
      }),
  }),
});

export const createTransferSchema = z.object({
  body: z
    .object({
      source_account_id: z
        .string({ message: 'source_account_id must be a string' })
        .trim()
        .min(1, 'source_account_id cannot be empty'),
      destination_account_id: z
        .string({ message: 'destination_account_id must be a string' })
        .trim()
        .min(1, 'destination_account_id cannot be empty'),
      amount: z
        .number({ message: 'Transfer amount must be a number' })
        .positive('Transfer amount must be greater than 0')
        .max(100_000_000_000, 'Transfer amount cannot exceed $100,000,000,000')
        .refine((val) => Number.isFinite(val), {
          message: 'Transfer amount must be a finite number',
        })
        .refine((val) => Math.abs(val * 100 - Math.round(val * 100)) < 1e-6, {
          message: 'Transfer amount cannot have more than 2 decimal places',
        }),
      reference_id: z
        .string({ message: 'reference_id must be a string' })
        .trim()
        .min(1, 'reference_id cannot be empty')
        .max(100, 'reference_id must not exceed 100 characters'),
      description: z.string().trim().max(255).optional().default(''),
    })
    .refine((data) => data.source_account_id !== data.destination_account_id, {
      message: 'Source and destination accounts must be different',
      path: ['destination_account_id'],
    }),
});

export function validate(schema: z.ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as { body?: unknown; query?: Record<string, unknown> };

      if (parsed.body) {
        req.body = parsed.body;
      }
      if (parsed.query && req.query) {
        for (const [key, val] of Object.entries(parsed.query)) {
          (req.query as Record<string, unknown>)[key] = val;
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((i) => ({
          field: i.path.join('.').replace(/^(body|query|params)\./, ''),
          message: i.message,
        }));
        const primaryMessage = issues[0]?.message || 'Validation error';
        next(new ValidationError(primaryMessage, issues));
      } else {
        next(error);
      }
    }
  };
}
