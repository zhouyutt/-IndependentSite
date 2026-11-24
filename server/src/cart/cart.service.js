import { nanoid } from 'nanoid';
import { ValidationError } from '../shared/errors.js';
import { getProductById } from '../catalog/catalog.service.js';
import {
  addOrder,
  addPendingOrder,
  findPendingOrderByPayPalOrderId,
  getCart,
  getWishlist,
  listOrders,
  removePendingOrder,
  setCart,
  setWishlist,
  updatePendingOrder
} from './cart.store.js';

export async function hydrateCart(sessionId) {
  const lines = await Promise.all(getCart(sessionId).map(async (line) => {
    const product = await getProductById(line.productId);
    return { ...line, product, lineTotal: product.price * line.quantity };
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping = subtotal > 0 ? 0 : 0;
  const tax = Math.round(subtotal * 0.0825 * 100) / 100;
  return {
    items: lines,
    summary: {
      subtotal,
      shipping,
      tax,
      total: Math.round((subtotal + shipping + tax) * 100) / 100
    }
  };
}

export async function addToCart(sessionId, input) {
  const product = await getProductById(input.productId);
  if (input.quantity > product.stock) {
    throw new ValidationError([{ field: 'quantity', message: 'Quantity exceeds available stock' }]);
  }
  const cart = getCart(sessionId);
  const existing = cart.find((line) => line.productId === input.productId && line.color === input.color);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + input.quantity, product.stock);
  } else {
    cart.push({ productId: input.productId, quantity: input.quantity, color: input.color || product.color });
  }
  setCart(sessionId, cart);
  return hydrateCart(sessionId);
}

export async function updateCartItem(sessionId, productId, input) {
  const cart = getCart(sessionId);
  if (input.quantity <= 0) {
    setCart(sessionId, cart.filter((line) => line.productId !== productId));
  } else {
    const product = await getProductById(productId);
    setCart(sessionId, cart.map((line) => line.productId === productId
      ? { ...line, quantity: Math.min(input.quantity, product.stock) }
      : line));
  }
  return hydrateCart(sessionId);
}

export async function clearCart(sessionId) {
  setCart(sessionId, []);
  return hydrateCart(sessionId);
}

export async function toggleWishlist(sessionId, productId) {
  await getProductById(productId);
  const wishlist = getWishlist(sessionId);
  const next = wishlist.includes(productId)
    ? wishlist.filter((id) => id !== productId)
    : [...wishlist, productId];
  setWishlist(sessionId, next);
  return hydrateWishlist(sessionId);
}

export async function hydrateWishlist(sessionId) {
  const products = await Promise.all(getWishlist(sessionId).map((id) => getProductById(id)));
  return { products };
}

export async function checkout(sessionId, customer) {
  const cart = await hydrateCart(sessionId);
  if (!cart.items.length) {
    throw new ValidationError([{ field: 'cart', message: 'Cart is empty' }]);
  }
  const order = addOrder({
    id: `DN-${nanoid(8).toUpperCase()}`,
    status: 'confirmed',
    customer,
    items: cart.items,
    summary: cart.summary,
    createdAt: new Date().toISOString(),
    eta: '5-8 business days'
  });
  await clearCart(sessionId);
  return order;
}

export async function createPayPalPendingOrder(sessionId, customer) {
  const cart = await hydrateCart(sessionId);
  if (!cart.items.length) {
    throw new ValidationError([{ field: 'cart', message: 'Cart is empty' }]);
  }
  return addPendingOrder({
    id: `DN-${nanoid(8).toUpperCase()}`,
    status: 'payment_pending',
    paymentMethod: 'paypal',
    customer,
    items: cart.items,
    summary: cart.summary,
    createdAt: new Date().toISOString(),
    eta: '5-8 business days',
    sessionId,
    payment: {
      provider: 'paypal',
      status: 'created'
    }
  });
}

export async function capturePayPalPendingOrder(sessionId, paypalOrderId, payment) {
  const pending = findPendingOrderByPayPalOrderId(paypalOrderId);
  if (!pending || pending.sessionId !== sessionId) {
    throw new ValidationError([{ field: 'paypalOrderId', message: 'PayPal order does not match the current cart session' }]);
  }
  const paidOrder = {
    ...pending,
    status: 'paid',
    paidAt: new Date().toISOString(),
    payment: {
      ...pending.payment,
      ...payment,
      status: 'captured'
    }
  };
  removePendingOrder(pending.id);
  addOrder(paidOrder);
  await clearCart(sessionId);
  return paidOrder;
}

export function attachPayPalOrderId(localOrderId, paypalOrderId) {
  return updatePendingOrder(localOrderId, {
    payment: {
      paypalOrderId,
      status: 'approved_pending_capture'
    }
  });
}

export function getOrders() {
  return { orders: listOrders() };
}
