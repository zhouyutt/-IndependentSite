export function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: value % 1 ? 2 : 0
  }).format(value || 0);
}

export function hasPrice(product) {
  return Number.isFinite(product.price) && product.price > 0;
}

export function amazonProductUrl(product) {
  return /^https:\/\/(www\.)?amazon\.com\//i.test(product.amazonStoreUrl || '')
    ? product.amazonStoreUrl
    : 'https://www.amazon.com/stores/AlaterreFurniture/page/82789116-98E2-4456-94B8-8EE675121760';
}

export function swatchStyle(color) {
  const finishes = {
    charcoal: '#36454f', 'slate gray': '#737b80', 'rustic brown': '#846044',
    natural: '#bca17b', espresso: '#45382f', ivory: '#f1efe3'
  };
  const name = color.trim().toLowerCase();
  const value = finishes[name] || name;
  return CSS.supports('color', value) ? { backgroundColor: value } : { display: 'none' };
}
