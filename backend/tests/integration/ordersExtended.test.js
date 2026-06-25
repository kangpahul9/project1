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
jest.mock("../../src/utils/denominationUtils.js", () => ({
  normalizeDenominations: jest.fn((m) => m),
  validateDenominations: jest.fn(),
}));

const pool = require("../../src/config/db.js").default;
import ordersRouter from "../../src/routes/orders.js";

const SECRET = process.env.JWT_SECRET;
const adminToken = jwt.sign({ id: 1, restaurantId: 1, role: "ADMIN" }, SECRET, {
  expiresIn: "1h", issuer: "kangpos", audience: "kangpos-users",
});
const staffToken = jwt.sign({ id: 2, restaurantId: 1, role: "STAFF" }, SECRET, {
  expiresIn: "1h", issuer: "kangpos", audience: "kangpos-users",
});
const auth = (t) => ({ Authorization: `Bearer ${t}` });

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.log = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  req.settings = { use_business_day: true, currency: { code: "INR" } };
  req.businessDayId = 10;
  next();
});
app.use("/orders", ordersRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

// ────────────────────────────────────────────────────────────────────────────────
// PAY ORDER
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /orders/:id/pay", () => {
  const validPayload = {
    paymentMethod: "cash",
    cashBreakdown: [{ note: 500, qty: 1 }],
    idempotencyKey: "pay_abc123",
  };

  // A typical "cash order, full payment" transaction sequence:
  // BEGIN → idempotency check → SELECT order FOR UPDATE → processPayment internals
  //   (denominations upsert) → UPDATE order → INSERT order_payments → COMMIT
  // validateDrawerConsistency (called at end of pay) needs rows[0].total
  const drawerSafe = { rows: [{ total: "0", count: "0", id: 1, quantity: "0" }] };

  const makePayClient = ({ alreadyPaid = false, notFound = false } = {}) => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                               // BEGIN
      .mockResolvedValueOnce({ rows: [] })                            // idempotency check (no dup)
      .mockResolvedValueOnce({                                        // SELECT order FOR UPDATE
        rows: notFound ? [] : [{
          id: 1, total: "500.00", amount_paid: "0.00",
          is_paid: alreadyPaid, is_deleted: false,
          business_day_id: 10, restaurant_id: 1,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })                            // addCash INSERT denominations
      .mockResolvedValueOnce({                                        // UPDATE orders RETURNING *
        rows: [{ id: 1, is_paid: true, amount_paid: "500.00", due_amount: "0.00" }],
      })
      .mockResolvedValueOnce({ rows: [] })                            // INSERT order_payments
      .mockResolvedValueOnce({ rows: [] })                            // storeOrderDenominations INSERT
      .mockResolvedValue(drawerSafe),                                 // validateDrawerConsistency + COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(makePayClient());
  });

  test("any authenticated user can pay an order (returns 200)", async () => {
    const res = await request(app)
      .post("/orders/1/pay")
      .set(auth(staffToken))
      .send(validPayload);
    expect(res.status).toBe(200);
  });

  test("admin can also pay an order", async () => {
    const res = await request(app)
      .post("/orders/1/pay")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(200);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/orders/1/pay").send(validPayload);
    expect(res.status).toBe(401);
  });

  test("returns 400 when idempotencyKey is missing", async () => {
    const res = await request(app)
      .post("/orders/1/pay")
      .set(auth(adminToken))
      .send({ paymentMethod: "cash", cashBreakdown: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/idempotency/i);
  });

  test("returns 200 with 'Already processed' for duplicate idempotency key", async () => {
    pool.connect = jest.fn().mockResolvedValue({
      query: jest.fn()
        .mockResolvedValueOnce(undefined)                // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 99 }] }), // idempotency check — already exists
      release: jest.fn(),
    });
    const res = await request(app)
      .post("/orders/1/pay")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Already processed");
  });

  test("returns 400 when order not found", async () => {
    pool.connect = jest.fn().mockResolvedValue(makePayClient({ notFound: true }));
    const res = await request(app)
      .post("/orders/1/pay")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not found/i);
  });

  test("returns 400 when order is already paid", async () => {
    pool.connect = jest.fn().mockResolvedValue(makePayClient({ alreadyPaid: true }));
    const res = await request(app)
      .post("/orders/1/pay")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already fully paid/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// REFUND ORDER
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /orders/:id/refund", () => {
  const validRefund = {
    items: [{ menu_item_id: 101, qty: 1 }],
    denominations: [{ note: 500, qty: 1 }],
  };

  const makeRefundClient = ({ notFound = false, nothingPaid = false } = {}) => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                              // BEGIN
      .mockResolvedValueOnce({                                       // SELECT order FOR UPDATE
        rows: notFound ? [] : [{
          id: 1, total: "500.00",
          amount_paid: nothingPaid ? "0.00" : "500.00",
          is_paid: true, is_deleted: false,
          business_day_id: 10, restaurant_id: 1,
        }],
      })
      .mockResolvedValueOnce({                                       // SELECT order_items
        rows: [{ menu_item_id: 101, quantity: 2, price: "250.00", price_snapshot: "250.00" }],
      })
      .mockResolvedValueOnce({                                       // SELECT order_payments
        rows: [{ payment_method: "cash", amount: "500.00" }],
      })
      // processCashRefund with manualChangeBreakdown (denominations)
      .mockResolvedValueOnce({ rows: [{ quantity: "10" }] })         // SELECT denominations FOR UPDATE
      .mockResolvedValueOnce({ rows: [] })                           // UPDATE denominations qty - 1
      // logEvent is mocked (no query)
      .mockResolvedValueOnce({ rows: [] })                           // UPDATE order_items qty 2→1
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })             // SELECT COUNT remaining items
      .mockResolvedValueOnce({ rows: [{ total: "250" }] })           // SELECT SUM new total
      .mockResolvedValueOnce({ rows: [] })                           // UPDATE orders total
      .mockResolvedValue({ rows: [] }),                              // COMMIT + any extras
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(makeRefundClient());
  });

  test("returns 200 for valid refund request", async () => {
    const res = await request(app)
      .post("/orders/1/refund")
      .set(auth(adminToken))
      .send(validRefund);
    expect(res.status).toBe(200);
  });

  test("STAFF cannot request a refund (admin only)", async () => {
    const res = await request(app)
      .post("/orders/1/refund")
      .set(auth(staffToken))
      .send(validRefund);
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/orders/1/refund").send(validRefund);
    expect(res.status).toBe(401);
  });

  test("returns 400 when items array is empty", async () => {
    const res = await request(app)
      .post("/orders/1/refund")
      .set(auth(adminToken))
      .send({ items: [], denominations: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no items/i);
  });

  test("returns 400 when items is missing", async () => {
    const res = await request(app)
      .post("/orders/1/refund")
      .set(auth(adminToken))
      .send({ denominations: [{ note: 500, qty: 1 }] });
    expect(res.status).toBe(400);
  });

  test("returns 400 when order not found", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeRefundClient({ notFound: true }));
    const res = await request(app)
      .post("/orders/1/refund")
      .set(auth(adminToken))
      .send(validRefund);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not found/i);
  });

  test("returns 400 when nothing was paid (unpaid order)", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeRefundClient({ nothingPaid: true }));
    const res = await request(app)
      .post("/orders/1/refund")
      .set(auth(adminToken))
      .send(validRefund);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/nothing was paid/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// UNDO DELETE ORDER
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /orders/:id/undo-delete", () => {
  const drawerSafeUndo = { rows: [{ total: "0", count: "0", id: 1 }] };

  const makeUndoClient = ({ notFound = false, noItems = false } = {}) => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                              // BEGIN
      .mockResolvedValueOnce({                                       // SELECT order WHERE is_deleted=TRUE
        rows: notFound ? [] : [{
          id: 1, is_deleted: true, business_day_id: 10, restaurant_id: 1,
          amount_paid: "0",
        }],
      })
      .mockResolvedValueOnce({                                       // SELECT COUNT(*) order_items
        rows: [{ count: noItems ? "0" : "2" }],
      })
      .mockResolvedValueOnce({ rows: [] })                           // SELECT order_payments (empty)
      .mockResolvedValueOnce({ rows: [] })                           // UPDATE orders SET is_deleted=false
      .mockResolvedValue(drawerSafeUndo),                            // validateDrawerConsistency + COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(makeUndoClient());
  });

  test("admin can undo a deleted order", async () => {
    const res = await request(app)
      .post("/orders/1/undo-delete")
      .set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .post("/orders/1/undo-delete")
      .set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/orders/1/undo-delete");
    expect(res.status).toBe(401);
  });

  test("returns 400 when order not found in deleted state", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeUndoClient({ notFound: true }));
    const res = await request(app)
      .post("/orders/1/undo-delete")
      .set(auth(adminToken));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not found/i);
  });

  test("returns 400 for fully-refunded order (no items)", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeUndoClient({ noItems: true }));
    const res = await request(app)
      .post("/orders/1/undo-delete")
      .set(auth(adminToken));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/fully-refunded/i);
  });
});
