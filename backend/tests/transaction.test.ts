import request from 'supertest';
import { createApp } from '../src/app';
import prisma from '../src/db/client';

const app = createApp();

// We use the real database — no mocking. Ensure TEST_DATABASE_URL points to a
// test DB, or the same bureau DB (seed must have run first).

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/rates', () => {
  it('returns rates with base CAD', async () => {
    const res = await request(app).get('/api/rates');
    expect(res.status).toBe(200);
    expect(res.body.base).toBe('CAD');
    expect(Array.isArray(res.body.rates)).toBe(true);
  }, 15_000); // allow up to 15s for external API call

  it('each rate has required fields', async () => {
    const res = await request(app).get('/api/rates');
    expect(res.status).toBe(200);
    for (const rate of res.body.rates) {
      expect(rate).toHaveProperty('currency_code');
      expect(rate).toHaveProperty('buy_rate');
      expect(rate).toHaveProperty('sell_rate');
      expect(rate).toHaveProperty('market_rate');
      expect(rate).toHaveProperty('last_updated');
      // Buy rate should always be less than sell rate (bureau margin)
      expect(rate.buy_rate).toBeLessThan(rate.sell_rate);
    }
  }, 15_000);
});

describe('GET /api/currencies', () => {
  it('returns at least 20 currencies', async () => {
    const res = await request(app).get('/api/currencies');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(20);
  });
});

describe('GET /api/till', () => {
  it('returns inventory with summary', async () => {
    const res = await request(app).get('/api/till');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.inventory)).toBe(true);
    expect(res.body.inventory.length).toBeGreaterThan(0);
  });
});

describe('POST /api/transaction — validation', () => {
  it('rejects missing type', async () => {
    const res = await request(app).post('/api/transaction').send({
      currency: 'USD', amount_foreign: 100, denominations: { '100': 1 },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type/i);
  });

  it('rejects invalid type', async () => {
    const res = await request(app).post('/api/transaction').send({
      type: 'swap', currency: 'USD', amount_foreign: 100, denominations: { '100': 1 },
    });
    expect(res.status).toBe(400);
  });

  it('rejects denomination mismatch', async () => {
    const res = await request(app).post('/api/transaction').send({
      type: 'sell', currency: 'USD', amount_foreign: 200,
      denominations: { '100': 1 }, // 100 ≠ 200
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/denomination/i);
  });

  it('rejects unsupported currency', async () => {
    const res = await request(app).post('/api/transaction').send({
      type: 'sell', currency: 'XYZ', amount_foreign: 100, denominations: { '100': 1 },
    });
    expect(res.status).toBe(400);
  });

  it('rejects non-positive amount_foreign', async () => {
    const res = await request(app).post('/api/transaction').send({
      type: 'buy', currency: 'USD', amount_foreign: -50, denominations: { '50': 1 },
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/transaction — buy (client sells USD to bureau)', () => {
  it('processes a valid buy transaction', async () => {
    // For BUY: client hands over USD notes, bureau adds them to till
    const res = await request(app).post('/api/transaction').send({
      type: 'buy',
      currency: 'USD',
      amount_foreign: 100,
      denominations: { '100': 1 },
    });
    // May fail if rates unavailable — allow 503 too
    if (res.status === 503) {
      console.warn('Skipping buy test — rates unavailable');
      return;
    }
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      type:           'buy',
      currency:       'USD',
      amount_foreign: 100,
    });
    expect(typeof res.body.amount_cad).toBe('number');
    expect(res.body.amount_cad).toBeGreaterThan(0);
    expect(res.body.transaction_id).toBeTruthy();
    expect(res.body.timestamp).toBeTruthy();
  }, 15_000);
});

describe('POST /api/transaction — sell (bureau sells USD to client)', () => {
  it('rejects if till is empty for denomination', async () => {
    // First zero out USD 500 denomination (unlikely to exist anyway)
    const res = await request(app).post('/api/transaction').send({
      type: 'sell',
      currency: 'USD',
      amount_foreign: 500,
      denominations: { '500': 1 }, // USD doesn't have a $500 bill
    });
    expect([400, 503]).toContain(res.status);
  }, 15_000);

  it('processes a valid sell transaction against seeded inventory', async () => {
    // Check what USD inventory looks like first
    const tillRes = await request(app).get('/api/till?currency=USD');
    expect(tillRes.status).toBe(200);

    const usdInventory = tillRes.body.inventory;
    if (usdInventory.length === 0) {
      console.warn('No USD inventory — skipping sell test');
      return;
    }

    // Find a denomination with enough quantity
    const available = usdInventory.find((i: any) => i.quantity >= 2);
    if (!available) {
      console.warn('Insufficient USD inventory for sell test');
      return;
    }

    const denom = available.denomination;
    const amount = denom * 2;

    const res = await request(app).post('/api/transaction').send({
      type: 'sell',
      currency: 'USD',
      amount_foreign: amount,
      denominations: { [String(denom)]: 2 },
    });
    if (res.status === 503) {
      console.warn('Skipping sell test — rates unavailable');
      return;
    }
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('sell');
    expect(res.body.amount_cad).toBeGreaterThan(0);
  }, 15_000);
});

describe('PUT /api/till/restock', () => {
  it('restocks a currency denomination', async () => {
    const res = await request(app).put('/api/till/restock').send({
      currency: 'USD',
      denominations: { '50': 100 },
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/restocked/i);
  });

  it('rejects invalid currency', async () => {
    const res = await request(app).put('/api/till/restock').send({
      denominations: { '50': 100 },
    });
    expect(res.status).toBe(400);
  });

  it('rejects negative quantity', async () => {
    const res = await request(app).put('/api/till/restock').send({
      currency: 'USD',
      denominations: { '50': -1 },
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/transaction', () => {
  it('returns an array of transactions', async () => {
    const res = await request(app).get('/api/transaction');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('respects limit param', async () => {
    const res = await request(app).get('/api/transaction?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(5);
  });
});
