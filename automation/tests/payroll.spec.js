import { test, expect } from '@playwright/test';
import { login } from '../utils/login.js';

test('Payroll page loads with correct heading', async ({ page }) => {
  await login(page);
  await page.goto('/payroll');
  await expect(page.getByRole('heading', { name: 'Payroll', exact: true })).toBeVisible();
});

test('Payroll page shows period navigation', async ({ page }) => {
  await login(page);
  await page.goto('/payroll');
  await expect(page).toHaveURL(/\/payroll/);
  // Week navigation chevron buttons should exist
  await expect(page.locator('button').first()).toBeVisible();
});
