import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");

const pool = require("../../src/config/db.js").default;
import payrollRouter from "../../src/routes/payroll.js";

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
  req.settings = { use_business_day: false, currency: { code: "INR" } };
  req.businessDayId = 10;
  next();
});
app.use("/payroll", payrollRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

beforeEach(() => pool.query.mockReset());

// ────────────────────────────────────────────────────────────────────────────────
// GET /payroll — summary with date range
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /payroll", () => {
  const mockShift = {
    shift_id: 1, date: "2026-05-01",
    shift_start: "09:00:00", shift_end: "17:00:00",
    pay_type_id: null, staff_id: 2, staff_name: "Bob",
    pay_type_name: null, base_rate: null,
    weekday_rate: null, weekend_rate: null, holiday_rate: null,
    actual_hours: null, clock_in: null, clock_out: null,
  };

  test("admin gets payroll summary for date range", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [mockShift] }) // shifts query
      .mockResolvedValueOnce({ rows: [] });           // paid amounts query

    const res = await request(app)
      .get("/payroll")
      .query({ start: "2026-05-01", end: "2026-05-31" })
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].staff_name).toBe("Bob");
  });

  test("returns 400 when start or end is missing", async () => {
    const res = await request(app)
      .get("/payroll")
      .query({ start: "2026-05-01" })
      .set(auth(adminToken));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/start & end required/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .get("/payroll")
      .query({ start: "2026-05-01", end: "2026-05-31" })
      .set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app)
      .get("/payroll")
      .query({ start: "2026-05-01", end: "2026-05-31" });
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /payroll/batches — payment history
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /payroll/batches", () => {
  test("admin gets list of payroll batches", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, status: "paid", payment_method: "cash", total_amount: "3000", entry_count: "2" }],
    });
    const res = await request(app).get("/payroll/batches").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe(1);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).get("/payroll/batches").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/payroll/batches");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /payroll/pay — record payment
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /payroll/pay", () => {
  const validPayload = {
    entries: [{ shift_id: 1, staff_id: 2, hours: 8, rate: 25, amount: 200 }],
    payment_method: "paid",
    notes: "Weekly pay",
  };

  const makePayClient = () => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)              // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // INSERT payroll_batches
      .mockResolvedValueOnce({ rows: [] })            // INSERT payroll_entries
      .mockResolvedValue(undefined),                  // COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(makePayClient());
  });

  test("admin records payroll payment successfully", async () => {
    const res = await request(app)
      .post("/payroll/pay")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/payment recorded/i);
    expect(res.body.batch_id).toBe(10);
    expect(res.body.entries_processed).toBe(1);
  });

  test("returns 400 when entries is empty", async () => {
    const res = await request(app)
      .post("/payroll/pay")
      .set(auth(adminToken))
      .send({ ...validPayload, entries: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no entries/i);
  });

  test("returns 400 for invalid payment method", async () => {
    const res = await request(app)
      .post("/payroll/pay")
      .set(auth(adminToken))
      .send({ ...validPayload, payment_method: "cheque" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid payment method/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .post("/payroll/pay")
      .set(auth(staffToken))
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/payroll/pay").send(validPayload);
    expect(res.status).toBe(401);
  });

  test("queues xero batch when payment_method is xero", async () => {
    const xeroClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: 20 }] }) // INSERT batch
        .mockResolvedValueOnce({ rows: [] })             // INSERT entries
        .mockResolvedValue(undefined),
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(xeroClient);
    const res = await request(app)
      .post("/payroll/pay")
      .set(auth(adminToken))
      .send({ ...validPayload, payment_method: "xero" });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/xero/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// PUT /payroll/pay-types/:id/rates
// ────────────────────────────────────────────────────────────────────────────────

describe("PUT /payroll/pay-types/:id/rates", () => {
  test("admin can update pay type rates", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, weekday_rate: "25.00", weekend_rate: "37.50" }],
    });
    const res = await request(app)
      .put("/payroll/pay-types/1/rates")
      .set(auth(adminToken))
      .send({ weekday_rate: 25, weekend_rate: 37.5 });
    expect(res.status).toBe(200);
    expect(res.body.weekday_rate).toBe("25.00");
  });

  test("returns 400 when pay type not found", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put("/payroll/pay-types/999/rates")
      .set(auth(adminToken))
      .send({ weekday_rate: 25 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not found/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .put("/payroll/pay-types/1/rates")
      .set(auth(staffToken))
      .send({ weekday_rate: 25 });
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).put("/payroll/pay-types/1/rates").send({ weekday_rate: 25 });
    expect(res.status).toBe(401);
  });
});
