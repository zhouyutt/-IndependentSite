import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const log = [];
let productId = '';

function step(name) {
  log.push(`ok: ${name}`);
}

try {
  await page.route('https://www.paypal.com/sdk/js**', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.paypal = {
          Buttons(options) {
            return {
              render(container) {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = 'PayPal Sandbox Pay';
                button.setAttribute('aria-label', 'PayPal Sandbox Pay');
                button.className = 'paypal-sandbox-button';
                button.onclick = async () => {
                  try {
                    const orderID = await options.createOrder();
                    await options.onApprove({ orderID });
                  } catch (error) {
                    options.onError && options.onError(error);
                  }
                };
                container.appendChild(button);
              }
            };
          }
        };
      `
    });
  });

  await fetch('http://localhost:3001/api/admin/payments/paypal/account', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'sandbox',
      clientId: 'mock-paypal-client-id',
      clientSecret: 'mock_paypal_sandbox_secret',
      merchantId: 'MOCKMERCHANT123',
      merchantEmail: 'payments@example.com'
    })
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Gear Up Your Game/i }).waitFor({ timeout: 8000 });
  step('home hero rendered');

  await page.getByRole('link', { name: /Shop Best Sellers/i }).first().click();
  await page.locator('.product-card').first().waitFor({ timeout: 8000 });
  const initialCards = await page.locator('.product-card').count();
  if (initialCards < 4) throw new Error(`expected product cards, got ${initialCards}`);
  step(`product grid rendered (${initialCards} cards)`);

  await page.locator('.filters select').first().selectOption({ label: 'Basketball Hoops' });
  await page.waitForTimeout(600);
  const filteredText = await page.locator('.product-card').first().innerText();
  if (!/Basketball|Hoop/i.test(filteredText)) throw new Error('category filter did not update grid');
  step('category filter works');

  await page.locator('.product-card .wish').first().click();
  await page.locator('.product-card .wish.active').first().waitFor({ timeout: 5000 });
  step('wishlist toggle works');

  await page.locator('.product-card .product-name').first().click();
  await page.locator('.drawer.open').getByRole('heading').waitFor({ timeout: 5000 });
  step('product details drawer opens');

  await page.locator('.drawer.open').getByRole('button', { name: /Add to Cart/i }).click();
  await page.locator('.cart-drawer.open').getByRole('heading', { name: /Your Cart/i }).waitFor({ timeout: 5000 });
  step('add to cart opens cart drawer');

  await page.getByRole('button', { name: /Checkout Securely/i }).click();
  await page.getByLabel('Name').fill('QA Buyer');
  await page.getByLabel('Email').fill('qa@example.com');
  await page.getByLabel('Address').fill('100 Court Way');
  await page.getByLabel('City').fill('Austin');
  await page.getByLabel('State').fill('TX');
  await page.getByLabel('ZIP').fill('78701');
  await page.getByRole('button', { name: /Continue to PayPal/i }).click();
  await page.getByRole('button', { name: /PayPal Sandbox Pay/i }).click();
  await page.locator('.order-toast').waitFor({ timeout: 6000 });
  step('paypal checkout creates paid order');

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Open navigation/i }).click();
  await page.locator('.mobile-menu.open').waitFor({ timeout: 5000 });
  step('mobile nav opens');

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /运营数据看板/i }).waitFor({ timeout: 8000 });
  await page.locator('.metric-grid .el-card').first().waitFor({ timeout: 8000 });
  step('standalone admin dashboard renders');

  await page.getByRole('menuitem', { name: /收款账户/i }).click();
  await page.getByText('PayPal 收款账户').waitFor({ timeout: 8000 });
  await page.getByText('已绑定').first().waitFor({ timeout: 8000 });
  step('admin paypal account binding renders');

  await page.getByRole('menuitem', { name: /数据看板/i }).click();
  const ordersText = await page.locator('.el-card', { hasText: '近期交易' }).innerText();
  if (!/QA Buyer|DN-/i.test(ordersText)) throw new Error('admin transactions did not include test order');
  step('admin transaction table updates');

  await page.getByRole('menuitem', { name: /商品管理/i }).click();
  await page.getByRole('button', { name: /上架商品/i }).click();
  productId = `qa-hoop-${Date.now()}`;
  await page.getByLabel('商品 ID').fill(productId);
  await page.getByLabel('商品名称').fill('QA Portable Basketball Hoop');
  await page.getByLabel('商品描述').fill('A storefront test product created through the admin system.');
  await page.locator('.el-dialog').getByRole('spinbutton', { name: '库存' }).fill('13');
  await page.getByRole('button', { name: /发布商品/i }).click();
  await page.getByText('商品已上架。').waitFor({ timeout: 8000 });
  step('admin create product works');

  await page.getByText('QA Portable Basketball Hoop').waitFor({ timeout: 8000 });
  const row = page.locator('.el-table__row', { hasText: 'QA Portable Basketball Hoop' }).first();
  await row.getByRole('button', { name: '编辑' }).click();
  await page.locator('.el-dialog').getByRole('spinbutton', { name: '库存' }).fill('4');
  await page.getByRole('button', { name: /保存商品/i }).click();
  await page.getByText('商品已更新。').waitFor({ timeout: 8000 });
  step('admin edit product works');

  await page.getByRole('menuitem', { name: /交易详情/i }).click();
  await page.locator('.el-table__row').filter({ hasText: 'QA Buyer' }).first().click();
  await page.locator('.el-drawer').getByText('QA Buyer').waitFor({ timeout: 8000 });
  step('admin transaction detail works');
  await page.locator('.el-drawer__close-btn').click();
  await page.locator('.el-drawer').waitFor({ state: 'hidden', timeout: 8000 });

  await page.getByRole('menuitem', { name: /商品管理/i }).click();
  const editedRow = page.locator('.el-table__row', { hasText: 'QA Portable Basketball Hoop' }).first();
  await editedRow.getByRole('button', { name: '删除' }).click();
  await page.locator('.el-message-box').getByRole('button', { name: '删除' }).click();
  await page.getByText('商品已删除。').waitFor({ timeout: 8000 });
  step('admin delete product works');

  console.log(log.join('\n'));
} finally {
  if (productId) {
    await fetch(`http://localhost:3001/api/admin/products/${productId}`, { method: 'DELETE' }).catch(() => {});
  }
  await browser.close();
}
