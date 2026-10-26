import { DatabaseSync } from 'node:sqlite';
import { TransactionEntity, TransactionQueryFilters, TransactionType } from '../types/transaction.js';

interface RawTransactionRow {
  id: string;
  account_id: string;
  type: string;
  amount: number;
  description: string;
  reference_id: string;
  created_at: string;
  transfer_id: string | null;
}

interface CountRow {
  count: number;
}

export class TransactionRepository {
  constructor(private db: DatabaseSync) {}

  create(entity: TransactionEntity): TransactionEntity {
    const stmt = this.db.prepare(`
      INSERT INTO transactions (id, account_id, type, amount, description, reference_id, created_at, transfer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entity.id,
      entity.account_id,
      entity.type,
      entity.amount_cents,
      entity.description,
      entity.reference_id,
      entity.created_at,
      entity.transfer_id ?? null
    );
    return entity;
  }

  findById(id: string): TransactionEntity | null {
    const stmt = this.db.prepare(`
      SELECT id, account_id, type, amount, description, reference_id, created_at, transfer_id
      FROM transactions
      WHERE id = ?
    `);
    const row = stmt.get(id) as unknown as RawTransactionRow | undefined;
    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }

  findByReferenceId(accountId: string, referenceId: string): TransactionEntity | null {
    const stmt = this.db.prepare(`
      SELECT id, account_id, type, amount, description, reference_id, created_at, transfer_id
      FROM transactions
      WHERE account_id = ? AND reference_id = ?
    `);
    const row = stmt.get(accountId, referenceId) as unknown as RawTransactionRow | undefined;
    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }

  findByAccount(filters: TransactionQueryFilters): { transactions: TransactionEntity[]; total: number } {
    const { account_id, type, page, limit } = filters;
    const offset = (page - 1) * limit;

    let countSql = `SELECT COUNT(*) as count FROM transactions WHERE account_id = ?`;
    let querySql = `
      SELECT id, account_id, type, amount, description, reference_id, created_at, transfer_id
      FROM transactions
      WHERE account_id = ?
    `;
    const params: (string | number)[] = [account_id];

    if (type) {
      countSql += ` AND type = ?`;
      querySql += ` AND type = ?`;
      params.push(type);
    }

    querySql += ` ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`;

    const countStmt = this.db.prepare(countSql);
    const countParams = type ? [account_id, type] : [account_id];
    const countResult = countStmt.get(...countParams) as unknown as CountRow;
    const total = countResult ? countResult.count : 0;

    const queryStmt = this.db.prepare(querySql);
    const rows = queryStmt.all(...params, limit, offset) as unknown as RawTransactionRow[];

    return {
      transactions: rows.map((r) => this.mapRowToEntity(r)),
      total,
    };
  }

  private mapRowToEntity(row: RawTransactionRow): TransactionEntity {
    return {
      id: row.id,
      account_id: row.account_id,
      type: row.type as TransactionType,
      amount_cents: row.amount,
      description: row.description,
      reference_id: row.reference_id,
      created_at: row.created_at,
      transfer_id: row.transfer_id,
    };
  }
}
