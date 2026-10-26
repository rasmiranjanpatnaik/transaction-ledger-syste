import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/db/database.js';

describe('Account API', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = createDatabase(':memory:');
    app = createApp(db);
  });

  it('should successfully create an account with balance 0', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({ name: 'Alice Smith' })
      .expect(201);

    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.id);
    assert.strictEqual(res.body.data.name, 'Alice Smith');
    assert.strictEqual(res.body.data.balance, 0);
    assert.ok(res.body.data.created_at);
  });

  it('should reject account creation if name is missing or empty', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({ name: '   ' })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('should reject client attempting to set initial balance', async () => {
    const res = await request(app)
      .post('/api/accounts')
      .send({ name: 'Bob', balance: 500 })
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.match(
      res.body.error.message,
      /Client is not allowed to set the initial balance/
    );
  });

  it('should get current balance of an account', async () => {
    const createRes = await request(app)
      .post('/api/accounts')
      .send({ name: 'Charlie' })
      .expect(201);

    const accountId = createRes.body.data.id;

    const balanceRes = await request(app)
      .get(`/api/accounts/${accountId}/balance`)
      .expect(200);

    assert.strictEqual(balanceRes.body.success, true);
    assert.strictEqual(balanceRes.body.data.account_id, accountId);
    assert.strictEqual(balanceRes.body.data.balance, 0);
  });

  it('should return 404 when getting balance of non-existent account', async () => {
    const res = await request(app)
      .get('/api/accounts/non-existent-uuid/balance')
      .expect(404);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'ACCOUNT_NOT_FOUND');
  });

  it('should retrieve account details by ID', async () => {
    const createRes = await request(app)
      .post('/api/accounts')
      .send({ name: 'Diana Prince' })
      .expect(201);

    const accountId = createRes.body.data.id;

    const getRes = await request(app)
      .get(`/api/accounts/${accountId}`)
      .expect(200);

    assert.strictEqual(getRes.body.success, true);
    assert.strictEqual(getRes.body.data.id, accountId);
    assert.strictEqual(getRes.body.data.name, 'Diana Prince');
    assert.strictEqual(getRes.body.data.balance, 0);
  });
});
