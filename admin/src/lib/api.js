const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body;
}

export const adminApi = {
  dashboard: () => api('/api/admin/dashboard'),
  products: () => api('/api/admin/products'),
  orders: () => api('/api/admin/orders'),
  paypalAccount: () => api('/api/admin/payments/paypal/account'),
  savePayPalAccount: (account) => api('/api/admin/payments/paypal/account', { method: 'PUT', body: JSON.stringify(account) }),
  disconnectPayPalAccount: () => api('/api/admin/payments/paypal/account', { method: 'DELETE' }),
  createProduct: (product) => api('/api/admin/products', { method: 'POST', body: JSON.stringify(product) }),
  updateProduct: (productId, product) => api(`/api/admin/products/${productId}`, { method: 'PATCH', body: JSON.stringify(product) }),
  deleteProduct: (productId) => api(`/api/admin/products/${productId}`, { method: 'DELETE' })
};
