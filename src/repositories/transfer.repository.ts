import { DatabaseSync } from 'node:sqlite';
import { TransferEntity } from '../types/transfer.js';

interface RawTransferRow {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount: number;
  description: string;
  reference_id: string;
  created_at: string;
}

export class TransferRepository {
  constructor(private db: DatabaseSync) {}

  create(entity: TransferEntity): TransferEntity {
    const stmt = this.db.prepare(`
      INSERT INTO transfers (id, source_account_id, destination_account_id, amount, description, reference_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entity.id,
      entity.source_account_id,
      entity.destination_account_id,
      entity.amount_cents,
      entity.description,
      entity.reference_id,
      entity.created_at
    );
    return entity;
  }

  findById(id: string): TransferEntity | null {
    const stmt = this.db.prepare(`
      SELECT id, source_account_id, destination_account_id, amount, description, reference_id, created_at
      FROM transfers
      WHERE id = ?
    `);
    const row = stmt.get(id) as unknown as RawTransferRow | undefined;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      source_account_id: row.source_account_id,
      destination_account_id: row.destination_account_id,
      amount_cents: row.amount,
      description: row.description,
      reference_id: row.reference_id,
      created_at: row.created_at,
    };
  }

  findByReferenceId(referenceId: string): TransferEntity | null {
    const stmt = this.db.prepare(`
      SELECT id, source_account_id, destination_account_id, amount, description, reference_id, created_at
      FROM transfers
      WHERE reference_id = ?
    `);
    const row = stmt.get(referenceId) as unknown as RawTransferRow | undefined;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      source_account_id: row.source_account_id,
      destination_account_id: row.destination_account_id,
      amount_cents: row.amount,
      description: row.description,
      reference_id: row.reference_id,
      created_at: row.created_at,
    };
  }
}
