'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Storefront, safeHttps, printifyStoreUrl } = require('../docs/shop-client');
const config = { shopDomain: 'test-shop.myshopify.com', apiVersion: '2026-10' };
const variantId = 'gid://shopify/ProductVariant/123';
const cartId = 'gid://shopify/Cart/test?key=buyer-key';

test('Printify shop links normalize HTTPS storefront roots and reject other targets', () => {
  assert.equal(printifyStoreUrl('https://x-client.printify.me'), 'https://x-client.printify.me/');
  assert.equal(printifyStoreUrl('https://x-client.printify.me/'), 'https://x-client.printify.me/');
  for (const value of ['http://x-client.printify.me', 'https://x-client.printify.me.evil.example/',
    'https://user:password@x-client.printify.me/', 'https://x-client.printify.me:444/',
    'https://x-client.printify.me/admin', 'https://x-client.printify.me/?redirect=elsewhere', 'javascript:alert(1)']) {
    assert.equal(printifyStoreUrl(value), null, value);
  }
});

function clientWith(data, overrides = {}) {
  const requests = [];
  const client = new Storefront({ ...config, ...overrides }, async (url, request) => {
    requests.push({ url, ...request, body: JSON.parse(request.body) });
    return { ok: true, json: async () => ({ data }) };
  });
  return { client, requests };
}

test('tokenless catalog requests use the storefront endpoint and paginate without unused variables', async () => {
  const products = { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'next' } };
  const { client, requests } = clientWith({ products, shop: { name: 'X' } });
  assert.equal((await client.products('previous')).pageInfo.endCursor, 'next');
  const request = requests[0];
  assert.equal(request.url, 'https://test-shop.myshopify.com/api/2026-10/graphql.json');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers['X-Shopify-Storefront-Access-Token'], undefined);
  assert.deepEqual(request.body.variables, { country: null, language: 'DE', after: 'previous' });
  assert.doesNotMatch(request.body.query, /\$handle/);
  assert.match(request.body.query, /pageInfo \{ hasNextPage endCursor \}/);
});

test('collection, public token and market context are included when configured', async () => {
  const { client, requests } = clientWith({ collection: { products: { nodes: [], pageInfo: {} } } }, {
    collectionHandle: 'x-merch', publicAccessToken: 'public-storefront-token', countryCode: 'CH', language: 'EN'
  });
  await client.products();
  assert.match(requests[0].body.query, /collection\(handle: \$handle\)/);
  assert.equal(requests[0].body.variables.handle, 'x-merch');
  assert.equal(requests[0].body.variables.country, 'CH');
  assert.equal(requests[0].body.variables.language, 'EN');
  assert.equal(requests[0].headers['X-Shopify-Storefront-Access-Token'], 'public-storefront-token');
});

test('missing collections fail clearly instead of returning all products', async () => {
  const { client } = clientWith({ collection: null }, { collectionHandle: 'missing' });
  await assert.rejects(client.products(), /COLLECTION_UNAVAILABLE/);
});

test('additional variants are loaded independently with the product ID and pagination cursor', async () => {
  const variants = { nodes: [{ id: variantId }], pageInfo: { hasNextPage: false, endCursor: 'last' } };
  const { client, requests } = clientWith({ node: { variants } });
  assert.deepEqual(await client.variants('gid://shopify/Product/1', 'next'), variants);
  assert.equal(requests[0].body.variables.id, 'gid://shopify/Product/1');
  assert.equal(requests[0].body.variables.after, 'next');
  assert.match(requests[0].body.query, /variants\(first: 100, after: \$after\)/);
});

test('cart creation sends the selected variant and the same Shopify Market used for pricing', async () => {
  const cart = { id: cartId };
  const { client, requests } = clientWith({ cartCreate: { cart, userErrors: [], warnings: [] } }, { countryCode: 'CH' });
  assert.equal((await client.add(null, variantId)).cart, cart);
  assert.deepEqual(requests[0].body.variables.input, {
    lines: [{ merchandiseId: variantId, quantity: 1 }], buyerIdentity: { countryCode: 'CH' }
  });
});

