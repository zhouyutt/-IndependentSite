<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { Heart, Leaf, Menu, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Star, Truck, X } from 'lucide-vue-next';
import { storeApi } from './lib/api.js';

const loading = ref(true);
const error = ref('');
const products = ref([]);
const facets = ref({ categories: [], collections: [], colors: [], priceRange: { min: 0, max: 1200 } });
const cart = ref({ items: [], summary: { subtotal: 0, shipping: 0, tax: 0, total: 0 } });
const wishlist = ref({ products: [] });
const selectedProduct = ref(null);
const cartOpen = ref(false);
const navOpen = ref(false);
const checkoutOpen = ref(false);
const order = ref(null);
const paypalConfig = ref({ enabled: false, mode: 'sandbox', clientId: '' });
const paypalContainer = ref(null);
const paypalReady = ref(false);
const paypalLoading = ref(false);
const paymentError = ref('');
const deliveryConfirmed = ref(false);

const filters = reactive({ q: '', category: '', collection: '', color: '', maxPrice: '', sort: 'popular' });
const checkout = reactive({ name: '', email: '', address: '', city: '', state: '', zip: '' });

const wishlistIds = computed(() => new Set(wishlist.value.products.map((item) => item.id)));
const cartCount = computed(() => cart.value.items.reduce((sum, item) => sum + item.quantity, 0));

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value % 1 ? 2 : 0 }).format(value || 0);
}

async function loadProducts() {
  loading.value = true;
  error.value = '';
  try {
    const data = await storeApi.products(filters);
    products.value = data.products;
    facets.value = data.facets;
  } catch (err) {
    error.value = err.message || 'Unable to load products.';
  } finally {
    loading.value = false;
  }
}

async function boot() {
  await Promise.all([loadProducts(), refreshCart(), refreshWishlist(), loadPayPalConfig()]);
}

async function refreshCart() {
  cart.value = await storeApi.cart();
}

async function refreshWishlist() {
  wishlist.value = await storeApi.wishlist();
}

async function add(product, color = product.color) {
  cart.value = await storeApi.addToCart({ productId: product.id, quantity: 1, color });
  selectedProduct.value = null;
  cartOpen.value = true;
}

async function updateQuantity(productId, quantity) {
  cart.value = await storeApi.updateCart(productId, quantity);
}

async function toggleWish(product) {
  wishlist.value = await storeApi.toggleWishlist(product.id);
}

async function submitCheckout() {
  deliveryConfirmed.value = true;
  paymentError.value = '';
  await renderPayPalButtons();
}

async function loadPayPalConfig() {
  paypalConfig.value = await storeApi.paypalConfig();
}

