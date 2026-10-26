# Transaction Ledger System API

A backend API for an ACID-compliant, robust, and production-ready **Transaction Ledger System**. Built with **TypeScript**, **Node.js**, **Express**, and **SQLite** (using Node 24 native `DatabaseSync` with Write-Ahead Logging).

---

## 🚀 Key Highlights & Design Decisions

### 1. Data Integrity & ACID Atomicity
- **Immediate Transactions**: All state-modifying operations (transactions, account updates, transfers) execute within an atomic `BEGIN IMMEDIATE` transaction block with automatic `ROLLBACK` on failure.
- **Check Constraints**: Database enforces `CHECK (balance >= 0)` on accounts and `CHECK (amount > 0)` on transactions. An overdraft is physically prevented by both business logic and database constraints.
- **Floating-point Drift Prevention**: All monetary amounts are computed and stored as **integer cents** (minor units) in SQLite and converted on API boundaries. This avoids IEEE-754 precision drift (e.g. `0.1 + 0.2 = 0.30000000000000004`).

### 2. Transaction Immutability
- **Engine-Level Triggers**: SQLite `BEFORE UPDATE` and `BEFORE DELETE` triggers reject any alteration or removal of historical records with `RAISE(ABORT, 'Transactions are immutable')`.
- **API Protection**: HTTP `PUT`, `PATCH`, and `DELETE` requests to `/api/transactions/*` return `405 Method Not Allowed`.

### 3. Duplicate Prevention & Idempotency
- **Account-Scoped Uniqueness**: The database defines a composite unique constraint `UNIQUE (account_id, reference_id)`.
- If a transaction with an identical `reference_id` is submitted again for the same account:
  - No new transaction is created.
  - The balance is not changed.
  - Returns `409 Conflict` with `DUPLICATE_REFERENCE_ID`.
- The **same `reference_id` can be used across different accounts** without collision.

### 4. Money Transfer (Bonus Feature)
- Atomically transfers money from Account A to Account B.
- Ensures source balance is sufficient, verifies both accounts exist, and writes two ledger entries (source debit and destination credit) plus a transfer record inside one atomic database transaction.

### 5. Interactive Documentation
- Full **OpenAPI 3.0 / Swagger UI** available at `http://localhost:3000/docs`.

---

## 📁 Project Structure

```
├── src/
│   ├── app.ts                  # Express application setup & middleware
│   ├── server.ts               # Server startup & graceful shutdown
│   ├── types/                  # TypeScript interfaces & DTOs
│   │   ├── account.ts
│   │   ├── transaction.ts
│   │   ├── transfer.ts
│   │   └── common.ts
│   ├── db/                     # Database connection & schema
│   │   ├── database.ts         # SQLite DatabaseSync connection & transaction wrapper
│   │   └── schema.ts           # DDL, indexes, triggers & constraints
│   ├── utils/                  # Currency conversions, response helpers, custom errors
│   │   ├── currency.ts
│   │   ├── errors.ts
│   │   └── response.ts
│   ├── middleware/             # Validation (Zod) & Centralized Error Handler
│   │   ├── validate.ts
│   │   └── errorHandler.ts
│   ├── repositories/           # Data Access Layer
│   │   ├── account.repository.ts
│   │   ├── transaction.repository.ts
│   │   └── transfer.repository.ts
│   ├── services/               # Business Logic Layer
│   │   ├── account.service.ts
│   │   ├── ledger.service.ts
│   │   └── transfer.service.ts
│   ├── controllers/            # HTTP Request Handlers
│   │   ├── account.controller.ts
│   │   ├── transaction.controller.ts
│   │   └── transfer.controller.ts
│   ├── routes/                 # Express Route Definitions
│   │   ├── account.routes.ts
│   │   ├── transaction.routes.ts
│   │   ├── transfer.routes.ts
│   │   └── index.ts
│   └── docs/
│       └── swagger.ts          # OpenAPI 3.0 specification
├── tests/                      # Automated Test Suite (30 tests)
│   ├── account.test.ts         # Account creation, initial balance 0, balance fetch
│   ├── transaction.test.ts     # Credit, debit, overdraft rejection, duplicate reference_id
│   ├── history.test.ts         # Latest-first sorting, pagination, type filtering
│   ├── transfer.test.ts        # Atomic transfers, insufficient funds, duplicate reference
│   └── integrity.test.ts       # Immutability triggers, 405 methods, balance consistency
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🛠 Prerequisites & Installation

### Requirements
- **Node.js**: `v22.0.0` or higher (includes built-in `node:sqlite` and test runner). Tested on `v24.19.0`.
- **npm**: `v10.0.0` or higher.

### Setup Instructions

1. Clone or navigate to the project directory:
   ```bash
   cd "c:/Users/patna/OneDrive/Desktop/new project"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript project:
   ```bash
   npm run build
   ```

