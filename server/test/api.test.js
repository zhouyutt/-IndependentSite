import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadProducts, saveProducts } from '../src/catalog/catalog.repository.js';

const app = createApp();
let server;
let api;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  api = request(server);
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('catalog returns products and facets', async () => {
  const res = await api.get('/api/products').expect(200);
  assert.ok(res.body.products.length >= 4);
  assert.ok(res.body.facets.categories.includes('Basketball Hoops'));
  assert.equal(res.body.products[0].source, 'Amazon product link supplied by user');
});

test('furniture catalog has nine sourced products and searchable model numbers', async () => {
  const res = await api.get('/api/products?sort=featured').expect(200);
  const furniture = res.body.products.filter((product) => product.brand === 'Alaterre Furniture');
  assert.equal(furniture.length, 9);
  assert.equal(res.body.products[0].brand, 'Alaterre Furniture');
  for (const product of furniture) {
    assert.equal(product.price, null);
    assert.equal(product.rating, null);
    assert.equal(product.externalOnly, true);
    assert.match(product.image, /^\/assets\/alaterre-/);
    assert.match(product.sourceUrl, /^https:\/\/www.alaterrefurniture.com\/products\//);
    assert.ok(product.amazonStoreUrl.includes(product.specs.model));
  }
  const search = await api.get('/api/products?q=AMBA5520').expect(200);
  assert.equal(search.body.products.length, 1);
  assert.equal(search.body.products[0].id, 'alaterre-pomona-wall-shelf');
  const priced = await api.get('/api/products?maxPrice=250').expect(200);
  assert.ok(priced.body.products.every((product) => Number.isFinite(product.price) && product.price <= 250));
  const sorted = await api.get('/api/products?sort=price-asc').expect(200);
  assert.ok(sorted.body.products.slice(0, 4).every((product) => Number.isFinite(product.price)));
  await api.post('/api/cart/items').set('x-session-id', 'furniture-validation')
    .send({ productId: furniture[0].id, quantity: 1 }).expect(422);
});

test('catalog-only deployment serves products and omits shopping and administration routes', async () => {
  const catalog = request(createApp({ catalogOnly: true }));
  await catalog.get('/api/products').expect(200);
  await catalog.get('/api/cart').expect(404);
  await catalog.get('/api/orders').expect(404);
  await catalog.post('/api/checkout').expect(404);
  await catalog.get('/api/admin/products').expect(404);
  await catalog.get('/api/payments/paypal/config').expect(404);
});

test('cart add and checkout flow works', async () => {
  const session = 'test-session';

  const cart = await api
    .post('/api/cart/items')
    .set('x-session-id', session)
    .send({ productId: 'dn-basketball-hoop-853', quantity: 2, color: 'Black' })
    .expect(201);

  assert.equal(cart.body.items[0].quantity, 2);

  const order = await api
    .post('/api/checkout')
    .set('x-session-id', session)
    .send({
      name: 'Sports Buyer',
      email: 'buyer@example.com',
      address: '120 Cedar Lane',
      city: 'Austin',
      state: 'TX',
      zip: '78701'
    })
    .expect(201);

  assert.equal(order.body.order.status, 'confirmed');
});

test('paypal account binding and sandbox payment flow works', async () => {
  const session = `paypal-session-${Date.now()}`;

  const account = await api
    .put('/api/admin/payments/paypal/account')
    .send({
      mode: 'sandbox',
      clientId: 'mock-paypal-client-id',
      clientSecret: 'mock_paypal_sandbox_secret',
      merchantId: 'MOCKMERCHANT123',
      merchantEmail: 'payments@example.com'
    })
    .expect(200);

  assert.equal(account.body.account.status, 'connected');
  assert.equal(account.body.account.clientSecret, undefined);

  const config = await api.get('/api/payments/paypal/config').expect(200);
  assert.equal(config.body.enabled, true);
  assert.equal(config.body.clientId, 'mock-paypal-client-id');

  await api
    .post('/api/cart/items')
    .set('x-session-id', session)
    .send({ productId: 'dn-portable-treadmill', quantity: 1, color: 'Black' })
    .expect(201);

  const created = await api
    .post('/api/payments/paypal/orders')
    .set('x-session-id', session)
    .send({
      customer: {
        name: 'PayPal Buyer',
        email: 'paypal-buyer@example.com',
        address: '200 PayPal Lane',
        city: 'Austin',
        state: 'TX',
        zip: '78701'
      }
    })
    .expect(201);

  assert.match(created.body.paypalOrderId, /^MOCK-PAYPAL-DN-/);

  const captured = await api
    .post('/api/payments/paypal/capture')
    .set('x-session-id', session)
    .send({ paypalOrderId: created.body.paypalOrderId })
    .expect(200);

  assert.equal(captured.body.order.status, 'paid');
  assert.equal(captured.body.order.payment.provider, 'paypal');
  assert.equal(captured.body.paypal.status, 'COMPLETED');
});

test('admin can create and update products', async () => {
  const id = `test-admin-${Date.now()}`;
  const originalProducts = await loadProducts();

  try {
    const created = await api
      .post('/api/admin/products')
      .send({
        id,
        name: 'Admin Test Basketball Hoop',
        category: 'Basketball Hoops',
        collection: 'QA Collection',
        price: 211,
        compareAt: 249,
        stock: 7,
        summary: 'A test product created from the admin API.',
        color: 'Black',
        amazonStoreUrl: 'https://www.amazon.com/DASHINGNOAH-Basketball-4-82-8-53FT-Adjustable-Backboard/dp/B0DBH3RLX2?ref_=ast_sto_dp',
        status: 'draft'
      })
      .expect(201);

    assert.equal(created.body.product.id, id);

    const publicCatalog = await api.get('/api/products?includeInactive=true').expect(200);
    assert.equal(publicCatalog.body.products.some((product) => product.id === id), false);
    assert.equal(publicCatalog.body.facets.collections.includes('QA Collection'), false);
    await api.get(`/api/products/${id}`).expect(404);
    const privateCatalog = await api.get('/api/admin/products').expect(200);
    assert.equal(privateCatalog.body.products.some((product) => product.id === id), true);

    const updated = await api
      .patch(`/api/admin/products/${id}`)
      .send({ stock: 19, status: 'active' })
      .expect(200);

    assert.equal(updated.body.product.stock, 19);
    assert.equal(updated.body.product.status, 'active');

    const adminProducts = await api.get('/api/admin/products').expect(200);
    assert.equal(adminProducts.body.products.some((product) => product.id === id), true);

    await api.delete(`/api/admin/products/${id}`).expect(200);
    const afterDelete = await api.get('/api/admin/products').expect(200);
    assert.equal(afterDelete.body.products.some((product) => product.id === id), false);
  } finally {
    await saveProducts(originalProducts);
  }
});

test('admin dashboard returns transaction and inventory metrics', async () => {
  const res = await api.get('/api/admin/dashboard').expect(200);
  assert.ok(typeof res.body.metrics.revenue === 'number');
  assert.ok(Array.isArray(res.body.lowStock));
  assert.ok(Array.isArray(res.body.recentOrders));
});
