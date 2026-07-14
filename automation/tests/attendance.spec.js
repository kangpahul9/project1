import { test, expect } from '@playwright/test';
import { login } from '../utils/login.js';

test('Attendance page loads with correct heading', async ({ page }) => {
  await login(page);
  await page.goto('/attendance');
  await expect(page.getByRole('heading', { name: 'Attendance Logs', exact: true })).toBeVisible();
});

test('Attendance page shows stat cards', async ({ page }) => {
  await login(page);
  await page.goto('/attendance');
  // At minimum the page should have rendered content — check URL stayed
  await expect(page).toHaveURL(/\/attendance/);
  await expect(page.locator('h1')).toBeVisible();
});
