import { test, expect } from '@playwright/test';
import { login } from '../utils/login.js';

test('Logout redirects to login page', async ({ page }) => {
  await login(page);
  // Click the Sign out button in the sidebar (title="Sign out")
  await page.locator('[title="Sign out"]').click();
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
});

test('After logout, protected routes redirect to login', async ({ page }) => {
  await login(page);
  await page.locator('[title="Sign out"]').click();
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  // Navigating to a protected route should redirect back to login
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
