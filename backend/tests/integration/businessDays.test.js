import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");
jest.mock("../../src/utils/ledger.js", () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/services/whatsappService.js", () => ({
  sendWhatsAppTemplate: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/services/businessDayService.js", () => ({
  closeBusinessDay: jest.fn().mockResolvedValue({ closing_cash: 5000 }),
  getDaySummary: jest.fn().mockResolvedValue({}),
}));
jest.mock("../../src/utils/email.js", () => ({
  sendDiscrepancyEmail: jest.fn().mockResolvedValue(undefined),
}));

const pool = require("../../src/config/db.js").default;
import businessDaysRouter from "../../src/routes/businessDays.js";

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
app.use("/business-days", businessDaysRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

describe("GET /business-days/current", () => {
  test("returns current business day for authenticated user", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, is_closed: false, restaurant_id: 1, created_at: new Date().toISOString() }],
    });
    const res = await request(app).get("/business-days/current").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
  });

  test("returns 204 when no business day is open", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/business-days/current").set(auth(adminToken));
    expect(res.status).toBe(204);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/business-days/current");
    expect(res.status).toBe(401);
  });

  test("STAFF can view current business day", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 2, is_closed: false }] });
    const res = await request(app).get("/business-days/current").set(auth(staffToken));
    expect(res.status).toBe(200);
  });
});

describe("POST /business-days/start", () => {
  const validPayload = { denominations: [{ note: 500, qty: 2 }] };

  const mockClientFactory = ({ existingDay = null } = {}) => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                                   // BEGIN
      .mockResolvedValueOnce({ rows: existingDay ? [existingDay] : [] })  // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 1, opening_cash: 1000 }] })   // INSERT business_days
      .mockResolvedValueOnce({ rows: [] })                                 // INSERT denominations
      .mockResolvedValueOnce({ rows: [{ name: "Admin" }] })               // SELECT user name
      .mockResolvedValue(undefined),                                       // COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(mockClientFactory());
  });

  test("admin can open a business day (returns 201)", async () => {
    const res = await request(app)
      .post("/business-days/start")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(201);
  });

  test("returns 400 if a business day is already open", async () => {
    pool.connect.mockResolvedValue(
      mockClientFactory({ existingDay: { id: 5 } })
    );
    const res = await request(app)
      .post("/business-days/start")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("already open");
  });

  test("returns 400 for invalid denominations format", async () => {
    const res = await request(app)
      .post("/business-days/start")
      .set(auth(adminToken))
      .send({ denominations: "not-an-array" });
    expect(res.status).toBe(400);
  });

  test("returns 403 for STAFF role", async () => {
    const res = await request(app)
      .post("/business-days/start")
      .set(auth(staffToken))
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/business-days/start").send(validPayload);
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /business-days/close  (bottom line test — end-of-day settlement)
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /business-days/close", () => {
  const validClose = {
    breakdown: [{ note: 500, qty: 4 }],
    total: 2000,
    reason: "End of day",
  };

  const { closeBusinessDay, getDaySummary } = require("../../src/services/businessDayService.js");

  const makeCloseClient = () => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                    // BEGIN
      .mockResolvedValueOnce({ rows: [{ name: "Admin" }] }) // SELECT user name
      .mockResolvedValue(undefined),                        // COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    closeBusinessDay.mockResolvedValue({
      businessDayId: 1,
      expectedCash: 2100,
      difference: -100,
      hasDiscrepancy: true,
    });
    getDaySummary.mockResolvedValue({
      cashSales: 2000, upiSales: 500, expenses: 200,
    });
    pool.connect = jest.fn().mockResolvedValue(makeCloseClient());
  });

  test("admin can close a business day (returns 200)", async () => {
    const res = await request(app)
      .post("/business-days/close")
      .set(auth(adminToken))
      .send(validClose);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/closed/i);
    expect(res.body).toHaveProperty("expectedCash");
    expect(res.body).toHaveProperty("difference");
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .post("/business-days/close")
      .set(auth(staffToken))
      .send(validClose);
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/business-days/close").send(validClose);
    expect(res.status).toBe(401);
  });

  test("returns 400 when breakdown is missing", async () => {
    const res = await request(app)
      .post("/business-days/close")
      .set(auth(adminToken))
      .send({ total: 2000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid closing/i);
  });

  test("returns 400 when total is NaN", async () => {
    const res = await request(app)
      .post("/business-days/close")
      .set(auth(adminToken))
      .send({ breakdown: [{ note: 500, qty: 1 }], total: "bad" });
    expect(res.status).toBe(400);
  });

  test("returns 400 when closeBusinessDay service throws (no open day)", async () => {
    closeBusinessDay.mockRejectedValueOnce(Object.assign(new Error("No open business day"), { status: 400 }));
    const res = await request(app)
      .post("/business-days/close")
      .set(auth(adminToken))
      .send(validClose);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no open/i);
  });
});
