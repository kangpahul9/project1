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
jest.mock("../../src/middleware/attachBusinessDay.js", () =>
  jest.fn((req, _res, next) => {
    req.businessDayId = 10;
    next();
  })
);
jest.mock("../../src/middleware/loadSettings.js", () =>
  jest.fn((req, _res, next) => {
    req.settings = { use_business_day: false, currency: { code: "INR" } };
    next();
  })
);

const pool = require("../../src/config/db.js").default;

import expensesRouter from "../../src/routes/expenses.js";

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

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.log = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  req.settings = { use_business_day: false, currency: { code: "INR" } };
  req.businessDayId = 10;
  next();
});
app.use("/expenses", expensesRouter);
app.use((err, _req, res, _next) => {
  res.status(err.status || 400).json({ message: err.message });
});

const mockExpense = {
  id: 1,
  amount: 100,
  category: "other",
  payment_method: "cash",
  is_paid: false,
  business_day_id: 10,
  restaurant_id: 1,
};

// ─── GET /expenses ─────────────────────────────────────────────────────────

describe("GET /expenses", () => {
  test("returns expense list for admin", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockExpense] });

    const res = await request(app).get("/expenses").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].category).toBe("other");
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/expenses");
    expect(res.status).toBe(401);
  });

  test("returns 403 for STAFF role", async () => {
    const res = await request(app).get("/expenses").set(auth(staffToken));
    expect(res.status).toBe(403);
  });
});

// ─── POST /expenses ────────────────────────────────────────────────────────

describe("POST /expenses — input validation", () => {
  const validExpense = {
    amount: 100,
    category: "other",
    paymentMode: "cash",
    is_paid: false,
    idempotencyKey: "exp-test-001",
  };

  const mockClientFactory = () => ({
    query: jest
      .fn()
      .mockResolvedValueOnce(undefined)               // BEGIN
      .mockResolvedValueOnce({ rows: [] })            // idempotency check
      .mockResolvedValueOnce({ rows: [mockExpense] }) // INSERT expense
      .mockResolvedValueOnce(undefined),              // COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(mockClientFactory());
  });

  test("creates a cash expense successfully", async () => {
    const res = await request(app)
      .post("/expenses")
      .set(auth(adminToken))
      .send(validExpense);

    expect(res.status).toBe(201);
  });

  test("rejects missing amount", async () => {
    const res = await request(app)
      .post("/expenses")
      .set(auth(adminToken))
      .send({ ...validExpense, amount: 0, idempotencyKey: "exp-test-002" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid amount");
  });

  test("rejects missing category", async () => {
    const res = await request(app)
      .post("/expenses")
      .set(auth(adminToken))
      .send({ ...validExpense, category: undefined, idempotencyKey: "exp-test-003" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Category required");
  });

  test("rejects invalid payment mode", async () => {
    const res = await request(app)
      .post("/expenses")
      .set(auth(adminToken))
      .send({ ...validExpense, paymentMode: "crypto", idempotencyKey: "exp-test-004" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid payment mode");
  });

  test("requires idempotency key", async () => {
    const res = await request(app)
      .post("/expenses")
      .set(auth(adminToken))
      .send({ ...validExpense, idempotencyKey: undefined });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Idempotency key required");
  });

  test("requires vendor for supplies category", async () => {
    const res = await request(app)
      .post("/expenses")
      .set(auth(adminToken))
      .send({ ...validExpense, category: "supplies", idempotencyKey: "exp-test-005" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Vendor required");
  });

  test("requires staff for salary category", async () => {
    const res = await request(app)
      .post("/expenses")
      .set(auth(adminToken))
      .send({ ...validExpense, category: "salary", idempotencyKey: "exp-test-006" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Staff required");
  });

  test("STAFF role cannot create expenses (admin only)", async () => {
    const res = await request(app)
      .post("/expenses")
      .set(auth(staffToken))
      .send(validExpense);

    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/expenses").send(validExpense);
    expect(res.status).toBe(401);
  });

  test("idempotent — second request with same key returns already-processed", async () => {
    pool.connect.mockResolvedValue({
      query: jest
        .fn()
        .mockResolvedValueOnce(undefined)          // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // idempotency hit
        .mockResolvedValueOnce(undefined),          // ROLLBACK
      release: jest.fn(),
    });

    const res = await request(app)
      .post("/expenses")
      .set(auth(adminToken))
      .send(validExpense);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Already processed");
  });
});

// ─── DELETE /expenses/:id ──────────────────────────────────────────────────

describe("DELETE /expenses/:id", () => {
  test("admin can delete an unpaid expense", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });

    const res = await request(app)
      .delete("/expenses/1")
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Deleted");
  });

  test("returns 404 if expense not found or already paid", async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .delete("/expenses/999")
      .set(auth(adminToken));

    expect(res.status).toBe(404);
  });

  test("STAFF cannot delete expenses", async () => {
    const res = await request(app)
      .delete("/expenses/1")
      .set(auth(staffToken));

    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).delete("/expenses/1");
    expect(res.status).toBe(401);
  });
});
