// FIXED: heading is "Staff Members" not "Staff"
import { test, expect } from '@playwright/test';
import { login } from '../utils/login.js';

test('Staff page loads with correct heading', async ({ page }) => {
  await login(page);
  await page.goto('/staff');
  await expect(page.getByRole('heading', { name: 'Staff Members', exact: true })).toBeVisible();
});

test('Staff page shows Add Staff button', async ({ page }) => {
  await login(page);
  await page.goto('/staff');
  await expect(page.getByRole('button', { name: '+ Add Staff' })).toBeVisible();
});
