const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
export const catalogOnly = import.meta.env.VITE_CATALOG_ONLY === 'true';
const SESSION_KEY = 'dashingnoah_session';

function getSessionId() {
  let session = localStorage.getItem(SESSION_KEY);
  if (!session) {
    session = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, session);
  }
  return session;
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.detail || `API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: catalogOnly ? options.headers : {
      'Content-Type': 'application/json',
      'x-session-id': getSessionId(),
      ...options.headers
    }
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

export const storeApi = {
  products: (params = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) search.set(key, value);
    });
    return api(`/api/products?${search.toString()}`);
  },
  featured: () => api('/api/products/featured'),
  product: (id) => api(`/api/products/${id}`),
  cart: () => api('/api/cart'),
  addToCart: (item) => api('/api/cart/items', { method: 'POST', body: JSON.stringify(item) }),
  updateCart: (productId, quantity) => api(`/api/cart/items/${productId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
  clearCart: () => api('/api/cart', { method: 'DELETE' }),
  wishlist: () => api('/api/wishlist'),
  toggleWishlist: (productId) => api(`/api/wishlist/${productId}`, { method: 'POST' }),
  checkout: (customer) => api('/api/checkout', { method: 'POST', body: JSON.stringify(customer) }),
  paypalConfig: () => api('/api/payments/paypal/config'),
  createPayPalOrder: (customer) => api('/api/payments/paypal/orders', { method: 'POST', body: JSON.stringify({ customer }) }),
  capturePayPalOrder: (paypalOrderId) => api('/api/payments/paypal/capture', { method: 'POST', body: JSON.stringify({ paypalOrderId }) })
};
