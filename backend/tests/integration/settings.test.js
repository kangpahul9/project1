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
import settingsRouter from "../../src/routes/settings.js";

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
  next();
});
app.use("/settings", settingsRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

const mockSettings = {
  id: 1,
  restaurant_id: 1,
  currency_code: "INR",
  use_business_day: false,
  currency: { code: "INR", symbol: "₹", locale: "en-IN" },
};

describe("GET /settings", () => {
  test("returns settings for authenticated user", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockSettings] });
    const res = await request(app).get("/settings").set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  test("STAFF can view settings", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockSettings] });
    const res = await request(app).get("/settings").set(auth(staffToken));
    expect(res.status).toBe(200);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/settings");
    expect(res.status).toBe(401);
  });
});

describe("PUT /settings/currency", () => {
  test("admin can update currency to AUD", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...mockSettings, currency_code: "AUD" }] });
    const res = await request(app)
      .put("/settings/currency")
      .set(auth(adminToken))
      .send({ currency_code: "AUD" });
    expect(res.status).toBe(200);
  });

  test("rejects invalid currency code", async () => {
    const res = await request(app)
      .put("/settings/currency")
      .set(auth(adminToken))
      .send({ currency_code: "USD" });
    expect(res.status).toBe(400);
  });

  test("returns 401 without token", async () => {
    const res = await request(app)
      .put("/settings/currency")
      .send({ currency_code: "AUD" });
    expect(res.status).toBe(401);
  });
});

describe("GET /settings/bank-account", () => {
  test("returns bank account details for authenticated user", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, bank_name: "ANZ", account_number: "123456", ifsc: "ABCD0001" }],
    });
    const res = await request(app).get("/settings/bank-account").set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/settings/bank-account");
    expect(res.status).toBe(401);
  });
});