async function loadPayPalSdk() {
  if (!paypalConfig.value.enabled) return false;
  if (window.paypal?.Buttons) return true;
  const existing = document.querySelector('script[data-paypal-sdk]');
  if (existing) existing.remove();
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.dataset.paypalSdk = 'true';
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalConfig.value.clientId)}&currency=USD&intent=capture&components=buttons`;
    script.onload = resolve;
    script.onerror = () => reject(new Error('PayPal SDK failed to load.'));
    document.head.appendChild(script);
  });
  return Boolean(window.paypal?.Buttons);
}

async function renderPayPalButtons() {
  await nextTick();
  if (!paypalContainer.value || paypalReady.value || !deliveryConfirmed.value) return;
  if (!paypalConfig.value.enabled) {
    paymentError.value = 'PayPal 收款账户尚未绑定，请先在运营后台完成 PayPal 配置。';
    return;
  }
  paypalLoading.value = true;
  try {
    await loadPayPalSdk();
    paypalContainer.value.innerHTML = '';
    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
      async createOrder() {
        const data = await storeApi.createPayPalOrder({ ...checkout });
        return data.paypalOrderId;
      },
      async onApprove(data) {
        const result = await storeApi.capturePayPalOrder(data.orderID);
        order.value = result.order;
        checkoutOpen.value = false;
        cartOpen.value = false;
        deliveryConfirmed.value = false;
        paypalReady.value = false;
        await refreshCart();
        Object.keys(checkout).forEach((key) => { checkout[key] = ''; });
      },
      onCancel() {
        paymentError.value = 'PayPal payment was canceled. You can try again when ready.';
      },
      onError(err) {
        paymentError.value = err?.message || 'PayPal payment failed. Please try again.';
      }
    }).render(paypalContainer.value);
    paypalReady.value = true;
  } catch (err) {
    paymentError.value = err.message || 'Unable to initialize PayPal checkout.';
  } finally {
    paypalLoading.value = false;
  }
}

function closeCheckout() {
  checkoutOpen.value = false;
  deliveryConfirmed.value = false;
  paypalReady.value = false;
  paymentError.value = '';
}

onMounted(boot);
</script>

<template>
  <div class="site-shell">
    <div class="topbar">
      <a href="#showrooms">Showrooms</a>
      <span><Truck :size="15" /> Free delivery on sports and fitness equipment orders.</span>
      <a href="#service">Customer Service</a>
    </div>

    <header class="site-header">
      <button class="icon-button mobile-only" aria-label="Open navigation" @click="navOpen = true"><Menu :size="21" /></button>
      <a class="brand" href="#home" aria-label="FREG LLC home"><span>FREG LLC</span></a>
      <nav class="desktop-nav" aria-label="Primary navigation">
        <a href="#shop">Basketball</a>
        <a href="#shop">Fitness</a>
        <a href="#shop">Strength</a>
        <a href="#collections">Collections</a>
        <a href="#materials">The Difference</a>
      </nav>
      <div class="header-actions">
        <label class="search-field">
          <Search :size="17" />
          <input v-model="filters.q" type="search" aria-label="Search hoops, treadmills, carts" @input="loadProducts" />
        </label>
        <button class="icon-button" aria-label="Open cart" @click="cartOpen = true">
          <ShoppingBag :size="20" />
          <span v-if="cartCount" class="count">{{ cartCount }}</span>
        </button>
      </div>
    </header>

    <aside class="mobile-menu" :class="{ open: navOpen }">
      <button class="icon-button close" aria-label="Close navigation" @click="navOpen = false"><X :size="20" /></button>
      <a href="#shop" @click="navOpen = false">Shop All</a>
      <a href="#collections" @click="navOpen = false">Collections</a>
      <a href="#materials" @click="navOpen = false">The Difference</a>
    </aside>

    <main id="home">
      <section class="hero">
        <img class="hero-bg" src="/assets/product-weight-bench.jpg" alt="DASHINGNOAH foldable weight bench set in use" />
        <div class="hero-copy">
          <p class="eyebrow">California e-commerce, retail, and wholesale</p>
          <h1>Gear Up Your Game</h1>
          <a class="button primary" href="#shop">Shop Best Sellers</a>
        </div>
      </section>

      <section class="promo-split">
        <article>
          <img src="/assets/promo-basketball.jpg" alt="DASHINGNOAH adjustable basketball hoop height configurations" />
          <div>
            <p class="eyebrow">FREG LLC retail catalog</p>
            <h2>Sports equipment for home courts and active routines.</h2>
            <p>Basketball hoops, portable treadmills, and foldable equipment carts curated by FREG LLC for direct-to-consumer storefront browsing.</p>
            <a class="button secondary" href="#shop">Shop Now</a>
          </div>
        </article>
        <article>
          <img src="/assets/promo-treadmill.jpg" alt="DASHINGNOAH portable treadmill with incline" />
          <div>
            <p class="eyebrow">Ready for training</p>
            <h2>Compact gear for everyday movement.</h2>
            <p>Compare sports and fitness products from one organized catalog with inventory and order operations behind it.</p>
            <a class="button secondary" href="#shop">Shop Best Sellers</a>
          </div>
        </article>
      </section>

      <section class="difference-strip" id="materials">
        <h2>THE FREG LLC DIFFERENCE</h2>
        <div>
          <article><ShieldCheck :size="28" /><strong>Retail-Ready Catalog</strong><span>Products are tied to the Amazon links and ASINs you supplied.</span></article>
          <article><Leaf :size="28" /><strong>Compact Fulfillment</strong><span>Organized categories for sports equipment, fitness gear, and accessories.</span></article>
          <article><Truck :size="28" /><strong>Retail + Wholesale Ready</strong><span>Catalog data supports storefront sales, inventory operations, and order tracking.</span></article>
        </div>
      </section>

      <section class="section" id="collections">
        <div class="section-heading">
          <p class="eyebrow">Shop by category</p>
          <h2>Sports and fitness equipment for the way you move.</h2>
        </div>
        <div class="collection-grid">
          <button v-for="category in facets.categories" :key="category" class="collection-tile" @click="filters.category = category; loadProducts()">
            <span>{{ category }}</span>
            <small>View all</small>
          </button>
        </div>
      </section>

      <section class="shop-section" id="shop">
        <div class="shop-heading">
          <div>
            <p class="eyebrow">Shop FREG LLC catalog</p>
            <h2>DASHINGNOAH products from the supplied Amazon links</h2>
          </div>
          <button class="button ghost" @click="filters.category=''; filters.collection=''; filters.color=''; filters.maxPrice=''; filters.q=''; loadProducts()">Clear filters</button>
        </div>

        <div class="shop-layout">
          <aside class="filters" aria-label="Product filters">
            <h3><SlidersHorizontal :size="18" /> Filter By</h3>
            <label>Category
              <select v-model="filters.category" @change="loadProducts">
                <option value="">All categories</option>
                <option v-for="item in facets.categories" :key="item">{{ item }}</option>
              </select>
            </label>
            <label>Collection
              <select v-model="filters.collection" @change="loadProducts">
                <option value="">All collections</option>
                <option v-for="item in facets.collections" :key="item">{{ item }}</option>
              </select>
            </label>
            <label>Color
              <select v-model="filters.color" @change="loadProducts">
                <option value="">All colors</option>
                <option v-for="item in facets.colors" :key="item">{{ item }}</option>
              </select>
            </label>
            <label>Max price
              <input v-model="filters.maxPrice" type="range" :min="facets.priceRange.min" :max="facets.priceRange.max" @input="loadProducts" />
              <span>{{ filters.maxPrice ? money(filters.maxPrice) : 'No limit' }}</span>
            </label>
            <label>Sort
              <select v-model="filters.sort" @change="loadProducts">
                <option value="popular">Most reviewed</option>
                <option value="rating">Top rated</option>
                <option value="price-asc">Price low to high</option>
                <option value="price-desc">Price high to low</option>
              </select>
            </label>
          </aside>

          <div class="product-area">
            <div v-if="loading" class="product-grid"><div v-for="i in 6" :key="i" class="skeleton-card"></div></div>
            <div v-else-if="error" class="state-panel">{{ error }}</div>
            <div v-else-if="!products.length" class="state-panel">No products match those filters.</div>
            <div v-else class="product-grid">
              <article v-for="product in products" :key="product.id" class="product-card">
                <button class="wish" :class="{ active: wishlistIds.has(product.id) }" :aria-label="`Save ${product.name}`" @click="toggleWish(product)"><Heart :size="18" /></button>
                <button class="image-button" @click="selectedProduct = product"><img :src="product.image" :alt="product.name" /></button>
                <div class="product-meta">
                  <span class="badge">{{ product.badge }}</span>
                  <button class="product-name" @click="selectedProduct = product">{{ product.name }}</button>
                  <div class="rating"><Star :size="15" fill="currentColor" /> {{ product.rating }} <span>({{ product.reviewCount }})</span></div>
                  <div class="price-row"><strong>{{ money(product.price) }}</strong><del>{{ money(product.compareAt) }}</del></div>
                  <div class="swatches"><span v-for="color in product.colors.slice(0, 4)" :key="color" :title="color"></span></div>
                  <button class="button full" @click="add(product)">Add to Cart</button>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section class="press-band" id="reviews">
        <p class="eyebrow">Company profile</p>
        <h2>FREG LLC is a California company focused on e-commerce, retail, and wholesale.</h2>
        <p>Principal office: Redlands, California. Product data remains tied to the provided DASHINGNOAH Amazon product links so real listing data can replace the local catalog when available.</p>
      </section>
    </main>

    <aside class="drawer" :class="{ open: !!selectedProduct }" aria-live="polite">
      <button class="icon-button close" aria-label="Close product details" @click="selectedProduct = null"><X :size="20" /></button>
      <template v-if="selectedProduct">
        <img class="drawer-product-image" :src="selectedProduct.image" :alt="selectedProduct.name" />
        <span class="badge">{{ selectedProduct.badge }}</span>
        <h2>{{ selectedProduct.name }}</h2>
        <div class="rating"><Star :size="15" fill="currentColor" /> {{ selectedProduct.rating }} <span>({{ selectedProduct.reviewCount }} reviews)</span></div>
        <p>{{ selectedProduct.summary }}</p>
        <div class="price-row large"><strong>{{ money(selectedProduct.price) }}</strong><del>{{ money(selectedProduct.compareAt) }}</del></div>
        <div class="detail-block"><strong>Colors</strong><div class="pill-row"><span v-for="color in selectedProduct.colors" :key="color">{{ color }}</span></div></div>
        <div class="detail-block"><strong>Features</strong><ul><li v-for="feature in selectedProduct.features" :key="feature">{{ feature }}</li></ul></div>
        <div class="spec-grid"><div v-for="(value, key) in selectedProduct.specs" :key="key"><span>{{ key }}</span><strong>{{ value }}</strong></div></div>
        <button class="button primary full" @click="add(selectedProduct)">Add to Cart</button>
      </template>
    </aside>

    <aside class="drawer cart-drawer" :class="{ open: cartOpen }" aria-live="polite">
      <button class="icon-button close" aria-label="Close cart" @click="cartOpen = false"><X :size="20" /></button>
      <h2>Your Cart</h2>
      <div v-if="!cart.items.length" class="state-panel compact">Your equipment plan is still empty.</div>
      <div v-else class="cart-lines">
        <div v-for="line in cart.items" :key="line.productId + line.color" class="cart-line">
          <img :src="line.product.image" :alt="line.product.name" />
          <div><strong>{{ line.product.name }}</strong><span>{{ line.color }}</span><div class="quantity"><button @click="updateQuantity(line.productId, line.quantity - 1)">-</button><span>{{ line.quantity }}</span><button @click="updateQuantity(line.productId, line.quantity + 1)">+</button></div></div>
          <strong>{{ money(line.lineTotal) }}</strong>
        </div>
      </div>
      <div class="summary">
        <span>Subtotal <strong>{{ money(cart.summary.subtotal) }}</strong></span>
        <span>Shipping <strong>Free</strong></span>
        <span>Estimated tax <strong>{{ money(cart.summary.tax) }}</strong></span>
        <span class="total">Total <strong>{{ money(cart.summary.total) }}</strong></span>
      </div>
      <button class="button primary full" :disabled="!cart.items.length" @click="checkoutOpen = true">Checkout Securely</button>
    </aside>

    <div class="modal-backdrop" v-if="checkoutOpen" @click.self="closeCheckout">
      <form class="checkout-modal" @submit.prevent="submitCheckout">
        <button type="button" class="icon-button close" aria-label="Close checkout" @click="closeCheckout"><X :size="20" /></button>
        <h2>Delivery Details</h2>
        <label>Name<input v-model="checkout.name" required minlength="2" /></label>
        <label>Email<input v-model="checkout.email" required type="email" /></label>
        <label>Address<input v-model="checkout.address" required minlength="6" /></label>
        <div class="form-grid"><label>City<input v-model="checkout.city" required /></label><label>State<input v-model="checkout.state" required /></label><label>ZIP<input v-model="checkout.zip" required /></label></div>
        <div class="paypal-checkout">
          <div class="paypal-heading">
            <strong>PayPal Secure Checkout</strong>
            <span>{{ paypalConfig.enabled ? `Ready · ${paypalConfig.mode}` : 'Not configured' }}</span>
          </div>
          <p v-if="!deliveryConfirmed">Review delivery details, then continue to PayPal.</p>
          <p v-if="paymentError" class="payment-error">{{ paymentError }}</p>
          <div v-show="deliveryConfirmed" ref="paypalContainer" class="paypal-buttons"></div>
          <span v-if="paypalLoading" class="payment-note">Loading PayPal...</span>
        </div>
        <button class="button primary full" type="submit" :disabled="paypalLoading || paypalReady">{{ deliveryConfirmed ? 'PayPal Ready' : 'Continue to PayPal' }}</button>
      </form>
    </div>

    <div class="order-toast" v-if="order">
      <strong>Order {{ order.id }} confirmed</strong>
      <span>Estimated delivery: {{ order.eta }}</span>
      <button class="icon-button" aria-label="Dismiss order confirmation" @click="order = null"><X :size="16" /></button>
    </div>
  </div>
</template>
