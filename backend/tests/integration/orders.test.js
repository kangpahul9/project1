import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");
jest.mock("../../src/middleware/attachBusinessDay.js", () =>
  jest.fn((req, _res, next) => { req.businessDayId = 10; next(); })
);
jest.mock("../../src/middleware/loadSettings.js", () =>
  jest.fn((req, _res, next) => {
    req.settings = { use_business_day: false, currency: { code: "INR" } };
    next();
  })
);

const pool = require("../../src/config/db.js").default;

import ordersRouter from "../../src/routes/orders.js";

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
  next();
});
app.use("/orders", ordersRouter);
app.use((err, _req, res, _next) => {
  res.status(400).json({ message: err.message });
});

describe("GET /orders", () => {
  test("returns orders list for authenticated user", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, bill_number: "B001", total: 500, status: "paid" }] });

    const res = await request(app).get("/orders").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/orders");
    expect(res.status).toBe(401);
  });
});

describe("POST /orders — input validation", () => {
  const validOrder = {
    items: [{ id: 1, name: "Burger", price: 150, quantity: 2 }],
    paymentMethod: "cash",
    tableNumber: "T1",
    idempotencyKey: "idem-001",
  };

  const mockClientFactory = () => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                            // BEGIN
      .mockResolvedValueOnce({ rows: [] })                         // idempotency check
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })               // last business day
      .mockResolvedValueOnce({ rows: [{ id: 1, bill_number: "B001", next_bill_number: 1 }] }) // restaurant settings
      .mockResolvedValueOnce({ rows: [{ id: 10, bill_number: "B001" }] }) // INSERT order
      .mockResolvedValueOnce({ rows: [] })                         // INSERT order_items
      .mockResolvedValueOnce({ rows: [{ id: 1, note_value: 500, quantity: 5 }] }) // denominations
      .mockResolvedValue({ rows: [] }),                            // remaining queries
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(mockClientFactory());
  });

  test("rejects empty cart", async () => {
    const res = await request(app)
      .post("/orders")
      .set(auth(staffToken))
      .send({ ...validOrder, items: [] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Cart empty");
  });

  test("rejects missing payment method", async () => {
    const res = await request(app)
      .post("/orders")
      .set(auth(staffToken))
      .send({ ...validOrder, paymentMethod: undefined });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Payment method");
  });

  test("rejects non-array items", async () => {
    const res = await request(app)
      .post("/orders")
      .set(auth(staffToken))
      .send({ ...validOrder, items: "not-an-array" });

    expect(res.status).toBe(400);
  });

  test("returns 401 without auth token", async () => {
    const res = await request(app).post("/orders").send(validOrder);
    expect(res.status).toBe(401);
  });
});

describe("POST /orders/:id/delete (soft delete)", () => {
  test("admin can soft-delete an order", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)                                    // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 5, is_deleted: false, payment_method: "cash", total: 300, amount_paid: 0, business_day_id: 10 }] }) // SELECT order
        .mockResolvedValueOnce({ rows: [] })                                 // SELECT refunds (idempotency)
        .mockResolvedValueOnce({ rows: [{ count: "0" }] })                   // COUNT order_items → hasItems=false
        .mockResolvedValueOnce({ rows: [] })                                 // INSERT refunds
        .mockResolvedValueOnce({ rows: [] })                                 // UPDATE orders
        .mockResolvedValueOnce(undefined),                                   // COMMIT
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);

    const res = await request(app)
      .post("/orders/5/delete")
      .set(auth(adminToken))
      .send({ reason: "Customer cancelled", idempotencyKey: "del-idem-001" });

    expect(res.status).toBe(200);
  });

  test("returns 403 for STAFF trying to delete", async () => {
    const res = await request(app)
      .post("/orders/5/delete")
      .set(auth(staffToken))
      .send({ reason: "test" });

    expect(res.status).toBe(403);
  });
});
