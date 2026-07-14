import { test, expect } from '@playwright/test';
import { login } from '../utils/login.js';

test('Settings page loads with correct heading', async ({ page }) => {
  await login(page);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
});

test('Settings page shows Save System Settings button', async ({ page }) => {
  await login(page);
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: /save system settings/i })).toBeVisible();
});
