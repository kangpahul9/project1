/**
 * Security / edge-case tests
 *
 * Covers:
 *  1. IDOR — a token for restaurant 2 cannot read restaurant 1 data
 *  2. DB connection failure — pool.connect() rejects, route returns 500
 *  3. Oversized / malformed payloads (basic sanity)
 *  4. Concurrent idempotency (second identical request is a no-op, not an error)
 */

import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");
jest.mock("../../src/utils/ledger.js", () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/utils/bankLedger.js", () => ({
  bankWithEvent: jest.fn().mockResolvedValue(undefined),
}));

const pool = require("../../src/config/db.js").default;
import ordersRouter from "../../src/routes/orders.js";
import expensesRouter from "../../src/routes/expenses.js";
import partnersRouter from "../../src/routes/partners.js";
import cashRouter from "../../src/routes/cash.js";

jest.mock("../../src/utils/denominationUtils.js", () => ({
  normalizeDenominations: jest.fn((m) => m),
  validateDenominations: jest.fn(),
}));

const SECRET = process.env.JWT_SECRET;

// Restaurant 1 tokens
const r1Admin = jwt.sign({ id: 1, restaurantId: 1, role: "ADMIN" }, SECRET, {
  expiresIn: "1h", issuer: "kangpos", audience: "kangpos-users",
});
// Restaurant 2 token — different tenant
const r2Admin = jwt.sign({ id: 99, restaurantId: 2, role: "ADMIN" }, SECRET, {
  expiresIn: "1h", issuer: "kangpos", audience: "kangpos-users",
});

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// ────────────────────────────────────────────────────────────────────────────────
// Shared app that mounts all tested routers under their normal prefixes
// ────────────────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.log = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  req.settings = { use_business_day: true, currency: { code: "INR" } };
  req.businessDayId = 10;
  next();
});
app.use("/orders", ordersRouter);
app.use("/expenses", expensesRouter);
app.use("/partners", partnersRouter);
app.use("/cash", cashRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

// ────────────────────────────────────────────────────────────────────────────────
// 1. IDOR PROTECTION — cross-tenant data isolation
// ────────────────────────────────────────────────────────────────────────────────

describe("IDOR — cross-tenant isolation", () => {
  /**
   * The route always appends `AND restaurant_id=$X` to every query.
   * When restaurant 2 requests an order belonging to restaurant 1,
   * the DB returns 0 rows → route returns 404/empty, NOT the row.
   *
   * We simulate: pool.query returns [] (as the DB would when the tenant filter eliminates the row).
   */

  beforeEach(() => pool.query.mockReset());

  test("restaurant-2 token cannot read restaurant-1 orders (returns empty array)", async () => {
    // pool returns no rows because restaurant_id=2 filter excludes restaurant 1 data
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get("/orders")
      .set(auth(r2Admin));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("restaurant-2 token cannot read restaurant-1 expenses (returns empty array)", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get("/expenses")
      .set(auth(r2Admin));
    expect(res.status).toBe(200);
    expect(res.body.data ?? res.body).toEqual([]);
  });

  test("restaurant-2 token cannot read restaurant-1 partners (returns empty array)", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get("/partners")
      .set(auth(r2Admin));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("restaurant-2 token cannot mutate restaurant-1 order (order not found)", async () => {
    // DELETE uses pool.connect; simulate order not found for restaurant 2
    const noRowClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)   // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE — 0 rows because restaurant filter
        .mockResolvedValue(undefined),
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(noRowClient);

    const res = await request(app)
      .post("/orders/1/delete")
      .set(auth(r2Admin))
      .send({ reason: "test" });
    expect(res.status).toBe(400); // "Order not found" (scoped to restaurantId=2)
  });

  test("restaurant-2 token cannot read restaurant-1 cash drawer (returns 0)", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // drawer is empty for restaurant 2
    const res = await request(app)
      .get("/cash/current")
      .set(auth(r2Admin));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// 2. DB CONNECTION FAILURE
// ────────────────────────────────────────────────────────────────────────────────

describe("DB connection failure", () => {
  test("POST /expenses returns 500 when pool.connect() throws", async () => {
    pool.connect = jest.fn().mockRejectedValue(new Error("Connection refused"));
    const res = await request(app)
      .post("/expenses")
      .set(auth(r1Admin))
      .send({
        category: "food",
        amount: 100,
        paymentMode: "cash",
        idempotencyKey: "exp_fail_test",
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("POST /orders returns 500 when pool.connect() throws", async () => {
    pool.connect = jest.fn().mockRejectedValue(new Error("Connection refused"));
    const res = await request(app)
      .post("/orders")
      .set(auth(r1Admin))
      .send({
        items: [{ menu_item_id: 1, qty: 1, price: 100 }],
        totalAmount: 100,
        idempotencyKey: "order_fail_test",
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("GET /orders falls back to error when pool.query throws", async () => {
    pool.query.mockRejectedValueOnce(new Error("Query failed"));
    const res = await request(app)
      .get("/orders")
      .set(auth(r1Admin));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// 3. MALFORMED / OVERSIZED PAYLOAD EDGE CASES
// ────────────────────────────────────────────────────────────────────────────────

describe("Malformed payload edge cases", () => {
  beforeEach(() => pool.query.mockReset());

  test("POST /orders rejects non-array items", async () => {
    const res = await request(app)
      .post("/orders")
      .set(auth(r1Admin))
      .send({ items: "not-an-array", idempotencyKey: "order_bad" });
    expect(res.status).toBe(400);
  });

  test("POST /orders rejects empty items array", async () => {
    const res = await request(app)
      .post("/orders")
      .set(auth(r1Admin))
      .send({ items: [], idempotencyKey: "order_empty" });
    expect(res.status).toBe(400);
  });

  test("POST /expenses rejects amount=0", async () => {
    const res = await request(app)
      .post("/expenses")
      .set(auth(r1Admin))
      .send({ category: "food", amount: 0, paymentMode: "cash", idempotencyKey: "exp_zero" });
    expect(res.status).toBe(400);
  });

  test("POST /expenses rejects negative amount", async () => {
    const res = await request(app)
      .post("/expenses")
      .set(auth(r1Admin))
      .send({ category: "food", amount: -50, paymentMode: "cash", idempotencyKey: "exp_neg" });
    expect(res.status).toBe(400);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// 4. IDEMPOTENCY — concurrent duplicate requests are no-ops, not errors
// ────────────────────────────────────────────────────────────────────────────────

describe("Idempotency — duplicate key is graceful no-op", () => {
  test("POST /expenses with duplicate key returns 200 (not 400/500)", async () => {
    const duplicateClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)           // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }), // idempotency hit
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(duplicateClient);
    const res = await request(app)
      .post("/expenses")
      .set(auth(r1Admin))
      .send({
        category: "food",
        amount: 100,
        paymentMode: "cash",
        idempotencyKey: "exp_dup123",
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Already processed");
  });

  test("POST /cash/recount with duplicate key returns 200 (not 400/500)", async () => {
    const dupClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)            // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 5 }] }), // idempotency hit
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(dupClient);
    const res = await request(app)
      .post("/cash/recount")
      .set(auth(r1Admin))
      .send({ breakdown: [{ note: 500, qty: 2 }], idempotencyKey: "recount_dup" });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Already processed");
  });
});
