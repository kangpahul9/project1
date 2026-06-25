import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");
jest.mock("../../src/utils/ledger.js", () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/middleware/attachBusinessDay.js", () => ({
  attachBusinessDay: jest.fn((req, _res, next) => { req.businessDayId = 10; next(); }),
}));
jest.mock("../../src/middleware/loadSettings.js", () => ({
  loadSettings: jest.fn((req, _res, next) => {
    req.settings = { use_business_day: true, currency: { code: "INR" } };
    next();
  }),
}));

const pool = require("../../src/config/db.js").default;
import withdrawalsRouter from "../../src/routes/withdrawals.js";

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
app.use("/withdrawals", withdrawalsRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

describe("POST /withdrawals", () => {
  const validWithdrawal = {
    breakdown: [{ note: 500, qty: 1 }],
    reason: "Owner Personal",
  };

  const mockClientFactory = ({ hasFunds = true } = {}) => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)  // BEGIN
      .mockResolvedValueOnce({           // SELECT denominations FOR UPDATE
        rows: hasFunds ? [{ note_value: 500, quantity: 5 }] : [],
      })
      .mockResolvedValueOnce({ rows: [] })              // UPDATE denominations
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })    // INSERT cash_withdrawals
      .mockResolvedValue({ rows: [] }),                 // any INSERT expenses + COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(mockClientFactory());
  });

  test("admin can withdraw cash successfully", async () => {
    const res = await request(app)
      .post("/withdrawals")
      .set(auth(adminToken))
      .send(validWithdrawal);
    expect(res.status).toBe(200);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .post("/withdrawals")
      .set(auth(staffToken))
      .send(validWithdrawal);
    expect(res.status).toBe(403);
  });

  test("rejects missing breakdown", async () => {
    const res = await request(app)
      .post("/withdrawals")
      .set(auth(adminToken))
      .send({ reason: "Owner Personal" });
    expect(res.status).toBe(400);
  });

  test("rejects missing reason", async () => {
    const res = await request(app)
      .post("/withdrawals")
      .set(auth(adminToken))
      .send({ breakdown: [{ note: 500, qty: 1 }] });
    expect(res.status).toBe(400);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/withdrawals").send(validWithdrawal);
    expect(res.status).toBe(401);
  });
});

describe("GET /withdrawals/history", () => {
  test("returns withdrawal history for admin", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, amount: 500, reason: "Owner Personal" }],
    });
    const res = await request(app).get("/withdrawals/history").set(auth(adminToken));
    expect(res.status).toBe(200);
    // route returns { data: [], pagination: {} } (not a bare array)
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].amount).toBe(500);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).get("/withdrawals/history").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/withdrawals/history");
    expect(res.status).toBe(401);
  });
});

describe("POST /withdrawals/deposit", () => {
  test("admin can deposit cash", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)              // BEGIN
        .mockResolvedValueOnce({ rows: [] })           // INSERT denominations (upsert)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT cash_deposits
        .mockResolvedValue(undefined),                 // COMMIT
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(client);

    const res = await request(app)
      .post("/withdrawals/deposit")
      .set(auth(adminToken))
      .send({ breakdown: [{ note: 500, qty: 2 }], reason: "Bank Deposit" });
    expect(res.status).toBe(200);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .post("/withdrawals/deposit")
      .set(auth(staffToken))
      .send({ breakdown: [{ note: 500, qty: 2 }], reason: "Bank Deposit" });
    expect(res.status).toBe(403);
  });
});
