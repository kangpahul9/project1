import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");
jest.mock("../../src/middleware/attachBusinessDay.js", () => ({
  attachBusinessDay: jest.fn((req, _res, next) => { req.businessDayId = 10; next(); }),
}));
jest.mock("../../src/middleware/loadSettings.js", () => ({
  loadSettings: jest.fn((req, _res, next) => {
    req.settings = { use_business_day: false, currency: { code: "INR" } };
    next();
  }),
}));

const pool = require("../../src/config/db.js").default;
import reportsRouter from "../../src/routes/reports.js";

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
  next();
});
app.use("/reports", reportsRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

// A "zero row" that satisfies every field access any report route might do on rows[0]
const zeroRow = {
  total_orders: "0", total_sales: "0", paid_orders: "0", unpaid_orders: "0",
  total_credit_given: "0", total_outstanding: "0",
  total_cash: "0", total_online: "0", total_cash_refund: "0", total_bank_refund: "0",
  cash_refund: "0", bank_refund: "0", refunds: "0",
  total_expenses: "0", total: "0", paid: "0", balance: "0",
  // weekly/monthly .map() rows need a real Date for .toISOString()
  date: new Date(), label: "01 Jan",
};

beforeEach(() => {
  pool.query.mockResolvedValue({ rows: [zeroRow] });
});

describe("GET /reports — authentication & authorization", () => {
  test("GET /reports/daily returns 401 without token", async () => {
    const res = await request(app).get("/reports/daily");
    expect(res.status).toBe(401);
  });

  test("GET /reports/daily returns 403 for STAFF", async () => {
    const res = await request(app).get("/reports/daily").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("GET /reports/weekly returns 403 for STAFF", async () => {
    const res = await request(app).get("/reports/weekly").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("GET /reports/top-products returns 403 for STAFF", async () => {
    const res = await request(app).get("/reports/top-products").set(auth(staffToken));
    expect(res.status).toBe(403);
  });
});

describe("GET /reports — admin access", () => {
  test("GET /reports/daily returns 200 for admin with date param", async () => {
    const res = await request(app)
      .get("/reports/daily")
      .query({ date: "2026-05-01" })
      .set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  test("GET /reports/weekly returns 200 for admin", async () => {
    const res = await request(app).get("/reports/weekly").set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  test("GET /reports/weekly-summary returns 200 for admin", async () => {
    const res = await request(app).get("/reports/weekly-summary").set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  test("GET /reports/monthly returns 200 for admin", async () => {
    const res = await request(app).get("/reports/monthly").set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  test("GET /reports/monthly-summary returns 200 for admin", async () => {
    const res = await request(app).get("/reports/monthly-summary").set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  test("GET /reports/top-products returns 200 for admin", async () => {
    const res = await request(app).get("/reports/top-products").set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  test("GET /reports/hourly returns 200 for admin", async () => {
    const res = await request(app).get("/reports/hourly").set(auth(adminToken));
    expect(res.status).toBe(200);
  });
});
