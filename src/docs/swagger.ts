export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Transaction Ledger System API',
    version: '1.0.0',
    description:
      'Backend API for a robust, ACID-compliant transaction ledger system with accounts, credits, debits, history pagination, and atomic money transfers.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  paths: {
    '/api/accounts': {
      post: {
        summary: 'Create a new account',
        description: 'Creates a new account with an initial balance of 0.',
        tags: ['Accounts'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: {
                    type: 'string',
                    example: 'Alice Smith',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Account created successfully',
          },
          '400': {
            description: 'Validation error (e.g. missing name or client attempting to set initial balance)',
          },
        },
      },
      get: {
        summary: 'List all accounts',
        tags: ['Accounts'],
        responses: {
          '200': {
            description: 'List of accounts',
          },
        },
      },
    },
    '/api/accounts/{id}': {
      get: {
        summary: 'Get account details',
        tags: ['Accounts'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Account details' },
          '404': { description: 'Account not found' },
        },
      },
    },
    '/api/accounts/{id}/balance': {
      get: {
        summary: 'Get account balance',
        tags: ['Accounts'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Current account balance' },
          '404': { description: 'Account not found' },
        },
      },
    },
    '/api/accounts/{accountId}/transactions': {
      post: {
        summary: 'Add a transaction to an account',
        tags: ['Transactions'],
        parameters: [
          {
            name: 'accountId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'amount', 'reference_id'],
                properties: {
                  type: {
                    type: 'string',
                    enum: ['credit', 'debit'],
                    example: 'credit',
                  },
                  amount: {
                    type: 'number',
                    example: 100.5,
                  },
                  description: {
                    type: 'string',
                    example: 'Salary deposit',
                  },
                  reference_id: {
                    type: 'string',
                    example: 'REF-001',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Transaction recorded successfully' },
          '400': { description: 'Validation error or Insufficient balance' },
          '404': { description: 'Account not found' },
          '409': { description: 'Duplicate reference_id for this account' },
        },
      },
      get: {
        summary: 'Get transaction history for an account',
        tags: ['Transactions'],
        parameters: [
          {
            name: 'accountId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'type',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['credit', 'debit'] },
          },
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          '200': { description: 'Paginated transactions list sorted latest-first' },
          '404': { description: 'Account not found' },
        },
      },
    },
    '/api/transactions': {
      post: {
        summary: 'Add a transaction (with account_id in body)',
        tags: ['Transactions'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['account_id', 'type', 'amount', 'reference_id'],
                properties: {
                  account_id: { type: 'string' },
                  type: { type: 'string', enum: ['credit', 'debit'] },
                  amount: { type: 'number', example: 50.0 },
                  description: { type: 'string' },
                  reference_id: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Transaction recorded successfully' },
          '400': { description: 'Validation error or Insufficient balance' },
          '404': { description: 'Account not found' },
          '409': { description: 'Duplicate reference_id for this account' },
        },
      },
    },
    '/api/transfers': {
      post: {
        summary: 'Transfer money between two accounts',
        tags: ['Transfers'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['source_account_id', 'destination_account_id', 'amount', 'reference_id'],
                properties: {
                  source_account_id: { type: 'string' },
                  destination_account_id: { type: 'string' },
                  amount: { type: 'number', example: 30.0 },
                  description: { type: 'string', example: 'Dinner share' },
                  reference_id: { type: 'string', example: 'TXFR-1001' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Transfer executed atomically' },
          '400': { description: 'Insufficient funds, invalid accounts, or validation error' },
          '404': { description: 'Source or destination account not found' },
          '409': { description: 'Duplicate reference_id' },
        },
      },
    },
  },
};
