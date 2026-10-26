import { DatabaseSync } from 'node:sqlite';
import { AccountEntity } from '../types/account.js';

interface RawAccountRow {
  id: string;
  name: string;
  balance: number;
  created_at: string;
}

export class AccountRepository {
  constructor(private db: DatabaseSync) {}

  create(entity: AccountEntity): AccountEntity {
    const stmt = this.db.prepare(`
      INSERT INTO accounts (id, name, balance, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(entity.id, entity.name, entity.balance_cents, entity.created_at);
    return entity;
  }

  findById(id: string): AccountEntity | null {
    const stmt = this.db.prepare(`
      SELECT id, name, balance, created_at
      FROM accounts
      WHERE id = ?
    `);
    const row = stmt.get(id) as unknown as RawAccountRow | undefined;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      name: row.name,
      balance_cents: row.balance,
      created_at: row.created_at,
    };
  }

  findAll(): AccountEntity[] {
    const stmt = this.db.prepare(`
      SELECT id, name, balance, created_at
      FROM accounts
      ORDER BY created_at DESC
    `);
    const rows = stmt.all() as unknown as RawAccountRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      balance_cents: row.balance,
      created_at: row.created_at,
    }));
  }

  /**
   * Atomic credit: increases balance by amountCents
   */
  creditBalance(id: string, amountCents: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE accounts
      SET balance = balance + ?
      WHERE id = ?
    `);
    const result = stmt.run(amountCents, id);
    return Number(result.changes) > 0;
  }

  /**
   * Atomic debit: decreases balance by amountCents only if sufficient balance exists
   */
  debitBalance(id: string, amountCents: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE accounts
      SET balance = balance - ?
      WHERE id = ? AND balance >= ?
    `);
    const result = stmt.run(amountCents, id, amountCents);
    return Number(result.changes) > 0;
  }
}
