import { test, expect } from '@playwright/test';
import { login } from '../utils/login.js';

test('Expenses page loads with correct heading', async ({ page }) => {
  await login(page);
  await page.goto('/expenses');
  await expect(page.getByRole('heading', { name: 'Expenses', exact: true })).toBeVisible();
});

test('Expenses page shows Add Expense button', async ({ page }) => {
  await login(page);
  await page.goto('/expenses');
  await expect(page.getByRole('button', { name: /add expense/i })).toBeVisible();
});
