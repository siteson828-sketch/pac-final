import { test, expect } from '@playwright/test';

// Verifies the shared CheckoutSheet (components/CheckoutSheet.js) works on all
// three surfaces that use it — home, viewer, and the artwork detail page.
// The key guarantee: clicking a product opens the checkout sheet IN PLACE and
// places the (no-charge draft) order without ever navigating away — the original
// bug was product buttons redirecting to the home page via /?order=1.
//
// Mocks (client-side only, this browser): auth session + paid tier so the gated
// product UI renders, and the order endpoints so no real order/payment happens.
test.beforeEach(async ({ context }) => {
  await context.route('**/api/auth/session', r => r.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ user: { name: 'Test', email: 't@e.com' }, expires: '2099-01-01T00:00:00.000Z' }),
  }));
  await context.route('**/api/user-tier', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ tier: 'collector' }) }));
  await context.route('**/api/order-token', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'test' }) }));
  await context.route('**/api/track', r => r.fulfill({ status: 200, body: '{}' }));
  await context.route('**/api/ghl-event', r => r.fulfill({ status: 200, body: '{}' }));
  // Force the no-charge draft path (no Stripe) and capture the payload.
  await context.route('**/api/create-payment-intent', r => r.fulfill({ status: 501, body: '{}' }));
});

// Drives the sheet: pick "Mug", assert the sheet opened, fill shipping, submit,
// and assert an in-place success result with ZERO navigations. Returns the
// captured create-order body so the caller can assert the product.
async function completeCheckout(page, productSelector) {
  await page.waitForSelector(productSelector, { timeout: 20_000 });

  const navigations = [];
  page.on('framenavigated', f => { if (f === page.mainFrame()) navigations.push(f.url()); });
  const urlBefore = page.url();

  let orderBody = null;
  await page.route('**/api/create-order', r => {
    orderBody = r.request().postDataJSON();
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ message: 'Draft order placed', orderId: 'TEST-1' }) });
  });

  await page.locator(productSelector, { hasText: 'Mug' }).first().click();
  await expect(page.locator('.co-sheet')).toBeVisible();
  await expect(page.locator('.co-title')).toHaveText('Mug');

  const fields = ['name', 'email', 'phone', 'address1', 'city', 'state_code', 'zip', 'country_code'];
  const vals = { name: 'Test Buyer', email: 't@e.com', address1: '1 Test St', city: 'Testville', state_code: 'CA', zip: '90001', country_code: 'US' };
  const inputs = page.locator('.co-sheet .co-input');
  const n = await inputs.count();
  for (let i = 0; i < n; i++) { const k = fields[i]; if (vals[k]) await inputs.nth(i).fill(vals[k]); }

  await page.locator('.co-sheet .co-btn', { hasText: /Continue/ }).first().click();
  await expect(page.locator('.co-result')).toBeVisible();
  await expect(page.locator('.co-result')).toContainText('Draft order placed');

  // The core assertion: stayed on the same page, no navigation.
  expect(navigations, 'clicking a product must not navigate').toHaveLength(0);
  expect(page.url()).toBe(urlBefore);
  expect(orderBody?.productName).toBe('Mug');
}

test('home: product tile opens checkout in place', async ({ page }) => {
  await page.goto('/');
  await page.locator('.gallery-card').first().click();
  await expect(page.locator('.modal')).toBeVisible();
  await completeCheckout(page, '.prod-item');
});

test('viewer: product tile opens checkout in place', async ({ page }) => {
  await page.goto('/viewer');
  await page.waitForSelector('.museum-btn', { timeout: 30_000 });
  const count = await page.locator('.museum-btn').count();
  let loaded = false;
  for (let i = 0; i < Math.min(count, 6); i++) {
    await page.locator('.museum-btn').nth(i).click();
    try { await page.waitForSelector('.art-card', { timeout: 10_000 }); loaded = true; break; } catch {}
  }
  expect(loaded, 'a museum with works should load').toBe(true);
  await page.locator('.art-card').first().click();
  await expect(page.locator('.modal')).toBeVisible();
  await completeCheckout(page, '.prod-item');
});

test('artwork detail: product button opens checkout in place', async ({ page, request }) => {
  const { works } = await (await request.get('/api/artworks?limit=1')).json();
  await page.goto(`/artwork/${works[0].id}`);
  await completeCheckout(page, '.prod');
});
