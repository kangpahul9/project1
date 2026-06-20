process.env.JWT_SECRET = "test-secret-key-minimum-32-characters-long";
process.env.NODE_ENV = "test";
process.env.DB_HOST = "localhost";
process.env.DB_PORT = "5432";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";
process.env.DB_NAME = "test";
process.env.DB_SSL = "false";

// Stripe (required for billing.js to load without throwing)
process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_testing_only";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake_webhook_secret";
process.env.STRIPE_PRICE_ID = "price_fake_test_id";
process.env.CLIENT_URL = "http://localhost:3000";

// Xero (optional — routes check them at request time)
process.env.XERO_CLIENT_ID = "fake_xero_client_id";
process.env.XERO_CLIENT_SECRET = "fake_xero_secret";
process.env.XERO_REDIRECT_URI = "http://localhost:3000/api/xero/callback";

// OpenAI (optional — route returns 503 if missing)
process.env.OPENAI_API_KEY = "sk-fake-openai-key";

// Pre-populate the in-memory token version cache for user IDs used in tests.
// authMiddleware checks token_version via cache first; if cached, it skips the
// pool.query call. This prevents tests' mockResolvedValueOnce from being
// consumed by the middleware before the route handler sees it.
try {
  const { setCachedTokenVersion } = require("../src/utils/tokenVersionCache.js");
  for (let id = 1; id <= 100; id++) {
    // setCachedTokenVersion is async but uses synchronous memSet when no Redis
    setCachedTokenVersion(id, 0).catch(() => {});
  }
} catch (_) {
  // tokenVersionCache may not be loadable in all contexts; ignore
}
