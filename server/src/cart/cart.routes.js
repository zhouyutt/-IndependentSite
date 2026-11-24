import { Router } from 'express';
import { z } from 'zod';
import { addToCart, checkout, clearCart, getOrders, hydrateCart, hydrateWishlist, toggleWishlist, updateCartItem } from './cart.service.js';
import { ValidationError } from '../shared/errors.js';

export const cartRouter = Router();

const addCartSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
  color: z.string().optional()
});

const updateCartSchema = z.object({
  quantity: z.number().int().min(0).max(20)
});

const checkoutSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  address: z.string().min(6),
  city: z.string().min(2),
  state: z.string().min(2),
  zip: z.string().min(5)
});

function sessionId(req) {
  return req.get('x-session-id') || 'guest';
}

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

cartRouter.get('/cart', async (req, res, next) => {
  try {
    res.json(await hydrateCart(sessionId(req)));
  } catch (err) {
    next(err);
  }
});

cartRouter.post('/cart/items', async (req, res, next) => {
  try {
    res.status(201).json(await addToCart(sessionId(req), parse(addCartSchema, req.body)));
  } catch (err) {
    next(err);
  }
});

cartRouter.patch('/cart/items/:productId', async (req, res, next) => {
  try {
    res.json(await updateCartItem(sessionId(req), req.params.productId, parse(updateCartSchema, req.body)));
  } catch (err) {
    next(err);
  }
});

cartRouter.delete('/cart', async (req, res, next) => {
  try {
    res.json(await clearCart(sessionId(req)));
  } catch (err) {
    next(err);
  }
});

cartRouter.get('/wishlist', async (req, res, next) => {
  try {
    res.json(await hydrateWishlist(sessionId(req)));
  } catch (err) {
    next(err);
  }
});

cartRouter.post('/wishlist/:productId', async (req, res, next) => {
  try {
    res.json(await toggleWishlist(sessionId(req), req.params.productId));
  } catch (err) {
    next(err);
  }
});

cartRouter.post('/checkout', async (req, res, next) => {
  try {
    res.status(201).json({ order: await checkout(sessionId(req), parse(checkoutSchema, req.body)) });
  } catch (err) {
    next(err);
  }
});

cartRouter.get('/orders', (_req, res) => {
  res.json(getOrders());
});
