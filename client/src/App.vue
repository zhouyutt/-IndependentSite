<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { ArrowRight, ArrowUpRight, Layers, Menu, Ruler, Search, ShoppingBag, SlidersHorizontal, Star, Truck, X } from 'lucide-vue-next';
import { catalogOnly, storeApi } from './lib/api.js';
import { amazonProductUrl, hasPrice, money } from './lib/products.js';
import ProductCard from './components/ProductCard.vue';
import SiteFooter from './SiteFooter.vue';

const amazonStoreUrl = 'https://www.amazon.com/stores/AlaterreFurniture/page/82789116-98E2-4456-94B8-8EE675121760';

const loading = ref(true);
const error = ref('');
const products = ref([]);
const catalogProducts = ref([]);
const department = ref('all');
const activeImage = ref('');
const productResults = ref(null);
let latestProductRequest = 0;
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

const filters = reactive({ q: '', category: '', collection: '', color: '', maxPrice: '', sort: 'featured' });
const checkout = reactive({ name: '', email: '', address: '', city: '', state: '', zip: '' });

const wishlistIds = computed(() => new Set(wishlist.value.products.map((item) => item.id)));
const cartCount = computed(() => cart.value.items.reduce((sum, item) => sum + item.quantity, 0));
const furnitureProducts = computed(() => catalogProducts.value.filter((item) => item.brand === 'Alaterre Furniture'));
const featuredIds = ['alaterre-pomona-coffee-table', 'alaterre-alpine-bench', 'alaterre-shaker-storage-bench', 'alaterre-shaker-bookcase'];
const featuredFurniture = computed(() => featuredIds.map((id) => furnitureProducts.value.find((item) => item.id === id)).filter(Boolean));
const visibleProducts = computed(() => products.value.filter((item) => {
  if (department.value === 'all') return true;
  if (department.value === 'furniture') return item.brand === 'Alaterre Furniture';
  if (department.value === 'sports') return item.brand === 'DASHINGNOAH';
  return item.rooms?.includes(department.value);
}));
const departments = [
  { value: 'all', label: 'All Products' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'sports', label: 'Sports & Fitness' }
];
const rooms = [
  { name: 'Living Room', image: '/assets/alaterre-pomona-coffee-room.jpg', caption: 'Tables to gather around' },
  { name: 'Entryway', image: '/assets/alaterre-pomona-console.jpg', caption: 'A welcoming first impression' },
  { name: 'Home Office', image: '/assets/alaterre-shaker-bookcase.jpg', caption: 'Make room for your ideas' },
  { name: 'Dining Room', image: '/assets/alaterre-pomona-stool.jpg', caption: 'Pull up a seat' }
];

watch(selectedProduct, (product) => { activeImage.value = product?.image || ''; });

async function browse(value = 'all') {
  department.value = value;
  navOpen.value = false;
  Object.assign(filters, { q: '', category: '', collection: '', color: '', maxPrice: '', sort: 'featured' });
  await loadProducts();
  await nextTick();
  document.getElementById('shop').scrollIntoView({ block: 'start' });
}

function resetFilters() {
  department.value = 'all';
  Object.assign(filters, { q: '', category: '', collection: '', color: '', maxPrice: '', sort: 'featured' });
  loadProducts();
}

async function loadProducts() {
  const request = ++latestProductRequest;
  loading.value = true;
  error.value = '';
  try {
    const data = await storeApi.products(filters);
    if (request !== latestProductRequest) return;
    products.value = data.products;
    if (!filters.q && !filters.category && !filters.collection && !filters.color && !filters.maxPrice) {
      catalogProducts.value = data.products;
    }
    facets.value = data.facets;
  } catch (err) {
    if (request === latestProductRequest) error.value = err.message || 'Unable to load products.';
  } finally {
    if (request === latestProductRequest) loading.value = false;
  }
}