4. Run the automated tests:
   ```bash
   npm test
   ```

5. Start the server:
   ```bash
   # Production mode
   npm start

   # Development mode (with live watch)
   npm run dev
   ```

The server will start on port `3000` (or `PORT` environment variable if defined):
- **Server URL**: `http://localhost:3000`
- **Swagger Documentation**: `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/api/health`

---

## 📖 API Documentation & Curl Examples

### 1. Create Account
- **Endpoint**: `POST /api/accounts`
- **Description**: Creates a new account. Initial balance is always initialized to `0`. Client cannot set initial balance.

#### Request
```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Smith"}'
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "7864f7b6-1d37-4d9b-a0d3-356391d1f054",
    "name": "Alice Smith",
    "balance": 0,
    "created_at": "2026-10-26T17:15:00.000Z"
  }
}
```

*Note: Attempting to supply `{"name": "Alice", "balance": 100}` returns `400 Bad Request` with an explicit message.*

---

### 2. Get Account Balance
- **Endpoint**: `GET /api/accounts/:id/balance`

#### Request
```bash
curl -X GET http://localhost:3000/api/accounts/7864f7b6-1d37-4d9b-a0d3-356391d1f054/balance
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "account_id": "7864f7b6-1d37-4d9b-a0d3-356391d1f054",
    "balance": 0
  }
}
```

---

### 3. Add Transaction (Credit / Debit)
- **Endpoint**: `POST /api/accounts/:accountId/transactions`
- *Alternatively supported: `POST /api/transactions` with `"account_id"` in the body.*

#### Credit Example
```bash
curl -X POST http://localhost:3000/api/accounts/7864f7b6-1d37-4d9b-a0d3-356391d1f054/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "credit",
    "amount": 100.50,
    "description": "Salary deposit",
    "reference_id": "REF-PAY-001"
  }'
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "6eaecda9-4176-47ad-8982-f04bca07e0ff",
    "account_id": "7864f7b6-1d37-4d9b-a0d3-356391d1f054",
    "type": "credit",
    "amount": 100.5,
    "description": "Salary deposit",
    "reference_id": "REF-PAY-001",
    "created_at": "2026-10-26T17:16:00.000Z",
    "account_balance": 100.5
  }
}
```

#### Debit Example
```bash
curl -X POST http://localhost:3000/api/accounts/7864f7b6-1d37-4d9b-a0d3-356391d1f054/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "debit",
    "amount": 30.00,
    "description": "Coffee and Lunch",
    "reference_id": "REF-COFFEE-001"
  }'
```

#### Insufficient Balance Example (Debit Rejected)
When debiting more than the account balance:
```bash
curl -X POST http://localhost:3000/api/accounts/7864f7b6-1d37-4d9b-a0d3-356391d1f054/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "debit",
    "amount": 5000.00,
    "reference_id": "REF-FAIL-001"
  }'
```

