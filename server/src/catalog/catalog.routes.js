import { Router } from 'express';
import { getCatalog, getFeaturedProducts, getProductById } from './catalog.service.js';

export const catalogRouter = Router();

catalogRouter.get('/products', async (req, res, next) => {
  try {
    res.json(await getCatalog(req.query));
  } catch (err) {
    next(err);
  }
});

catalogRouter.get('/products/featured', async (_req, res, next) => {
  try {
    res.json({ products: await getFeaturedProducts() });
  } catch (err) {
    next(err);
  }
});

catalogRouter.get('/products/:id', async (req, res, next) => {
  try {
    res.json({ product: await getProductById(req.params.id, { publishedOnly: true }) });
  } catch (err) {
    next(err);
  }
});