function searchProducts() {
  loadProducts();
  if (window.matchMedia('(max-width: 1120px)').matches) {
    productResults.value.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
}

function showSearchResults() {
  productResults.value.focus({ preventScroll: true });
  productResults.value.scrollIntoView({ block: 'start' });
}

async function boot() {
  if (catalogOnly) return loadProducts();
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
      <a :href="amazonStoreUrl">Amazon Store</a>
      <span>Introducing Alaterre Furniture. A little more home, every day.</span>
      <a href="#service">Customer Service</a>
    </div>

    <header class="site-header">
      <button class="icon-button mobile-only" aria-label="Open navigation" @click="navOpen = true"><Menu :size="21" /></button>
      <a class="brand" href="#home" aria-label="DASHINGNOAH home"><span>DASHINGNOAH</span><small>HOME & LIVING</small></a>
      <nav class="desktop-nav" aria-label="Primary navigation">
        <a href="#shop" @click.prevent="browse('furniture')">Furniture</a>
        <a href="#shop" @click.prevent="browse('Living Room')">Living Room</a>
        <a href="#shop" @click.prevent="browse('Entryway')">Entryway</a>
        <a href="#shop" @click.prevent="browse('Home Office')">Home Office</a>
        <a href="#shop" @click.prevent="browse('sports')">Sports & Fitness</a>
      </nav>
      <div class="header-actions">
        <form class="search-field" role="search" @submit.prevent="showSearchResults">
          <input v-model="filters.q" type="search" placeholder="Search" aria-label="Search products" aria-controls="product-results" enterkeyhint="search" @input="searchProducts" />
          <button type="submit" aria-label="Show search results"><Search :size="17" /></button>
        </form>
        <button v-if="!catalogOnly" class="icon-button" aria-label="Open cart" @click="cartOpen = true">
          <ShoppingBag :size="20" />
          <span v-if="cartCount" class="count">{{ cartCount }}</span>
        </button>
      </div>
    </header>

    <aside class="mobile-menu" :class="{ open: navOpen }" :inert="!navOpen">
      <button class="icon-button close" aria-label="Close navigation" @click="navOpen = false"><X :size="20" /></button>
      <a href="#shop" @click="navOpen = false">Shop All</a>
      <a href="#shop" @click.prevent="browse('furniture')">Furniture</a>
      <a v-for="room in rooms" :key="room.name" href="#shop" @click.prevent="browse(room.name)">{{ room.name }}</a>
      <a href="#shop" @click.prevent="browse('sports')">Sports & Fitness</a>
      <a :href="amazonStoreUrl" @click="navOpen = false">Amazon Store</a>
    </aside>

    <main id="home">
      <section class="hero home-hero">
        <img class="hero-bg" src="/assets/alaterre-pomona-coffee-room.jpg" alt="Alaterre Pomona wood coffee table with a storage shelf in a light-filled living room" fetchpriority="high" />
        <div class="hero-copy">
          <p class="eyebrow">New collection / Alaterre Furniture</p>
          <h1>Furniture for<br />Everyday Living.</h1>
          <p class="hero-description">Natural textures. Thoughtful storage.<br />Pieces that make a house feel like home.</p>
          <a class="button primary" href="#shop" @click.prevent="browse('furniture')">Explore Furniture <ArrowRight :size="17" /></a>
          <a class="hero-secondary" href="#shop" @click.prevent="browse('sports')">Shop Sports & Fitness <ArrowRight :size="16" /></a>
        </div>
        <button class="hero-product" :disabled="!furnitureProducts.length" @click="selectedProduct = furnitureProducts.find((item) => item.id === 'alaterre-pomona-coffee-table')"><span>IN THE ROOM<strong>Pomona Coffee Table</strong></span><ArrowUpRight :size="22" /></button>
      </section>

      <div class="collection-note"><span><Layers :size="18" /> Alaterre Furniture</span><span>Pomona · Alpine · Shaker Cottage · Coventry</span><a href="#new-arrivals">Discover the collection <ArrowRight :size="16" /></a></div>

      <section class="section" id="collections">
        <div class="section-heading">
          <div><p class="eyebrow">Find your space</p><h2>Shop by Room</h2></div>
          <a class="text-link" href="#shop" @click.prevent="browse('furniture')">View all furniture <ArrowRight :size="17" /></a>
        </div>
        <div class="collection-grid">
          <button v-for="room in rooms" :key="room.name" class="collection-tile" @click="browse(room.name)">
            <div class="room-image"><img :src="room.image" :alt="`${room.name} furniture by Alaterre`" loading="lazy" width="600" height="450" /></div>
            <span>{{ room.name }} <ArrowUpRight :size="19" /></span>
            <small>{{ room.caption }}</small>
          </button>
        </div>
      </section>

      <section class="section new-arrivals" id="new-arrivals">
        <div class="section-heading"><div><p class="eyebrow">Introducing Alaterre</p><h2>A Few New Favorites</h2></div><a class="text-link" href="#shop" @click.prevent="browse('furniture')">Shop all {{ furnitureProducts.length }} pieces <ArrowRight :size="17" /></a></div>
        <div v-if="featuredFurniture.length" class="featured-grid">
          <ProductCard v-for="product in featuredFurniture" :key="product.id" :product="product" :saved="wishlistIds.has(product.id)" :catalog-only="catalogOnly" @view="selectedProduct = $event" @save="toggleWish" @add="add" />
        </div>
        <div v-else-if="loading" class="featured-grid"><div v-for="i in 4" :key="i" class="skeleton-card"></div></div>
        <div v-else class="state-panel">{{ error || 'The collection is currently unavailable.' }} <button class="button" @click="loadProducts">Try Again</button></div>
      </section>

      <section class="promo-split home-edits">
        <article><img src="/assets/alaterre-shaker-storage.jpg" alt="Alaterre Shaker Cottage ivory storage bench with cabinet doors" loading="lazy" /><div><p class="eyebrow">The entryway edit</p><h2>A Warm Welcome.</h2><p>Benches, consoles, and clever storage for the place where every day begins.</p><a class="text-link" href="#shop" @click.prevent="browse('Entryway')">Explore entryway <ArrowRight :size="17" /></a></div></article>
        <article><img src="/assets/promo-treadmill.jpg" alt="DASHINGNOAH portable treadmill with incline" loading="lazy" /><div><p class="eyebrow">Still part of the family</p><h2>Room to Move.</h2><p>Our original DASHINGNOAH sports and fitness collection, made for your at-home routine.</p><a class="text-link" href="#shop" @click.prevent="browse('sports')">Shop Sports & Fitness <ArrowRight :size="17" /></a></div></article>
      </section>

      <section class="shop-section" id="shop">
        <div class="shop-heading">
          <div><p class="eyebrow">Furniture, fitness & everyday essentials</p><h2>Explore the Collection</h2></div>
          <button class="text-link" @click="resetFilters">Clear filters <X :size="16" /></button>
        </div>

        <div class="catalog-toolbar"><div class="department-tabs" role="group" aria-label="Product department"><button v-for="item in departments" :key="item.value" :class="{ active: department === item.value }" :aria-pressed="department === item.value" @click="browse(item.value)">{{ item.label }}</button><button v-if="rooms.some((room) => room.name === department)" class="active" aria-pressed="true" @click="browse(department)">{{ department }}</button></div><span aria-live="polite">{{ loading ? 'Loading...' : `${visibleProducts.length} products` }}</span></div>

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
            <label>Max listed price
              <input v-model="filters.maxPrice" type="range" :min="facets.priceRange.min" :max="facets.priceRange.max" @input="loadProducts" />
              <span>{{ filters.maxPrice ? money(filters.maxPrice) : 'No limit' }}</span>
            </label>
            <label>Sort
              <select v-model="filters.sort" @change="loadProducts">
                <option value="featured">Featured</option>
                <option value="popular">Most reviewed</option>
                <option value="rating">Top rated</option>
                <option value="price-asc">Price low to high</option>
                <option value="price-desc">Price high to low</option>
              </select>
            </label>
          </aside>

          <div id="product-results" ref="productResults" class="product-area" role="region" aria-label="Product results" tabindex="-1">
            <div v-if="loading" class="product-grid"><div v-for="i in 6" :key="i" class="skeleton-card"></div></div>
            <div v-else-if="error" class="state-panel">{{ error }} <button class="button" @click="loadProducts">Try Again</button></div>
            <div v-else-if="!visibleProducts.length" class="state-panel">No products match those filters. <button class="button" @click="resetFilters">Clear filters</button></div>
            <div v-else class="product-grid">
              <ProductCard v-for="product in visibleProducts" :key="product.id" :product="product" :saved="wishlistIds.has(product.id)" :catalog-only="catalogOnly" @view="selectedProduct = $event" @save="toggleWish" @add="add" />
            </div>
          </div>
        </div>
      </section>

      <section class="difference-strip" id="materials"><div><article><Ruler :size="25" /><strong>A Place for Every Piece</strong><span>Explore dimensions and materials to find the right fit for your room.</span></article><article><Layers :size="25" /><strong>Collections That Belong Together</strong><span>Mix matching wood finishes, clean lines, and practical storage.</span></article><article><Truck :size="25" /><strong>Delivery That Fits Your Plans</strong><span>Check the Amazon listing for current pricing, availability, and delivery options.</span></article></div></section>
    </main>

    <SiteFooter />

    <aside class="drawer" :class="{ open: !!selectedProduct }" :inert="!selectedProduct" aria-live="polite">
      <button class="icon-button close" aria-label="Close product details" @click="selectedProduct = null"><X :size="20" /></button>
      <template v-if="selectedProduct">
        <img class="drawer-product-image" :src="activeImage" :alt="selectedProduct.name" />
        <div v-if="selectedProduct.gallery?.length > 1" class="gallery-thumbnails" role="group" aria-label="Product photos"><button v-for="(src, index) in selectedProduct.gallery" :key="src" :aria-label="`Product photo ${index + 1}`" :aria-pressed="activeImage === src" @click="activeImage = src"><img :src="src" :alt="`${selectedProduct.name}, view ${index + 1}`" /></button></div>
        <span class="product-brand">{{ selectedProduct.brand }}</span>
        <span class="badge">{{ selectedProduct.badge }}</span>
        <h2>{{ selectedProduct.name }}</h2>
        <div v-if="selectedProduct.rating && selectedProduct.reviewCount" class="rating"><Star :size="15" fill="currentColor" /> {{ selectedProduct.rating }} <span>({{ selectedProduct.reviewCount }} reviews)</span></div>
        <p>{{ selectedProduct.summary }}</p>
        <div v-if="hasPrice(selectedProduct)" class="price-row large"><strong>{{ money(selectedProduct.price) }}</strong><del v-if="selectedProduct.compareAt > selectedProduct.price">{{ money(selectedProduct.compareAt) }}</del></div>
        <p v-else class="price-note">See current price and availability on Amazon.</p>
        <div class="detail-block"><strong>Colors</strong><div class="pill-row"><span v-for="color in selectedProduct.colors" :key="color">{{ color }}</span></div></div>
        <div class="detail-block"><strong>Features</strong><ul><li v-for="feature in selectedProduct.features" :key="feature">{{ feature }}</li></ul></div>
        <div class="spec-grid"><div v-for="(value, key) in selectedProduct.specs" :key="key"><span>{{ key }}</span><strong>{{ value }}</strong></div></div>
        <a v-if="catalogOnly || selectedProduct.externalOnly" class="button primary full" :href="amazonProductUrl(selectedProduct)" target="_blank" rel="noopener noreferrer">{{ selectedProduct.amazonLinkType === 'search' ? 'Find on Amazon' : 'View on Amazon' }} <ArrowUpRight :size="16" /></a>
        <button v-else class="button primary full" @click="add(selectedProduct)">Add to Cart</button>
      </template>
    </aside>

    <aside v-if="!catalogOnly" class="drawer cart-drawer" :class="{ open: cartOpen }" aria-live="polite">
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
        <p class="checkout-policies">
          Review our <a href="/privacy/" target="_blank" rel="noopener" aria-label="Privacy Policy (opens in a new tab)">Privacy Policy</a>
          and <a href="/terms/" target="_blank" rel="noopener" aria-label="Terms of Service (opens in a new tab)">Terms of Service</a> before paying.
        </p>
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
