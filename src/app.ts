import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import swaggerUi from 'swagger-ui-express';
import { AccountController } from './controllers/account.controller.js';
import { TransactionController } from './controllers/transaction.controller.js';
import { TransferController } from './controllers/transfer.controller.js';
import { getDatabase } from './db/database.js';
import { openApiSpec } from './docs/swagger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { AccountRepository } from './repositories/account.repository.js';
import { TransactionRepository } from './repositories/transaction.repository.js';
import { TransferRepository } from './repositories/transfer.repository.js';
import { createApiRouter } from './routes/index.js';
import { AccountService } from './services/account.service.js';
import { LedgerService } from './services/ledger.service.js';
import { TransferService } from './services/transfer.service.js';

export function createApp(db?: DatabaseSync): Express {
  const database = db || getDatabase();

  // Instantiate Repositories
  const accountRepo = new AccountRepository(database);
  const transactionRepo = new TransactionRepository(database);
  const transferRepo = new TransferRepository(database);

  // Instantiate Services
  const accountService = new AccountService(accountRepo);
  const ledgerService = new LedgerService(database, accountRepo, transactionRepo);
  const transferService = new TransferService(database, accountRepo, transactionRepo, transferRepo);

  // Instantiate Controllers
  const accountController = new AccountController(accountService);
  const transactionController = new TransactionController(ledgerService);
  const transferController = new TransferController(transferService);

  const app = express();

  // Standard middleware
  app.use(cors());
  app.use(express.json());

  // Determine public folder path
  let publicPath = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicPath)) {
    try {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const altPath = path.resolve(currentDir, '../public');
      if (fs.existsSync(altPath)) {
        publicPath = altPath;
      }
    } catch {
      // fallback to cwd/public
    }
  }

  // Serve static assets from public/
  app.use(express.static(publicPath));

  // Swagger UI and OpenAPI documentation
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/api/docs/json', (_req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  // Explicit Immutability Protection for Ledger Entries
  const rejectMutation = (_req: Request, res: Response) => {
    res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Transactions and accounts are immutable and cannot be updated or deleted via API.',
      },
    });
  };

  app.all('/api/transactions/:id', (req, res, next) => {
    if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return rejectMutation(req, res);
    }
    next();
  });

  app.all('/api/accounts/:accountId/transactions/:id', (req, res, next) => {
    if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return rejectMutation(req, res);
    }
    next();
  });

  app.all('/api/accounts/:id', (req, res, next) => {
    if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return rejectMutation(req, res);
    }
    next();
  });

  // Mount API Router
  app.use(
    '/api',
    createApiRouter({
      accountController,
      transactionController,
      transferController,
    })
  );

  // Root endpoint: serve web dashboard if HTML accepted and index.html exists
  app.get('/', (req: Request, res: Response) => {
    const indexPath = path.join(publicPath, 'index.html');
    if (req.accepts('html') && fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.json({
        name: 'Transaction Ledger System API',
        status: 'active',
        docs: '/docs',
        health: '/api/health',
      });
    }
  });

  // 404 Route Not Found
  app.use(notFoundHandler);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
