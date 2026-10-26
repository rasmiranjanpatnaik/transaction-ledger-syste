import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/db/database.js';

describe('Money Transfer API (Bonus)', () => {
  let app: ReturnType<typeof createApp>;
  let accountAId: string;
  let accountBId: string;

  beforeEach(async () => {
    const db = createDatabase(':memory:');
    app = createApp(db);

    // Account A: initial credit 100
    const resA = await request(app).post('/api/accounts').send({ name: 'Account A' });
    accountAId = resA.body.data.id;
    await request(app)
      .post(`/api/accounts/${accountAId}/transactions`)
      .send({ type: 'credit', amount: 100, reference_id: 'INIT-A' });

    // Account B: initial credit 50
    const resB = await request(app).post('/api/accounts').send({ name: 'Account B' });
    accountBId = resB.body.data.id;
    await request(app)
      .post(`/api/accounts/${accountBId}/transactions`)
      .send({ type: 'credit', amount: 50, reference_id: 'INIT-B' });
  });

  it('should transfer 30 from Account A to Account B atomically', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .send({
        source_account_id: accountAId,
        destination_account_id: accountBId,
        amount: 30,
        description: 'Settling dinner bill',
        reference_id: 'TXFR-100',
      })
      .expect(201);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.amount, 30);
    assert.strictEqual(res.body.data.source_new_balance, 70);
    assert.strictEqual(res.body.data.destination_new_balance, 80);

    // Verify balance endpoints
    const balA = await request(app).get(`/api/accounts/${accountAId}/balance`);
    assert.strictEqual(balA.body.data.balance, 70);

    const balB = await request(app).get(`/api/accounts/${accountBId}/balance`);
    assert.strictEqual(balB.body.data.balance, 80);

    // Verify transaction history for Account A includes the debit
    const histA = await request(app).get(`/api/accounts/${accountAId}/transactions`);
    assert.strictEqual(histA.body.data[0].type, 'debit');
    assert.strictEqual(histA.body.data[0].amount, 30);
    assert.ok(histA.body.data[0].transfer_id);

    // Verify transaction history for Account B includes the credit
    const histB = await request(app).get(`/api/accounts/${accountBId}/transactions`);
    assert.strictEqual(histB.body.data[0].type, 'credit');
    assert.strictEqual(histB.body.data[0].amount, 30);
    assert.ok(histB.body.data[0].transfer_id);
  });

  it('should reject transfer when source account has insufficient balance', async () => {
    // Account A only has 100, attempt to transfer 150
    const res = await request(app)
      .post('/api/transfers')
      .send({
        source_account_id: accountAId,
        destination_account_id: accountBId,
        amount: 150,
        reference_id: 'TXFR-FAIL-FUNDS',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'INSUFFICIENT_FUNDS');

    // Both balances remain completely unaffected
    const balA = await request(app).get(`/api/accounts/${accountAId}/balance`);
    assert.strictEqual(balA.body.data.balance, 100);

    const balB = await request(app).get(`/api/accounts/${accountBId}/balance`);
    assert.strictEqual(balB.body.data.balance, 50);
  });

  it('should reject transfer when source and destination accounts are the same', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .send({
        source_account_id: accountAId,
        destination_account_id: accountAId,
        amount: 20,
        reference_id: 'TXFR-SAME-ACC',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
  });

  it('should reject transfer if source or destination account does not exist', async () => {
    // Non-existent destination
    const res = await request(app)
      .post('/api/transfers')
      .send({
        source_account_id: accountAId,
        destination_account_id: 'non-existent-acc-id',
        amount: 20,
        reference_id: 'TXFR-NO-DEST',
      })
      .expect(404);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'DEST_ACCOUNT_NOT_FOUND');

    // Balance A remains 100
    const balA = await request(app).get(`/api/accounts/${accountAId}/balance`);
    assert.strictEqual(balA.body.data.balance, 100);
  });

  it('should reject duplicate transfer reference_id', async () => {
    // First transfer
    await request(app)
      .post('/api/transfers')
      .send({
        source_account_id: accountAId,
        destination_account_id: accountBId,
        amount: 10,
        reference_id: 'TXFR-DUP-REF',
      })
      .expect(201);

    // Duplicate transfer
    const dupRes = await request(app)
      .post('/api/transfers')
      .send({
        source_account_id: accountAId,
        destination_account_id: accountBId,
        amount: 10,
        reference_id: 'TXFR-DUP-REF',
      })
      .expect(409);

    assert.strictEqual(dupRes.body.success, false);
    assert.strictEqual(dupRes.body.error.code, 'DUPLICATE_TRANSFER_REFERENCE');

    // Only 10 was transferred, not 20
    const balA = await request(app).get(`/api/accounts/${accountAId}/balance`);
    assert.strictEqual(balA.body.data.balance, 90);
  });
});
