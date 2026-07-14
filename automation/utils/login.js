// Shared login helper — reuse in every test that needs auth
// Credentials come from environment variables:
//   KANGPOS_UID      → Business UID  (e.g. continental-dhaba2016)
//   KANGPOS_EMAIL    → Admin email
//   KANGPOS_PASSWORD → Admin password

const BASE = 'https://app.kangpos.com';

const UID      = process.env.KANGPOS_UID      || 'continental-dhaba2016';
const EMAIL    = process.env.KANGPOS_EMAIL    || 'pahulpreet2959@gmail.com';
const PASSWORD = process.env.KANGPOS_PASSWORD || '';

export async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder('e.g. REST-001').fill(UID);
  await page.getByPlaceholder('you@example.com').fill(EMAIL);
  await page.getByPlaceholder('Enter your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}