#### Response (`400 Bad Request`)
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Insufficient balance. Current balance: 70.5, requested debit: 5000"
  }
}
```

#### Duplicate Transaction Example
Re-submitting the same `reference_id` on the same account:
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_REFERENCE_ID",
    "message": "Transaction with reference_id 'REF-COFFEE-001' already exists for account '...'"
  }
}
```

---

### 4. Get Transaction History
- **Endpoint**: `GET /api/accounts/:accountId/transactions`
- **Query Parameters**:
  - `type`: `credit` | `debit` *(optional; if omitted, returns both)*
  - `page`: positive integer *(optional; default: `1`)*
  - `limit`: positive integer between 1 and 100 *(optional; default: `20`)*
- **Sorting**: Latest-first order based on `created_at DESC, id DESC`.

#### Request
```bash
curl -X GET "http://localhost:3000/api/accounts/7864f7b6-1d37-4d9b-a0d3-356391d1f054/transactions?page=1&limit=10"
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "2b6d195a-35ce-4043-b26d-96fbda1ee1b4",
      "account_id": "7864f7b6-1d37-4d9b-a0d3-356391d1f054",
      "type": "debit",
      "amount": 30,
      "description": "Coffee and Lunch",
      "reference_id": "REF-COFFEE-001",
      "created_at": "2026-10-26T17:16:30.000Z"
    },
    {
      "id": "6eaecda9-4176-47ad-8982-f04bca07e0ff",
      "account_id": "7864f7b6-1d37-4d9b-a0d3-356391d1f054",
      "type": "credit",
      "amount": 100.5,
      "description": "Salary deposit",
      "reference_id": "REF-PAY-001",
      "created_at": "2026-10-26T17:16:00.000Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "page_size": 10,
    "total_records": 2,
    "total_pages": 1
  }
}
```

---

### 5. Bonus: Money Transfer
- **Endpoint**: `POST /api/transfers`
- **Description**: Transfers funds between two distinct accounts atomically.

#### Request
```bash
curl -X POST http://localhost:3000/api/transfers \
  -H "Content-Type: application/json" \
  -d '{
    "source_account_id": "7864f7b6-1d37-4d9b-a0d3-356391d1f054",
    "destination_account_id": "a82df583-bfbb-4c28-971c-43df89ea27bb",
    "amount": 25.00,
    "description": "Payment for dinner",
    "reference_id": "TXFR-DINNER-001"
  }'
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "90c8a6f3-1383-490b-ba39-c5cbeebba138",
    "source_account_id": "7864f7b6-1d37-4d9b-a0d3-356391d1f054",
    "destination_account_id": "a82df583-bfbb-4c28-971c-43df89ea27bb",
    "amount": 25,
    "description": "Payment for dinner",
    "reference_id": "TXFR-DINNER-001",
    "created_at": "2026-10-26T17:18:00.000Z",
    "source_new_balance": 45.5,
    "destination_new_balance": 25
  }
}
```

---

## 🧪 Automated Testing

The project includes 30 automated tests in 5 suites using Node.js's native test runner and Supertest:

```bash
npm test
```

### Test Coverage Highlights
| Test Suite | Highlights |
|------------|-------------|
| `account.test.ts` | Account creation, initial balance 0 enforcement, rejecting client initial balance, balance retrieval, 404 handling |
| `transaction.test.ts` | Credit balance accumulation, debit balance decrease, insufficient funds rejection, duplicate reference_id rejection (409), shared reference_id across accounts, invalid types & amounts |
| `history.test.ts` | Latest-first sorting, credit/debit filtering, multi-page pagination metadata, pagination validation |
| `transfer.test.ts` | Atomic two-account transfers, insufficient source funds rollback, duplicate transfer reference_id, same-account rejection |
| `integrity.test.ts` | Prompt example balance progression (0 → +100 → +50 → -30 → -20 = 100), immutability triggers on direct SQL update/delete, 405 Method Not Allowed on HTTP mutation |
