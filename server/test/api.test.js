import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret';
process.env.DB_PATH = ':memory:';
const { app } = await import('../src/app.js');

let server;
let base;
let admin;
let cashier;
let productId;

const api = async (method, path, { token, body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
};

before(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

test('setup creates first admin only once', async () => {
  const body = { name: 'Admin', email: 'admin@test.com', password: 'password123' };
  assert.equal((await api('POST', '/auth/setup', { body })).status, 201);
  assert.equal((await api('POST', '/auth/setup', { body })).status, 409);
  admin = (await api('POST', '/auth/login', { body })).data.token;
  assert.ok(admin);
});

test('admin creates cashier; cashier cannot create products', async () => {
  const body = { name: 'Cash', email: 'cash@test.com', password: 'password123', role: 'cashier' };
  assert.equal((await api('POST', '/auth/users', { token: admin, body })).status, 201);
  cashier = (await api('POST', '/auth/login', { body })).data.token;
  const p = { sku: 'X', name: 'X', priceCents: 100 };
  assert.equal((await api('POST', '/products', { token: cashier, body: p })).status, 403);
});

test('admin creates product; duplicate SKU rejected', async () => {
  const body = { sku: 'NDL-1', name: 'Noodles', priceCents: 2500, costCents: 2000, stock: 10 };
  const res = await api('POST', '/products', { token: admin, body });
  assert.equal(res.status, 201);
  productId = res.data.id;
  assert.equal((await api('POST', '/products', { token: admin, body })).status, 409);
});

test('sale deducts stock and computes change', async () => {
  const sale = await api('POST', '/sales', {
    token: cashier,
    body: { items: [{ productId, qty: 3 }], paymentCents: 10000 },
  });
  assert.equal(sale.status, 201);
  assert.equal(sale.data.totalCents, 7500);
  assert.equal(sale.data.changeCents, 2500);
  assert.equal((await api('GET', `/products/${productId}`, { token: cashier })).data.stock, 7);
});

test('oversell and underpayment are rejected without changing stock', async () => {
  const over = await api('POST', '/sales', {
    token: cashier,
    body: { items: [{ productId, qty: 100 }], paymentCents: 999999 },
  });
  assert.equal(over.status, 409);
  const low = await api('POST', '/sales', {
    token: cashier,
    body: { items: [{ productId, qty: 1 }], paymentCents: 100 },
  });
  assert.equal(low.status, 400);
  assert.equal((await api('GET', `/products/${productId}`, { token: cashier })).data.stock, 7);
});

test('daily report totals match', async () => {
  const res = await api('GET', '/reports/daily', { token: admin });
  assert.equal(res.status, 200);
  assert.equal(res.data.salesCount, 1);
  assert.equal(res.data.revenueCents, 7500);
  assert.equal(res.data.profitCents, 1500);
  assert.equal((await api('GET', '/reports/daily', { token: cashier })).status, 403);
});
