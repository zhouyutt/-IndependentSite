import { config } from '../config.js';

const paypalAccount = {
  mode: config.paypal.mode,
  clientId: config.paypal.clientId,
  clientSecret: config.paypal.clientSecret,
  merchantId: config.paypal.merchantId,
  merchantEmail: config.paypal.merchantEmail,
  status: config.paypal.clientId && config.paypal.clientSecret ? 'connected' : 'not_configured',
  updatedAt: config.paypal.clientId && config.paypal.clientSecret ? new Date().toISOString() : ''
};

export function getPayPalAccount() {
  return { ...paypalAccount };
}

export function updatePayPalAccount(input) {
  Object.assign(paypalAccount, {
    mode: input.mode,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    merchantId: input.merchantId || '',
    merchantEmail: input.merchantEmail || '',
    status: 'connected',
    updatedAt: new Date().toISOString()
  });
  return getPayPalAccount();
}

export function disconnectPayPalAccount() {
  Object.assign(paypalAccount, {
    clientId: '',
    clientSecret: '',
    merchantId: '',
    merchantEmail: '',
    status: 'not_configured',
    updatedAt: new Date().toISOString()
  });
  return getPayPalAccount();
}
