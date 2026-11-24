import { attachPayPalOrderId, capturePayPalPendingOrder, createPayPalPendingOrder } from '../cart/cart.service.js';
import { ValidationError } from '../shared/errors.js';
import { disconnectPayPalAccount, getPayPalAccount, updatePayPalAccount } from './paypal.store.js';

function redactAccount(account) {
  return {
    mode: account.mode,
    clientId: account.clientId,
    clientIdPreview: account.clientId ? `${account.clientId.slice(0, 8)}...${account.clientId.slice(-4)}` : '',
    merchantId: account.merchantId,
    merchantEmail: account.merchantEmail,
    status: account.status,
    updatedAt: account.updatedAt
  };
}

function paypalBaseUrl(account = getPayPalAccount()) {
  return account.mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function assertConfigured(account = getPayPalAccount()) {
  if (!account.clientId || !account.clientSecret) {
    throw new ValidationError([{ field: 'paypal', message: 'PayPal receiving account is not configured' }]);
  }
  return account;
}

function isMockSandbox(account) {
  return account.mode === 'sandbox' && account.clientSecret === 'mock_paypal_sandbox_secret';
}

async function getAccessToken(account) {
  if (isMockSandbox(account)) return 'mock-access-token';
  const credentials = Buffer.from(`${account.clientId}:${account.clientSecret}`).toString('base64');
  const response = await fetch(`${paypalBaseUrl(account)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ValidationError([{ field: 'paypal', message: body?.error_description || 'Unable to authenticate PayPal account' }]);
  }
  return body.access_token;
}

export function getPublicPayPalConfig() {
  const account = getPayPalAccount();
  return {
    enabled: account.status === 'connected' && Boolean(account.clientId),
    mode: account.mode,
    clientId: account.clientId
  };
}

export function getAdminPayPalAccount() {
  return redactAccount(getPayPalAccount());
}

export function saveAdminPayPalAccount(input) {
  return redactAccount(updatePayPalAccount(input));
}

export function removeAdminPayPalAccount() {
  return redactAccount(disconnectPayPalAccount());
}

export async function createPayPalOrder(sessionId, customer) {
  const account = assertConfigured();
  const pending = await createPayPalPendingOrder(sessionId, customer);
  if (isMockSandbox(account)) {
    const paypalOrderId = `MOCK-PAYPAL-${pending.id}`;
    attachPayPalOrderId(pending.id, paypalOrderId);
    return { localOrderId: pending.id, paypalOrderId };
  }
  const accessToken = await getAccessToken(account);
  const response = await fetch(`${paypalBaseUrl(account)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': pending.id
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: pending.id,
        invoice_id: pending.id,
        description: 'FREG LLC DASHINGNOAH equipment order',
        amount: {
          currency_code: 'USD',
          value: pending.summary.total.toFixed(2),
          breakdown: {
            item_total: { currency_code: 'USD', value: pending.summary.subtotal.toFixed(2) },
            shipping: { currency_code: 'USD', value: pending.summary.shipping.toFixed(2) },
            tax_total: { currency_code: 'USD', value: pending.summary.tax.toFixed(2) }
          }
        },
        items: pending.items.map((line) => ({
          name: line.product.name.slice(0, 127),
          sku: line.product.id,
          quantity: String(line.quantity),
          unit_amount: {
            currency_code: 'USD',
            value: line.product.price.toFixed(2)
          },
          tax: {
            currency_code: 'USD',
            value: '0.00'
          },
          category: 'PHYSICAL_GOODS'
        })),
        shipping: {
          name: { full_name: customer.name },
          address: {
            address_line_1: customer.address,
            admin_area_2: customer.city,
            admin_area_1: customer.state,
            postal_code: customer.zip,
            country_code: 'US'
          }
        }
      }],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: 'FREG LLC',
            shipping_preference: 'SET_PROVIDED_ADDRESS',
            user_action: 'PAY_NOW'
          }
        }
      }
    })
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ValidationError([{ field: 'paypal', message: body?.message || 'Unable to create PayPal order' }]);
  }
  attachPayPalOrderId(pending.id, body.id);
  return { localOrderId: pending.id, paypalOrderId: body.id };
}

export async function capturePayPalOrder(sessionId, paypalOrderId) {
  const account = assertConfigured();
  if (isMockSandbox(account)) {
    const order = await capturePayPalPendingOrder(sessionId, paypalOrderId, {
      paypalOrderId,
      paypalCaptureId: `MOCK-CAPTURE-${Date.now()}`,
      payerEmail: 'sandbox-buyer@example.com',
      payerName: 'Sandbox Buyer',
      captureStatus: 'COMPLETED',
      rawStatus: 'COMPLETED'
    });
    return { order, paypal: { id: paypalOrderId, status: 'COMPLETED', captureId: order.payment.paypalCaptureId } };
  }
  const accessToken = await getAccessToken(account);
  const response = await fetch(`${paypalBaseUrl(account)}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `capture-${paypalOrderId}`
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ValidationError([{ field: 'paypal', message: body?.message || 'Unable to capture PayPal order' }]);
  }
  const capture = body.purchase_units?.[0]?.payments?.captures?.[0];
  const order = await capturePayPalPendingOrder(sessionId, paypalOrderId, {
    paypalOrderId,
    paypalCaptureId: capture?.id || '',
    payerEmail: body.payer?.email_address || '',
    payerName: [body.payer?.name?.given_name, body.payer?.name?.surname].filter(Boolean).join(' '),
    captureStatus: capture?.status || body.status,
    rawStatus: body.status
  });
  return { order, paypal: { id: body.id, status: body.status, captureId: capture?.id || '' } };
}
