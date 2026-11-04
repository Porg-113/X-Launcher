'use strict';

// Public shop configuration. Never put private API credentials here.
// See website-shop-setup.md in the project root for the Shopify setup.
window.X_SHOP_CONFIG = Object.freeze({
  provider: 'printify',
  shopUrl: 'https://x-client.printify.me/',
  comingSoon: true, // Set false once products have been published in the Pop-Up Store.
  // Optional future Shopify integration (only used with provider: 'shopify').
  shopDomain: '', // Your exact Shopify domain, e.g. your-shop.myshopify.com
  publicAccessToken: '', // Optional PUBLIC Storefront token; tokenless access is supported.
  apiVersion: '2026-10',
  collectionHandle: '', // Empty = all products published to this storefront.
  countryCode: '' // Optional Shopify Market, e.g. CH; empty = shop default.
});
