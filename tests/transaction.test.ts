import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/db/database.js';

describe('Transaction API', () => {
  let app: ReturnType<typeof createApp>;
  let accountId: string;

  beforeEach(async () => {
    const db = createDatabase(':memory:');
    app = createApp(db);

    const res = await request(app)
      .post('/api/accounts')
      .send({ name: 'Test User' });
    accountId = res.body.data.id;
  });

  it('should credit an account and increase balance', async () => {
    const res = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: 'credit',
        amount: 100.5,
        description: 'Salary',
        reference_id: 'REF-001',
      })
      .expect(201);

    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.id);
    assert.strictEqual(res.body.data.account_id, accountId);
    assert.strictEqual(res.body.data.type, 'credit');
    assert.strictEqual(res.body.data.amount, 100.5);
    assert.strictEqual(res.body.data.description, 'Salary');
    assert.strictEqual(res.body.data.reference_id, 'REF-001');
    assert.strictEqual(res.body.data.account_balance, 100.5);

    // Verify balance endpoint reflects new balance
    const balRes = await request(app).get(`/api/accounts/${accountId}/balance`);
    assert.strictEqual(balRes.body.data.balance, 100.5);
  });

  it('should debit an account when sufficient balance exists', async () => {
    // Credit 100
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: 'credit',
        amount: 100,
        reference_id: 'REF-CRED-1',
      })
      .expect(201);

    // Debit 30
    const res = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: 'debit',
        amount: 30,
        description: 'Groceries',
        reference_id: 'REF-DEB-1',
      })
      .expect(201);

    assert.strictEqual(res.body.data.type, 'debit');
    assert.strictEqual(res.body.data.amount, 30);
    assert.strictEqual(res.body.data.account_balance, 70);

    // Verify balance
    const balRes = await request(app).get(`/api/accounts/${accountId}/balance`);
    assert.strictEqual(balRes.body.data.balance, 70);
  });

  it('should reject debit when balance is insufficient and keep balance unchanged', async () => {
    // Credit 100
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: 'credit',
        amount: 100,
        reference_id: 'REF-CRED-1',
      })
      .expect(201);

    // Attempt to debit 150
    const res = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: 'debit',
        amount: 150,
        reference_id: 'REF-DEB-FAIL',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'INSUFFICIENT_FUNDS');

    // Balance remains 100
    const balRes = await request(app).get(`/api/accounts/${accountId}/balance`);
    assert.strictEqual(balRes.body.data.balance, 100);
  });

  it('should reject duplicate reference_id for the same account', async () => {
    // First transaction
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: 'credit',
        amount: 50,
        reference_id: 'REF-DUP-1',
      })
      .expect(201);

    // Duplicate transaction
    const dupRes = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: 'credit',
        amount: 50,
        reference_id: 'REF-DUP-1',
      })
      .expect(409);

    assert.strictEqual(dupRes.body.success, false);
    assert.strictEqual(dupRes.body.error.code, 'DUPLICATE_REFERENCE_ID');

    // Balance should remain 50 (not 100)
    const balRes = await request(app).get(`/api/accounts/${accountId}/balance`);
    assert.strictEqual(balRes.body.data.balance, 50);
  });

  it('should allow the same reference_id for different accounts', async () => {
    // Create second account
    const acc2Res = await request(app)
      .post('/api/accounts')
      .send({ name: 'Second User' })
      .expect(201);
    const accountId2 = acc2Res.body.data.id;

    // Use same reference_id 'REF-SHARED' on account 1
    const res1 = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: 'credit',
        amount: 40,
        reference_id: 'REF-SHARED',
      })
      .expect(201);
    assert.strictEqual(res1.body.success, true);

    // Use same reference_id 'REF-SHARED' on account 2
    const res2 = await request(app)
      .post(`/api/accounts/${accountId2}/transactions`)
      .send({
        type: 'credit',
        amount: 60,
        reference_id: 'REF-SHARED',
      })
      .expect(201);
    assert.strictEqual(res2.body.success, true);
  });

  it('should support direct POST /api/transactions with account_id in body', async () => {
    const res = await request(app)
      .post('/api/transactions')
      .send({
        account_id: accountId,
        type: 'credit',
        amount: 75.25,
        reference_id: 'REF-DIRECT-1',
      })
      .expect(201);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.amount, 75.25);
    assert.strictEqual(res.body.data.account_balance, 75.25);
  });

  it('should reject invalid transaction type', async () => {
    const res = await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({
        type: 'deposit', // invalid
        amount: 50,
        reference_id: 'REF-INV-TYPE',
      })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('should reject invalid amounts (negative, zero, >2 decimal places)', async () => {
    // Zero
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'credit', amount: 0, reference_id: 'R1' })
      .expect(400);

    // Negative
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'credit', amount: -25, reference_id: 'R2' })
      .expect(400);

    // 3 decimal places
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'credit', amount: 10.125, reference_id: 'R3' })
      .expect(400);
  });

  it('should return 404 when adding transaction to non-existent account', async () => {
    const res = await request(app)
      .post('/api/accounts/non-existent-account-id/transactions')
      .send({
        type: 'credit',
        amount: 50,
        reference_id: 'REF-NON-EXISTENT',
      })
      .expect(404);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'ACCOUNT_NOT_FOUND');
  });
});
