import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { requestId } from './shared/request-id.js';
import { errorHandler, notFound } from './shared/error-handler.js';
import { catalogRouter } from './catalog/catalog.routes.js';
import { cartRouter } from './cart/cart.routes.js';
import { adminRouter } from './admin/admin.routes.js';
import { paymentsRouter } from './payments/payments.routes.js';

export function createApp({ catalogOnly = process.env.CATALOG_ONLY === 'true' } = {}) {
  const app = express();

  app.use(requestId);
  app.use(helmet({ crossOriginResourcePolicy: false }));
  const allowedOrigins = [config.clientOrigin, config.adminOrigin];
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  }));
  app.use(express.json());
  app.use(morgan('combined'));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', (_req, res) => res.json({ status: 'ok', checks: { catalog: 'ok' } }));
  app.use('/api', catalogRouter);
  if (!catalogOnly) {
    app.use('/api', cartRouter);
    app.use('/api', paymentsRouter);
    app.use('/api', adminRouter);
  }
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
