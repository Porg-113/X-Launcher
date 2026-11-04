'use strict';

(() => {
  const $ = selector => document.querySelector(selector);
  const t = (de, en) => document.documentElement.lang === 'en' ? en : de;
  const config = window.X_SHOP_CONFIG || {};

  // Printify Pop-Up owns product selection, cart and checkout. It is linked directly;
  // it cannot use the Shopify Storefront API or a private Printify token in a static page.
  if (config.provider === 'printify') {
    const shopUrl = XShop.printifyStoreUrl(config.shopUrl);
    function renderPrintify() {
      const comingSoon = config.comingSoon !== false;
      $('#catalog-state-title').textContent = shopUrl
        ? (comingSoon ? t('Die Kollektion kommt bald.', 'The collection is coming soon.') : t('Entdecke die Kollektion.', 'Explore the collection.'))
        : t('Der Shop ist gerade nicht erreichbar.', 'The shop is currently unavailable.');
      $('#catalog-state-description').textContent = !shopUrl
        ? t('Bitte schau später wieder vorbei.', 'Please check back later.')
        : (comingSoon
          ? t('Aktuell sind noch keine Produkte veröffentlicht. Schau bald wieder vorbei.', 'No products have been published yet. Check back soon.')
          : t('Unsere Produkte und die verfügbaren Varianten findest du direkt in unserem Printify-Shop.', 'Find our products and available variants directly in our Printify shop.'));
      if (!comingSoon && shopUrl) {
        $('.shop-lead').textContent = t('Finde, was zu dir passt. Entdecke unsere Kollektion im Printify-Shop.', 'Find what suits you. Explore our collection in the Printify shop.');
        $('#printify-title').textContent = t('Dein nächstes Lieblingsstück.', 'Your next favourite.');
        $('#printify-details > p:not(.eyebrow)').textContent = t('Wähle Größe und Farbe in unserem Printify-Shop aus und schließe dort deine Bestellung ab.', 'Choose your size and colour in our Printify shop and complete your order there.');
      }
      document.querySelectorAll('[data-printify-shop-link]').forEach(link => {
        link.hidden = !shopUrl;
        if (shopUrl) link.href = shopUrl;
      });
    }
    renderPrintify();
    window.addEventListener('languagechange', renderPrintify);
    return;
  }

  if (config.provider === 'shopify' || config.shopDomain) {
    $('#printify-open').hidden = true;
    $('#printify-state-link').hidden = true;
    $('#printify-details').hidden = true;
    $('#shopify-bag').hidden = false;
    $('#warenkorb').hidden = false;
    $('.shop-layout').classList.remove('printify-mode');
    $('.shop-lead').textContent = t('Finde, was zu dir passt. Such dir dein Lieblingsstück aus und mach es zu deinem.', 'Find what suits you. Choose your favourite and make it yours.');
  }
  const state = { products: [], pageInfo: {}, cart: null, busy: false, loading: false, restoring: false, cartReady: false, shop: null };
  let client;
  let storageKey;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function money(value) {
    if (!value || !Number.isFinite(Number(value.amount))) return '—';
    return new Intl.NumberFormat(t('de-CH', 'en'), { style: 'currency', currency: value.currencyCode }).format(Number(value.amount));
  }

  function image(data, className, fallback = '') {
    const url = XShop.safeHttps(data?.url);
    if (!url) return element('span', className + (fallback ? ' product-placeholder' : ''), fallback);
    const node = element('img', className);
    node.src = url;
    node.alt = data.altText || '';
    node.loading = 'lazy';
    node.decoding = 'async';
    return node;
  }

  function status(de = '', en = '', error = false) {
    $('#bag-status').textContent = t(de, en);
    $('#bag-status').dataset.error = String(error);
  }

  function storedCart() {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  }

  function acceptCart(cart) {
    state.cart = cart;
    try {
      if (cart?.id) localStorage.setItem(storageKey, cart.id);
      else localStorage.removeItem(storageKey);
    } catch { /* The cart also works when browser storage is unavailable. */ }
    renderCart();
  }

  function syncControls() {
    document.querySelectorAll('[data-shop-action]').forEach(button => {
      button.disabled = state.busy || !state.cartReady || button.dataset.unavailable === 'true';
    });
    $('#checkout').disabled = state.busy || !state.cartReady || !state.cart?.totalQuantity;
    $('#warenkorb').setAttribute('aria-busy', String(state.busy));
    $('#load-more').disabled = state.loading;
    $('#shop-retry').disabled = state.loading;
    $('#cart-retry').disabled = state.busy || state.restoring;
  }

  function catalogMessage(title, description, retry = false) {
    $('#catalog-state').hidden = false;
    $('#catalog-state-title').textContent = title;
    $('#catalog-state-description').textContent = description;
    $('#shop-retry').hidden = !retry;
  }

  function renderPolicies() {
    const links = $('#shop-policies');
    links.replaceChildren();
    for (const [key, label] of [
      ['privacyPolicy', t('Datenschutz', 'Privacy')], ['refundPolicy', t('Rückgabe', 'Returns')],
      ['termsOfService', t('AGB', 'Terms')], ['shippingPolicy', t('Versand', 'Shipping')]
    ]) {
      const href = XShop.safeHttps(state.shop?.[key]?.url);
      if (!href) continue;
      const link = element('a', '', label);
      link.href = href;
      links.append(link);
    }
  }

  function renderProducts() {
    const grid = $('#product-grid');
    grid.replaceChildren();
    for (const product of state.products) {
      const variants = product.variants.nodes;
      let selected = variants.find(variant => variant.id === product.selectedVariantId)
        || variants.find(variant => variant.availableForSale) || variants[0];
      const card = element('article', 'product-card');
      const visual = element('div', 'product-visual');
      const stock = element('span', 'stock-label', t('Ausverkauft', 'Sold out'));
      const heading = element('div', 'product-heading');
      const title = element('h3', '', product.title);
      const price = element('p', 'product-price');
      heading.append(title, price);
      card.append(visual, heading);

      if (product.description) {
        const description = element('p', 'product-description', product.description.length > 160 ? product.description.slice(0, 160).trimEnd() + '…' : product.description);
        card.append(description);
        if (product.description.length > 160) {
          const toggle = element('button', 'product-description-toggle', t('Mehr lesen', 'Read more'));
          toggle.type = 'button';
          toggle.setAttribute('aria-expanded', 'false');
          toggle.addEventListener('click', () => {
            const expanded = toggle.getAttribute('aria-expanded') !== 'true';
            toggle.setAttribute('aria-expanded', String(expanded));
            description.textContent = expanded ? product.description : product.description.slice(0, 160).trimEnd() + '…';
            toggle.textContent = expanded ? t('Weniger lesen', 'Read less') : t('Mehr lesen', 'Read more');
          });
          card.append(toggle);
        }
      }

      const controls = element('div', 'product-controls');
      const add = element('button', 'button secondary');
      add.type = 'button';
      add.dataset.shopAction = 'add';
      const updateVariant = () => {
        visual.replaceChildren(image(selected?.image || product.featuredImage, 'product-image', 'X'), stock);
        stock.hidden = Boolean(selected?.availableForSale);
        price.textContent = money(selected?.price);
        add.textContent = selected?.availableForSale ? t('In den Warenkorb', 'Add to bag') : t('Ausverkauft', 'Sold out');
        add.dataset.unavailable = String(!selected?.availableForSale);
        add.setAttribute('aria-label', selected?.availableForSale ? t(`${product.title} in den Warenkorb`, `Add ${product.title} to bag`) : t(`${product.title}: ausverkauft`, `${product.title}: sold out`));
        syncControls();
      };
      let select;
      const appendOption = variant => {
        const option = element('option', '', variant.title + (variant.availableForSale ? '' : t(' · Ausverkauft', ' · Sold out')));
        option.value = variant.id;
        select.append(option);
      };
      if (variants.length > 1 || (selected && selected.title !== 'Default Title')) {
        const label = element('label', 'variant-label', t('Variante', 'Variant'));
        select = element('select', 'variant-select');
        variants.forEach(appendOption);
        select.value = selected?.id || '';
        select.addEventListener('change', () => {
          selected = variants.find(variant => variant.id === select.value);
          product.selectedVariantId = selected?.id;
          updateVariant();
        });
        label.append(select);
        controls.append(label);
      }
      add.addEventListener('click', () => addToCart(selected));
      controls.append(add);
      if (product.variants.pageInfo.hasNextPage) {
        const more = element('button', 'product-more', t('Weitere Varianten laden', 'Load more variants'));
        more.type = 'button';
        more.addEventListener('click', async () => {
          more.disabled = true;
          more.textContent = t('Varianten werden geladen …', 'Loading variants …');
          try {
            const result = await client.variants(product.id, product.variants.pageInfo.endCursor);
            for (const variant of result.nodes) {
              if (variants.some(existing => existing.id === variant.id)) continue;
              variants.push(variant);
              appendOption(variant);
            }
            product.variants.pageInfo = result.pageInfo;
            more.hidden = !result.pageInfo.hasNextPage;
          } catch {
            status('Weitere Varianten konnten nicht geladen werden. Bitte versuche es erneut.', 'More variants could not be loaded. Please try again.', true);
          } finally {
            more.disabled = false;
            more.textContent = t('Weitere Varianten laden', 'Load more variants');
          }
        });
        controls.append(more);
      }
      card.append(controls);
      grid.append(card);
      updateVariant();
    }
    syncControls();
  }

  function renderCart() {
    const lines = $('#bag-lines');
    lines.replaceChildren();
    $('#bag-count').textContent = state.cart?.totalQuantity || 0;
    $('#bag-subtotal').textContent = money(state.cart?.cost?.subtotalAmount);
    if (!state.cart?.totalQuantity) lines.append(element('p', 'bag-empty', t('Noch leer. Dein nächstes Lieblingsstück wartet schon.', 'Still empty. Your next favourite is waiting.')));
    for (const line of state.cart?.lines.nodes || []) {
      const variant = line.merchandise;
      const row = element('article', 'bag-line');
      const detail = element('div');
      row.append(image(variant.image, 'bag-image'));
      detail.append(element('h3', 'bag-line-title', variant.product.title));
      if (variant.title !== 'Default Title') detail.append(element('p', 'bag-variant', variant.title));
      detail.append(element('p', 'bag-line-price', money(line.cost.totalAmount)));
      const quantity = element('div', 'quantity-controls');
      for (const [label, text, amount] of [
        [t('Anzahl verringern', 'Decrease quantity'), '−', line.quantity - 1],
        [t('Anzahl erhöhen', 'Increase quantity'), '+', line.quantity + 1],
        [t('Entfernen', 'Remove'), t('Entfernen', 'Remove'), 0]
      ]) {
        const button = element('button', amount === 0 && text !== '−' ? 'remove-line' : '', text);
        button.type = 'button';
        button.setAttribute('aria-label', `${label}: ${variant.product.title}`);
        button.dataset.shopAction = 'quantity';
        button.dataset.unavailable = String(amount > 99);
        button.addEventListener('click', () => cartAction(() => client.update(state.cart.id, line.id, amount)));
        quantity.append(button);
        if (text === '−') {
          const output = element('output', '', line.quantity);
          output.setAttribute('aria-label', t('Anzahl', 'Quantity'));
          quantity.append(output);
        }
      }
      detail.append(quantity);
      row.append(detail);
      lines.append(row);
    }
    syncControls();
  }

  async function loadProducts(append = false) {
    if (state.loading) return;
    state.loading = true;
    $('.catalog').setAttribute('aria-busy', 'true');
    if (!append) catalogMessage(t('Kollektion wird geladen …', 'Loading the collection …'), t('Einen Moment noch.', 'Just a moment.'));
    syncControls();
    try {
      const result = await client.products(append ? state.pageInfo.endCursor : null);
      state.products = append ? [...state.products, ...result.nodes] : result.nodes;
      state.pageInfo = result.pageInfo;
      state.shop = result.shop;
      renderProducts();
      renderPolicies();
      $('#catalog-state').hidden = state.products.length > 0;
      if (!state.products.length) catalogMessage(t('Bald gibt es hier mehr.', 'Something good is coming.'), t('Aktuell sind keine Produkte verfügbar. Schau später wieder vorbei.', 'No products are available right now. Check back soon.'));
      $('#load-more').hidden = !state.pageInfo.hasNextPage;
    } catch {
      if (!state.products.length) catalogMessage(t('Die Kollektion lädt gerade nicht.', 'The collection could not be loaded.'), t('Bitte versuche es gleich noch einmal.', 'Please try again in a moment.'), true);
      else status('Weitere Produkte konnten nicht geladen werden. Bitte versuche es erneut.', 'More products could not be loaded. Please try again.', true);
    } finally {
      state.loading = false;
      $('.catalog').setAttribute('aria-busy', 'false');
      syncControls();
    }
  }

  async function restoreCart() {
    if (state.restoring || state.busy) return;
    state.restoring = true;
    state.cartReady = false;
    syncControls();
    const id = storedCart();
    try {
      if (id) acceptCart(await client.cart(id));
      state.cartReady = true;
      $('#cart-retry').hidden = true;
      status();
    } catch {
      $('#cart-retry').hidden = false;
      status('Dein Warenkorb konnte nicht geladen werden. Bitte versuche es erneut.', 'Your bag could not be loaded. Please try again.', true);
    } finally { state.restoring = false; syncControls(); }
  }

  async function cartAction(action) {
    if (state.busy || !state.cartReady) return;
    state.busy = true;
    status('Warenkorb wird aktualisiert …', 'Updating your bag …');
    syncControls();
    try {
      const result = await action();
      acceptCart(result.cart);
      if (result.warnings.length) status('Shopify hat deinen Warenkorb angepasst. Bitte prüfe Varianten und Mengen.', 'Shopify adjusted your bag. Please check variants and quantities.', true);
      else status('Warenkorb aktualisiert.', 'Bag updated.');
    } catch {
      // A response can fail after Shopify has applied a change; reconcile instead of retrying the mutation.
      if (state.cart?.id) {
        try { acceptCart(await client.cart(state.cart.id)); }
        catch { state.cartReady = false; $('#cart-retry').hidden = false; }
      }
      status('Die Änderung konnte nicht bestätigt werden. Bitte prüfe deinen Warenkorb und versuche es erneut.', 'The change could not be confirmed. Please check your bag and try again.', true);
    } finally { state.busy = false; syncControls(); }
  }

  function addToCart(variant) {
    if (!variant?.availableForSale) return;
    const lines = state.cart?.lines.nodes || [];
    const existing = lines.find(line => line.merchandise.id === variant.id);
    if (existing?.quantity >= 99 || (!existing && lines.length >= 100)) {
      status('Die maximale Menge im Warenkorb ist erreicht.', 'The maximum bag quantity has been reached.', true);
      return;
    }
    cartAction(() => client.add(state.cart?.id, variant.id));
  }

  function cartSnapshot(cart) {
    return JSON.stringify({ cost: cart?.cost, lines: cart?.lines.nodes.map(line => [line.id, line.quantity, line.cost, line.merchandise.availableForSale]) });
  }

  async function checkout() {
    if (state.busy || !state.cartReady || !state.cart?.totalQuantity) return;
    state.busy = true;
    status('Warenkorb wird geprüft …', 'Checking your bag …');
    syncControls();
    try {
      const before = cartSnapshot(state.cart);
      const cart = await client.checkout(state.cart.id);
      acceptCart(cart);
      if (cart.lines.nodes.some(line => !line.merchandise.availableForSale)) {
        status('Ein Artikel ist nicht mehr verfügbar. Bitte entferne ihn vor dem Bezahlen.', 'An item is no longer available. Please remove it before checking out.', true);
      } else if (before !== cartSnapshot(cart)) {
        status('Dein Warenkorb wurde aktualisiert. Prüfe die Preise und Mengen und klicke erneut auf „Zur Kasse“.', 'Your bag was updated. Check prices and quantities, then click Checkout again.', true);
      } else {
        status('Weiter zur Kasse …', 'Opening checkout …');
        window.location.assign(cart.checkoutUrl);
      }
    } catch {
      status('Die Kasse konnte nicht geöffnet werden. Bitte lade deinen Warenkorb erneut.', 'Checkout could not be opened. Please reload your bag.', true);
      $('#cart-retry').hidden = false;
    } finally { state.busy = false; syncControls(); }
  }

  $('#shop-retry').addEventListener('click', () => loadProducts());
  $('#load-more').addEventListener('click', () => loadProducts(true));
  $('#checkout').addEventListener('click', checkout);
  const retryCart = element('button', 'button secondary', t('Warenkorb erneut laden', 'Reload your bag'));
  retryCart.id = 'cart-retry';
  retryCart.type = 'button';
  retryCart.hidden = true;
  retryCart.addEventListener('click', restoreCart);
  $('#warenkorb').append(retryCart);

  if (!config.shopDomain) return;
  try {
    client = new XShop.Storefront({ ...config, language: t('DE', 'EN') });
    storageKey = `x-client-shop-cart:${client.domain}:${client.country || 'default'}`;
  } catch {
    catalogMessage(t('Der Shop ist gerade nicht erreichbar.', 'The shop is currently unavailable.'), t('Bitte schau später wieder vorbei.', 'Please check back later.'));
    return;
  }
  loadProducts();
  restoreCart();

  window.addEventListener('languagechange', () => {
    client.language = t('DE', 'EN');
    retryCart.textContent = t('Warenkorb erneut laden', 'Reload your bag');
    renderProducts();
    renderCart();
    renderPolicies();
    status();
  });
})();
