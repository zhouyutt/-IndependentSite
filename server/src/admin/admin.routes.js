import { Router } from 'express';
import { z } from 'zod';
import { ValidationError } from '../shared/errors.js';
import { createAdminProduct, deleteAdminProduct, getDashboard, listAdminProducts, updateAdminProduct } from './admin.service.js';
import { getOrders } from '../cart/cart.service.js';

export const adminRouter = Router();

const productSchema = z.object({
  id: z.string().min(3).regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  category: z.string().min(2),
  collection: z.string().optional(),
  price: z.number().min(1),
  compareAt: z.number().min(1).optional(),
  stock: z.number().int().min(0),
  summary: z.string().min(12),
  color: z.string().optional(),
  colors: z.array(z.string()).optional(),
  material: z.string().optional(),
  badge: z.string().optional(),
  image: z.string().optional(),
  gallery: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  status: z.enum(['active', 'draft', 'archived']).optional()
});

const updateProductSchema = productSchema.partial().omit({ id: true });

function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    })));
  }
  return result.data;
}

adminRouter.get('/admin/dashboard', async (_req, res, next) => {
  try {
    res.json(await getDashboard());
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/admin/products', async (_req, res, next) => {
  try {
    res.json(await listAdminProducts());
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/admin/products', async (req, res, next) => {
  try {
    res.status(201).json({ product: await createAdminProduct(parse(productSchema, req.body)) });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/admin/products/:id', async (req, res, next) => {
  try {
    res.json({ product: await updateAdminProduct(req.params.id, parse(updateProductSchema, req.body)) });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/admin/products/:id', async (req, res, next) => {
  try {
    res.json({ product: await deleteAdminProduct(req.params.id) });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/admin/orders', (_req, res) => {
  res.json(getOrders());
});
