import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/db/database.js';

describe('Data Integrity & Immutability', () => {
  let app: ReturnType<typeof createApp>;
  let db: ReturnType<typeof createDatabase>;
  let accountId: string;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    app = createApp(db);

    const res = await request(app).post('/api/accounts').send({ name: 'Integrity User' });
    accountId = res.body.data.id;
  });

  it('should maintain exact balance consistency across sequence of operations', async () => {
    // Initial balance: 0
    let balRes = await request(app).get(`/api/accounts/${accountId}/balance`);
    assert.strictEqual(balRes.body.data.balance, 0);

    // Credit: 100
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'credit', amount: 100, reference_id: 'C100' });

    // Credit: 50
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'credit', amount: 50, reference_id: 'C50' });

    // Debit: 30
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'debit', amount: 30, reference_id: 'D30' });

    // Debit: 20
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'debit', amount: 20, reference_id: 'D20' });

    // Final balance must be exactly 100
    balRes = await request(app).get(`/api/accounts/${accountId}/balance`);
    assert.strictEqual(balRes.body.data.balance, 100);

    // A failed or rejected transaction must not affect the account balance
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'debit', amount: 999, reference_id: 'D-FAIL' })
      .expect(400);

    balRes = await request(app).get(`/api/accounts/${accountId}/balance`);
    assert.strictEqual(balRes.body.data.balance, 100);
  });

  it('should reject PUT, PATCH, DELETE HTTP methods on transactions with 405 Method Not Allowed', async () => {
    const txRes = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'credit', amount: 50, reference_id: 'TX-IMMUTABLE' });
    const txId = txRes.body.data.id;

    // PUT
    const putRes = await request(app).put(`/api/transactions/${txId}`).send({ amount: 999 });
    assert.strictEqual(putRes.status, 405);
    assert.strictEqual(putRes.body.error.code, 'METHOD_NOT_ALLOWED');

    // PATCH
    const patchRes = await request(app).patch(`/api/transactions/${txId}`).send({ description: 'Edited' });
    assert.strictEqual(patchRes.status, 405);

    // DELETE
    const delRes = await request(app).delete(`/api/transactions/${txId}`);
    assert.strictEqual(delRes.status, 405);
  });

  it('should prevent SQL update or delete directly on transactions table via database triggers', () => {
    const txId = 'tx-db-trigger-test';
    db.prepare(`
      INSERT INTO transactions (id, account_id, type, amount, description, reference_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(txId, accountId, 'credit', 5000, 'Direct SQL', 'SQL-TRIG-1', new Date().toISOString());

    // Attempting direct UPDATE must trigger database exception
    assert.throws(() => {
      db.prepare('UPDATE transactions SET amount = 9999 WHERE id = ?').run(txId);
    }, /Transactions are immutable/);

    // Attempting direct DELETE must trigger database exception
    assert.throws(() => {
      db.prepare('DELETE FROM transactions WHERE id = ?').run(txId);
    }, /Transactions are immutable/);
  });
});
