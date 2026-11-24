import { Router } from 'express';
import { z } from 'zod';
import { ValidationError } from '../shared/errors.js';
import {
  capturePayPalOrder,
  createPayPalOrder,
  getAdminPayPalAccount,
  getPublicPayPalConfig,
  removeAdminPayPalAccount,
  saveAdminPayPalAccount
} from './paypal.service.js';

export const paymentsRouter = Router();

const customerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  address: z.string().min(6),
  city: z.string().min(2),
  state: z.string().min(2),
  zip: z.string().min(5)
});

const paypalAccountSchema = z.object({
  mode: z.enum(['sandbox', 'live']),
  clientId: z.string().min(10),
  clientSecret: z.string().min(10),
  merchantId: z.string().optional(),
  merchantEmail: z.string().email().optional().or(z.literal(''))
});

const captureSchema = z.object({
  paypalOrderId: z.string().min(3)
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

paymentsRouter.get('/payments/paypal/config', (_req, res) => {
  res.json(getPublicPayPalConfig());
});

paymentsRouter.post('/payments/paypal/orders', async (req, res, next) => {
  try {
    res.status(201).json(await createPayPalOrder(sessionId(req), parse(customerSchema, req.body.customer)));
  } catch (err) {
    next(err);
  }
});

paymentsRouter.post('/payments/paypal/capture', async (req, res, next) => {
  try {
    const body = parse(captureSchema, req.body);
    res.json(await capturePayPalOrder(sessionId(req), body.paypalOrderId));
  } catch (err) {
    next(err);
  }
});

paymentsRouter.get('/admin/payments/paypal/account', (_req, res) => {
  res.json({ account: getAdminPayPalAccount() });
});

paymentsRouter.put('/admin/payments/paypal/account', (req, res, next) => {
  try {
    res.json({ account: saveAdminPayPalAccount(parse(paypalAccountSchema, req.body)) });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.delete('/admin/payments/paypal/account', (_req, res) => {
  res.json({ account: removeAdminPayPalAccount() });
});
