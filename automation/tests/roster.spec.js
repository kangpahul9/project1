import { test, expect } from '@playwright/test';
import { login } from '../utils/login.js';

test('Roster page loads with correct heading', async ({ page }) => {
  await login(page);
  await page.goto('/roster');
  await expect(page.getByRole('heading', { name: 'Staff Roster', exact: true })).toBeVisible();
});

test('Roster page shows week navigation', async ({ page }) => {
  await login(page);
  await page.goto('/roster');
  // Week navigation arrows should be present
  await expect(page.locator('button[aria-label]').first()).toBeVisible();
});
