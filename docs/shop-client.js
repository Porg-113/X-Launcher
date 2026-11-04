'use strict';

// Shared by the browser storefront and its request/checkout tests.
(function (root) {
  const variantFields = `id title availableForSale price { amount currencyCode }
    image { url altText width height }`;
  const productFields = `id title description onlineStoreUrl featuredImage { url altText width height }
    variants(first: 20) { nodes { ${variantFields} } pageInfo { hasNextPage endCursor } }`;
  const cartFields = `id checkoutUrl totalQuantity
    cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
    lines(first: 100) { nodes { id quantity cost { totalAmount { amount currencyCode } }
      merchandise { ... on ProductVariant { ${variantFields} product { title } } }
    } }
  `;
  const context = '@inContext(country: $country, language: $language)';
  const contextVariables = '$country: CountryCode, $language: LanguageCode';

  function safeHttps(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }

  function printifyStoreUrl(value) {
    const href = safeHttps(value);
    if (!href) return null;
    const url = new URL(href);
    if (!/^[a-z0-9][a-z0-9-]*\.printify\.me$/.test(url.hostname) || url.port || url.pathname !== '/' || url.search || url.hash) return null;
    return url.href;
  }

  class Storefront {
    constructor(config, fetcher = globalThis.fetch) {
      const domain = (config.shopDomain || '').trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) throw new Error('INVALID_SHOP');
      if (!/^\d{4}-(01|04|07|10)$/.test(config.apiVersion)) throw new Error('INVALID_VERSION');
      if (/^(shpat_|shpca_|shpss_|shppa_|shpua_)/i.test(config.publicAccessToken || '')) throw new Error('PRIVATE_TOKEN');
      if (config.countryCode && !/^[A-Z]{2}$/.test(config.countryCode)) throw new Error('INVALID_COUNTRY');
      this.domain = domain;
      this.endpoint = `https://${domain}/api/${config.apiVersion}/graphql.json`;
      this.token = config.publicAccessToken || '';
      this.country = config.countryCode || null;
      this.language = config.language === 'EN' ? 'EN' : 'DE';
      this.collection = config.collectionHandle || '';
      this.fetcher = fetcher;
    }

    async request(query, variables = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
        if (this.token) headers['X-Shopify-Storefront-Access-Token'] = this.token;
        const response = await this.fetcher(this.endpoint, {
          method: 'POST', headers, signal: controller.signal,
          body: JSON.stringify({ query, variables: { country: this.country, language: this.language, ...variables } })
        });
        if (!response.ok) throw new Error('SHOP_UNAVAILABLE');
        const result = await response.json();
        if (result.errors?.length || !result.data) throw new Error('SHOP_UNAVAILABLE');
        return result.data;
      } finally { clearTimeout(timeout); }
    }

    async products(after = null) {
      // Keep the 12-product query below Shopify's tokenless complexity limit.
      const connection = `products(first: 12, after: $after) {
        nodes { ${productFields} } pageInfo { hasNextPage endCursor }
      }`;
      const selection = this.collection ? `collection(handle: $handle) { ${connection} }` : connection;
      const handleVariable = this.collection ? '$handle: String, ' : '';
      const data = await this.request(`query ShopProducts($after: String, ${handleVariable}${contextVariables}) ${context} {
        shop { name privacyPolicy { url } refundPolicy { url } termsOfService { url } shippingPolicy { url } }
        ${selection}
      }`, { after, ...(this.collection ? { handle: this.collection } : {}) });
      const products = this.collection ? data.collection?.products : data.products;
      if (!products) throw new Error('COLLECTION_UNAVAILABLE');
      return { ...products, shop: data.shop };
    }

    async variants(id, after) {
      const data = await this.request(`query ShopVariants($id: ID!, $after: String, ${contextVariables}) ${context} {
        node(id: $id) { ... on Product {
          variants(first: 100, after: $after) { nodes { ${variantFields} } pageInfo { hasNextPage endCursor } }
        } }
      }`, { id, after });
      if (!data.node?.variants) throw new Error('PRODUCT_UNAVAILABLE');
      return data.node.variants;
    }

    async cart(id) {
      const data = await this.request(`query ShopCart($id: ID!, ${contextVariables}) ${context} {
        cart(id: $id) { ${cartFields} }
      }`, { id });
      return data.cart;
    }

    async mutate(name, declarations, args, variables) {
      const data = await this.request(`mutation ShopCart(${declarations}, ${contextVariables}) ${context} {
        ${name}(${args}) { cart { ${cartFields} } userErrors { message code } warnings { code message } }
      }`, variables);
      const result = data[name];
      if (result.userErrors?.length || !result.cart) throw new Error('CART_REJECTED');
      return { cart: result.cart, warnings: result.warnings || [] };
    }

    add(id, merchandiseId, quantity = 1) {
      if (id) return this.mutate('cartLinesAdd', '$id: ID!, $lines: [CartLineInput!]!', 'cartId: $id, lines: $lines', {
        id, lines: [{ merchandiseId, quantity }]
      });
      return this.mutate('cartCreate', '$input: CartInput!', 'input: $input', {
        input: { lines: [{ merchandiseId, quantity }], ...(this.country ? { buyerIdentity: { countryCode: this.country } } : {}) }
      });
    }

    update(id, lineId, quantity) {
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) throw new Error('INVALID_QUANTITY');
      if (!quantity) return this.mutate('cartLinesRemove', '$id: ID!, $lines: [ID!]!', 'cartId: $id, lineIds: $lines', { id, lines: [lineId] });
      return this.mutate('cartLinesUpdate', '$id: ID!, $lines: [CartLineUpdateInput!]!', 'cartId: $id, lines: $lines', {
        id, lines: [{ id: lineId, quantity }]
      });
    }

    async checkout(id) {
      // Revalidate the live cart immediately before navigating. Shopify calculates final shipping/taxes.
      const cart = await this.cart(id);
      if (!cart?.totalQuantity || !safeHttps(cart.checkoutUrl)) throw new Error('INVALID_CHECKOUT');
      return cart;
    }
  }

  const api = { Storefront, safeHttps, printifyStoreUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.XShop = api;
})(globalThis);
