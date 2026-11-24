const carts = new Map();
const wishlists = new Map();
const pendingOrders = new Map();
const orders = [];

export function getCart(sessionId) {
  if (!carts.has(sessionId)) carts.set(sessionId, []);
  return carts.get(sessionId);
}

export function setCart(sessionId, items) {
  carts.set(sessionId, items);
  return items;
}

export function getWishlist(sessionId) {
  if (!wishlists.has(sessionId)) wishlists.set(sessionId, []);
  return wishlists.get(sessionId);
}

export function setWishlist(sessionId, items) {
  wishlists.set(sessionId, items);
  return items;
}

export function addOrder(order) {
  orders.unshift(order);
  return order;
}

export function listOrders() {
  return orders;
}

export function addPendingOrder(order) {
  pendingOrders.set(order.id, order);
  return order;
}

export function findPendingOrderByPayPalOrderId(paypalOrderId) {
  return [...pendingOrders.values()].find((order) => order.payment?.paypalOrderId === paypalOrderId);
}

export function updatePendingOrder(orderId, patch) {
  const existing = pendingOrders.get(orderId);
  if (!existing) return null;
  const next = { ...existing, ...patch, payment: { ...existing.payment, ...patch.payment } };
  pendingOrders.set(orderId, next);
  return next;
}

export function removePendingOrder(orderId) {
  const order = pendingOrders.get(orderId);
  pendingOrders.delete(orderId);
  return order;
}
