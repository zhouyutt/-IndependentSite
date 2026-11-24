# FREG LLC Sports Commerce

Vue + Node ecommerce project inspired by the Polywood-style shopping experience, designed around FREG LLC's Statement of Information profile: California-based e-commerce, retail, and wholesale.

The product catalog is tied to the DASHINGNOAH Amazon product links provided by the user.

The admin system is a separate Vue application, not embedded in the storefront.

Company information used from the Statement of Information:

- Company: FREG LLC
- Formed in: California
- Principal office: 26682 Almond Avenue Unit B, Redlands, CA 92374
- Business type: E-commerce, retail, wholesale

## Run locally

```bash
npm install
npm run dev
```

Storefront: http://localhost:5173  
Admin system: http://localhost:5174  
Backend API: http://localhost:3001

## PayPal setup

The storefront now uses PayPal Checkout. Bind the receiving account in the separate admin system under `收款账户`, or set these backend environment variables before starting the server:

```bash
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your-paypal-rest-app-client-id
PAYPAL_CLIENT_SECRET=your-paypal-rest-app-client-secret
PAYPAL_MERCHANT_ID=your-paypal-business-merchant-id
PAYPAL_MERCHANT_EMAIL=payments@example.com
```

For local automated tests only, the project recognizes `mock_paypal_sandbox_secret` as a sandbox mock secret so Playwright can verify the PayPal button flow without contacting PayPal.

## Useful commands

```bash
npm run build
npm run test
npm run test:e2e
```
