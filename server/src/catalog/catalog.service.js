import { NotFoundError } from '../shared/errors.js';
import { loadProducts, saveProducts } from './catalog.repository.js';

function includesText(value, query) {
  return value.toLowerCase().includes(query.toLowerCase());
}

export async function getCatalog(filters = {}) {
  let products = await loadProducts();
  if (filters.includeInactive !== 'true') {
    products = products.filter((product) => product.status !== 'draft' && product.status !== 'archived');
  }
  const q = filters.q?.trim();

  if (q) {
    products = products.filter((product) =>
      includesText(product.name, q) ||
      includesText(product.category, q) ||
      includesText(product.collection, q) ||
      includesText(product.summary, q)
    );
  }

  if (filters.category) {
    products = products.filter((product) => product.category === filters.category);
  }

  if (filters.collection) {
    products = products.filter((product) => product.collection === filters.collection);
  }

  if (filters.color) {
    products = products.filter((product) => product.colors.includes(filters.color));
  }

  if (filters.minPrice) {
    products = products.filter((product) => product.price >= Number(filters.minPrice));
  }

  if (filters.maxPrice) {
    products = products.filter((product) => product.price <= Number(filters.maxPrice));
  }

  switch (filters.sort) {
    case 'price-asc':
      products.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      products.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      products.sort((a, b) => b.rating - a.rating);
      break;
    default:
      products.sort((a, b) => b.reviewCount - a.reviewCount);
  }

  const allProducts = (await loadProducts()).filter((product) => product.status !== 'archived');
  return {
    products,
    facets: {
      categories: [...new Set(allProducts.map((item) => item.category))],
      collections: [...new Set(allProducts.map((item) => item.collection))],
      colors: [...new Set(allProducts.flatMap((item) => item.colors))],
      priceRange: {
        min: Math.min(...allProducts.map((item) => item.price)),
        max: Math.max(...allProducts.map((item) => item.price))
      }
    }
  };
}

export async function getFeaturedProducts() {
  const products = (await loadProducts()).filter((product) => product.status !== 'draft' && product.status !== 'archived');
  return products.filter((product) => ['Best Seller', 'Bundle', 'New', 'Poolside'].includes(product.badge));
}

export async function getProductById(id) {
  const products = await loadProducts();
  const product = products.find((item) => item.id === id);
  if (!product) throw new NotFoundError('Product', id);
  return product;
}

export async function createProduct(input) {
  const products = await loadProducts();
  const product = {
    id: input.id,
    name: input.name,
    category: input.category,
    collection: input.collection || 'DASHINGNOAH Sports Equipment',
    price: input.price,
    compareAt: input.compareAt || Math.round(input.price * 1.18),
    rating: input.rating || 4.6,
    reviewCount: input.reviewCount || 0,
    color: input.color || 'Black',
    colors: input.colors?.length ? input.colors : ['Black'],
    material: input.material || 'Steel frame and durable polymer components',
    badge: input.badge || 'New',
    image: input.image || '/assets/product-basketball-hoop-853.jpg',
    gallery: input.gallery?.length ? input.gallery : [input.image || '/assets/product-basketball-hoop-853.jpg'],
    summary: input.summary,
    features: input.features?.length ? input.features : ['Amazon listing source', 'Retail catalog ready', 'Inventory tracked in FREG Operations'],
    specs: input.specs || { type: 'Sports equipment', source: 'Amazon listing URL' },
    stock: input.stock,
    status: input.status || 'active',
    company: input.company || 'FREG LLC',
    source: input.source || 'Amazon product link supplied by user',
    businessType: input.businessType || 'E-COMMERCE, RETAIL, WHOLESALE',
    companyPrincipalOffice: input.companyPrincipalOffice || '26682 ALMOND AVENUE UNIT B, REDLANDS, CA 92374',
    amazonStoreUrl: input.amazonStoreUrl || null,
    sourceAsin: input.sourceAsin || null,
    createdAt: new Date().toISOString()
  };
  products.unshift(product);
  await saveProducts(products);
  return product;
}

export async function updateProduct(id, input) {
  const products = await loadProducts();
  const index = products.findIndex((product) => product.id === id);
  if (index === -1) throw new NotFoundError('Product', id);
  products[index] = {
    ...products[index],
    ...input,
    updatedAt: new Date().toISOString()
  };
  await saveProducts(products);
  return products[index];
}

export async function deleteProduct(id) {
  const products = await loadProducts();
  const index = products.findIndex((product) => product.id === id);
  if (index === -1) throw new NotFoundError('Product', id);
  const [removed] = products.splice(index, 1);
  await saveProducts(products);
  return removed;
}