test('adding to an existing cart reuses its ID and preserves Shopify stock warnings', async () => {
  const warnings = [{ code: 'MERCHANDISE_NOT_ENOUGH_STOCK', message: 'Quantity adjusted' }];
  const { client, requests } = clientWith({ cartLinesAdd: { cart: { id: cartId }, warnings, userErrors: [] } });
  assert.deepEqual((await client.add(cartId, variantId, 2)).warnings, warnings);
  assert.deepEqual(requests[0].body.variables.lines, [{ merchandiseId: variantId, quantity: 2 }]);
  assert.equal(requests[0].body.variables.id, cartId);
  assert.match(requests[0].body.query, /cartLinesAdd/);
});

test('quantity updates and removal use distinct Shopify mutations', async () => {
  const { client, requests } = clientWith({
    cartLinesUpdate: { cart: {}, userErrors: [] }, cartLinesRemove: { cart: {}, userErrors: [] }
  });
  await client.update(cartId, 'line-1', 3);
  await client.update(cartId, 'line-1', 0);
  assert.deepEqual(requests[0].body.variables.lines, [{ id: 'line-1', quantity: 3 }]);
  assert.match(requests[1].body.query, /cartLinesRemove/);
  assert.deepEqual(requests[1].body.variables.lines, ['line-1']);
  for (const quantity of [-1, 100, 1.5, NaN]) assert.throws(() => client.update(cartId, 'line-1', quantity), /INVALID_QUANTITY/);
  assert.equal(requests.length, 2);
});

test('Shopify cart errors are rejected even when a partial cart is returned', async () => {
  const { client } = clientWith({ cartCreate: { cart: { id: cartId }, userErrors: [{ message: 'Out of stock' }] } });
  await assert.rejects(client.add(null, variantId), /CART_REJECTED/);
});

test('HTTP and GraphQL failures reject without retrying purchase mutations', async () => {
  for (const response of [{ ok: false }, { ok: true, json: async () => ({ errors: [{ message: 'Denied' }] }) }]) {
    let calls = 0;
    const client = new Storefront(config, async () => { calls++; return response; });
    await assert.rejects(client.add(null, variantId), /SHOP_UNAVAILABLE/);
    assert.equal(calls, 1);
  }
});

test('checkout refreshes the existing cart and uses the URL Shopify returns', async () => {
  const cart = { id: cartId, totalQuantity: 2, checkoutUrl: 'https://test-shop.myshopify.com/checkouts/real-cart?key=buyer' };
  const { client, requests } = clientWith({ cart });
  assert.equal(await client.checkout(cartId), cart);
  assert.match(requests[0].body.query, /query ShopCart/);
  assert.equal(requests[0].body.variables.id, cartId);
  assert.equal(requests.length, 1);
});

test('expired carts, empty carts and unsafe checkout URLs cannot initiate payment', async () => {
  for (const cart of [null, { totalQuantity: 0, checkoutUrl: 'https://shop.example/checkout' },
    { totalQuantity: 1, checkoutUrl: 'javascript:alert(1)' }, { totalQuantity: 1, checkoutUrl: 'http://shop.example/checkout' }]) {
    const { client } = clientWith({ cart });
    await assert.rejects(client.checkout(cartId), /INVALID_CHECKOUT/);
  }
});

test('invalid shop domains and recognizable private credentials fail before making a request', () => {
  for (const shopDomain of ['', 'https://shop.myshopify.com', 'shop.myshopify.com.evil.example', 'shop.myshopify.com/path', 'shop.example']) {
    assert.throws(() => new Storefront({ ...config, shopDomain }), /INVALID_SHOP/);
  }
  for (const publicAccessToken of ['shpat_private', 'shpss_secret', 'shppa_private']) {
    assert.throws(() => new Storefront({ ...config, publicAccessToken }), /PRIVATE_TOKEN/);
  }
  assert.equal(safeHttps('javascript:alert(1)'), null);
  assert.equal(safeHttps('https://user:password@example.com'), null);
  assert.equal(safeHttps('https://cdn.shopify.com/image.png'), 'https://cdn.shopify.com/image.png');
});
