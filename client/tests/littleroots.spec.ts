import { test, expect } from 'playwright-test-coverage';

test('homepage loads', async ({ page }) => {
  await page.goto('http://localhost:5173/');
});
