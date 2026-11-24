import { getCatalog, createProduct, updateProduct, deleteProduct } from '../catalog/catalog.service.js';
import { listOrders } from '../cart/cart.store.js';

export async function getDashboard() {
  const [{ products }, orders] = await Promise.all([
    getCatalog({ includeInactive: 'true' }),
    Promise.resolve(listOrders())
  ]);
  const revenue = orders.reduce((sum, order) => sum + order.summary.total, 0);
  const units = orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  const lowStock = products.filter((product) => product.stock <= 10);
  const activeProducts = products.filter((product) => product.status !== 'draft' && product.status !== 'archived').length;

  return {
    metrics: {
      revenue,
      orderCount: orders.length,
      units,
      activeProducts,
      lowStockCount: lowStock.length,
      averageOrderValue: orders.length ? Math.round((revenue / orders.length) * 100) / 100 : 0
    },
    lowStock,
    recentOrders: orders.slice(0, 8)
  };
}

export async function listAdminProducts() {
  return getCatalog({ includeInactive: 'true', sort: 'popular' });
}

export async function createAdminProduct(input) {
  return createProduct(input);
}

export async function updateAdminProduct(id, input) {
  return updateProduct(id, input);
}

export async function deleteAdminProduct(id) {
  return deleteProduct(id);
}
