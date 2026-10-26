import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/db/database.js';

describe('Transaction History API', () => {
  let app: ReturnType<typeof createApp>;
  let accountId: string;

  beforeEach(async () => {
    const db = createDatabase(':memory:');
    app = createApp(db);

    const res = await request(app)
      .post('/api/accounts')
      .send({ name: 'History User' });
    accountId = res.body.data.id;

    // Create a series of transactions with slight delay to ensure distinct timestamps
    // 1. Credit 100
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'credit', amount: 100, reference_id: 'TX-1', description: 'Initial deposit' });

    // 2. Debit 20
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'debit', amount: 20, reference_id: 'TX-2', description: 'Book' });

    // 3. Credit 50
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'credit', amount: 50, reference_id: 'TX-3', description: 'Freelance' });

    // 4. Debit 15
    await request(app)
      .post(`/api/accounts/${accountId}/transactions`)
      .send({ type: 'debit', amount: 15, reference_id: 'TX-4', description: 'Coffee' });
  });

  it('should return all transactions sorted latest-first when no filter is provided', async () => {
    const res = await request(app)
      .get(`/api/accounts/${accountId}/transactions`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 4);

    // Latest-first order: TX-4, TX-3, TX-2, TX-1
    assert.strictEqual(res.body.data[0].reference_id, 'TX-4');
    assert.strictEqual(res.body.data[1].reference_id, 'TX-3');
    assert.strictEqual(res.body.data[2].reference_id, 'TX-2');
    assert.strictEqual(res.body.data[3].reference_id, 'TX-1');

    assert.strictEqual(res.body.pagination.current_page, 1);
    assert.strictEqual(res.body.pagination.total_records, 4);
    assert.strictEqual(res.body.pagination.total_pages, 1);
  });

  it('should filter transactions by type: credit', async () => {
    const res = await request(app)
      .get(`/api/accounts/${accountId}/transactions?type=credit`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 2);
    assert.ok(res.body.data.every((tx: { type: string }) => tx.type === 'credit'));
    assert.strictEqual(res.body.data[0].reference_id, 'TX-3');
    assert.strictEqual(res.body.data[1].reference_id, 'TX-1');
    assert.strictEqual(res.body.pagination.total_records, 2);
  });

  it('should filter transactions by type: debit', async () => {
    const res = await request(app)
      .get(`/api/accounts/${accountId}/transactions?type=debit`)
      .expect(200);

    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 2);
    assert.ok(res.body.data.every((tx: { type: string }) => tx.type === 'debit'));
    assert.strictEqual(res.body.data[0].reference_id, 'TX-4');
    assert.strictEqual(res.body.data[1].reference_id, 'TX-2');
    assert.strictEqual(res.body.pagination.total_records, 2);
  });

  it('should paginate results accurately', async () => {
    // Page 1, limit 2
    const page1 = await request(app)
      .get(`/api/accounts/${accountId}/transactions?page=1&limit=2`)
      .expect(200);

    assert.strictEqual(page1.body.data.length, 2);
    assert.strictEqual(page1.body.data[0].reference_id, 'TX-4');
    assert.strictEqual(page1.body.data[1].reference_id, 'TX-3');
    assert.strictEqual(page1.body.pagination.current_page, 1);
    assert.strictEqual(page1.body.pagination.page_size, 2);
    assert.strictEqual(page1.body.pagination.total_records, 4);
    assert.strictEqual(page1.body.pagination.total_pages, 2);

    // Page 2, limit 2
    const page2 = await request(app)
      .get(`/api/accounts/${accountId}/transactions?page=2&limit=2`)
      .expect(200);

    assert.strictEqual(page2.body.data.length, 2);
    assert.strictEqual(page2.body.data[0].reference_id, 'TX-2');
    assert.strictEqual(page2.body.data[1].reference_id, 'TX-1');
    assert.strictEqual(page2.body.pagination.current_page, 2);
  });

  it('should return 400 for invalid filter type', async () => {
    const res = await request(app)
      .get(`/api/accounts/${accountId}/transactions?type=unknown`)
      .expect(400);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('should return 400 for invalid pagination parameters', async () => {
    await request(app)
      .get(`/api/accounts/${accountId}/transactions?page=0`)
      .expect(400);

    await request(app)
      .get(`/api/accounts/${accountId}/transactions?limit=-5`)
      .expect(400);
  });

  it('should return 404 for non-existent account history', async () => {
    const res = await request(app)
      .get('/api/accounts/non-existent-acc-id/transactions')
      .expect(404);

    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'ACCOUNT_NOT_FOUND');
  });
});
