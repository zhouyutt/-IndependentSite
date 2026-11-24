export const config = {
  port: Number.parseInt(process.env.PORT || '3001', 10),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  adminOrigin: process.env.ADMIN_ORIGIN || 'http://localhost:5174',
  paypal: {
    mode: process.env.PAYPAL_MODE || 'sandbox',
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    merchantId: process.env.PAYPAL_MERCHANT_ID || '',
    merchantEmail: process.env.PAYPAL_MERCHANT_EMAIL || ''
  }
};
