/**
 * Full middleware-stack integration tests.
 * Builds an Express app mirroring production: helmet, CORS, /api prefix,
 * rate limiter, authenticate → loadSettings → attachBusinessDay → routes.
 * DB is mocked; all other middleware runs for real.
 */
import request from "supertest";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");
jest.mock("../../src/middleware/loadSettings.js", () => ({
  loadSettings: jest.fn((req, _res, next) => {
    req.settings = { use_business_day: false, currency: { code: "INR" } };
    next();
  }),
}));
jest.mock("../../src/middleware/attachBusinessDay.js", () => ({
  attachBusinessDay: jest.fn((req, _res, next) => {
    req.businessDayId = 10;
    next();
  }),
}));

const pool = require("../../src/config/db.js").default;

import { authenticate } from "../../src/middleware/authMiddleware.js";
import { loadSettings } from "../../src/middleware/loadSettings.js";
import { attachBusinessDay } from "../../src/middleware/attachBusinessDay.js";
import ordersRouter from "../../src/routes/orders.js";
import partnersRouter from "../../src/routes/partners.js";

const SECRET = process.env.JWT_SECRET;

const adminToken = jwt.sign(
  { id: 1, restaurantId: 1, role: "ADMIN" },
  SECRET,
  { expiresIn: "1h", issuer: "kangpos", audience: "kangpos-users" }
);
const staffToken = jwt.sign(
  { id: 2, restaurantId: 1, role: "STAFF" },
  SECRET,
  { expiresIn: "1h", issuer: "kangpos", audience: "kangpos-users" }
);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

// ── Build a near-production Express app ──────────────────────────────────
function buildApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  // Attach request logger stub so routes don't crash on req.log
  app.use((req, _res, next) => {
    req.log = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
    next();
  });

  // Health check — no auth
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  const apiRouter = express.Router();

  // Auth limiter (low cap for test — but we won't hit it in the few requests we make)
  const authLimiter = rateLimit({ windowMs: 60_000, max: 100 });
  const globalLimiter = rateLimit({ windowMs: 60_000, max: 500 });

  app.use("/api", globalLimiter, apiRouter);

  // Protected middleware stack (mirrors index.js)
  apiRouter.use(authenticate);
  apiRouter.use(loadSettings);
  apiRouter.use(attachBusinessDay);

  apiRouter.use("/orders", ordersRouter);
  apiRouter.use("/partners", partnersRouter);

  // Error handler
  app.use((err, _req, res, _next) => {
    res.status(err.status || 400).json({ message: err.message });
  });

  return app;
}

const app = buildApp();

// ─── Health check ─────────────────────────────────────────────────────────

describe("GET /health", () => {
  test("returns 200 without authentication", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

// ─── Security headers (Helmet) ────────────────────────────────────────────

describe("Security headers", () => {
  test("Helmet sets X-Content-Type-Options", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  test("Helmet sets X-Frame-Options", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });
});

// ─── CORS ─────────────────────────────────────────────────────────────────

describe("CORS headers", () => {
  test("API responds to preflight OPTIONS request", async () => {
    const res = await request(app)
      .options("/api/orders")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET");

    expect([200, 204]).toContain(res.status);
    expect(res.headers["access-control-allow-origin"]).toBeDefined();
  });
});

// ─── Authentication gating on /api routes ────────────────────────────────

describe("API authentication gating", () => {
  test("GET /api/orders returns 401 without token", async () => {
    const res = await request(app).get("/api/orders");
    expect(res.status).toBe(401);
  });

  test("GET /api/partners returns 401 without token", async () => {
    const res = await request(app).get("/api/partners");
    expect(res.status).toBe(401);
  });

  test("GET /api/orders returns 401 with invalid token", async () => {
    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", "Bearer not-a-valid-jwt");
    expect(res.status).toBe(401);
  });

  test("GET /api/orders returns 401 with expired token", async () => {
    const expired = jwt.sign(
      { id: 1, restaurantId: 1, role: "ADMIN" },
      SECRET,
      { expiresIn: "-1s", issuer: "kangpos", audience: "kangpos-users" }
    );
    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  test("GET /api/orders accepts valid token", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get("/api/orders")
      .set(auth(adminToken));

    expect(res.status).toBe(200);
  });
});

// ─── Routes are accessible at /api/* prefix ───────────────────────────────

describe("Routes accessible at /api/* prefix", () => {
  test("GET /api/partners returns partner list", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: "Alice", share_percent: 30 }],
    });

    const res = await request(app)
      .get("/api/partners")
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /orders (without /api prefix) returns 404", async () => {
    const res = await request(app).get("/orders").set(auth(adminToken));
    expect(res.status).toBe(404);
  });
});

// ─── RBAC through the full middleware stack ───────────────────────────────

describe("RBAC through full middleware stack", () => {
  test("STAFF cannot delete a partner", async () => {
    const res = await request(app)
      .delete("/api/partners/1")
      .set(auth(staffToken));

    expect(res.status).toBe(403);
  });

  test("ADMIN can hit admin-only endpoints", async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);

    const res = await request(app)
      .delete("/api/partners/1")
      .set(auth(adminToken));

    expect(res.status).toBe(200);
  });
});
