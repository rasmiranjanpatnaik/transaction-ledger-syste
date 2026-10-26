import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema.js';

let dbInstance: DatabaseSync | null = null;

export function getDatabase(dbPath?: string): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const targetPath = dbPath || process.env.DB_PATH || 'ledger.db';
  dbInstance = createDatabase(targetPath);
  return dbInstance;
}

export function createDatabase(dbPath: string = ':memory:'): DatabaseSync {
  const db = new DatabaseSync(dbPath);

  // Enable WAL mode if file-based (in-memory ignores WAL)
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  // Run schema creation
  db.exec(SCHEMA_SQL);

  return db;
}

export function setDatabase(db: DatabaseSync): void {
  dbInstance = db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } finally {
      dbInstance = null;
    }
  }
}

/**
 * Runs a function inside an immediate atomic transaction.
 * In SQLite, 'BEGIN IMMEDIATE' locks the database for writing immediately,
 * preventing concurrency race conditions.
 */
export function withTransaction<T>(db: DatabaseSync, fn: (db: DatabaseSync) => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn(db);
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback errors if already rolled back
    }
    throw error;
  }
}
