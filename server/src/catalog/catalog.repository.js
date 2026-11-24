import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '../../data/products.json');

export async function loadProducts() {
  const raw = await readFile(dataPath, 'utf8');
  return JSON.parse(raw);
}

export async function saveProducts(products) {
  await writeFile(dataPath, `${JSON.stringify(products, null, 2)}\n`);
  return products;
}
