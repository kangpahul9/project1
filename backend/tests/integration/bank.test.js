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
jest.mock("../../src/utils/cashUtils.js", () => ({
  deductCash: jest.fn().mockResolvedValue(undefined),
  addCash: jest.fn().mockResolvedValue(undefined),
}));
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
import bankRouter from "../../src/routes/bank.js";

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
app.use("/bank", bankRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

describe("GET /bank/balance", () => {
  test("returns balance for admin", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ balance: 5000 }] });
    const res = await request(app).get("/bank/balance").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(5000);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).get("/bank/balance").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/bank/balance");
    expect(res.status).toBe(401);
  });
});

describe("GET /bank/history", () => {
  test("returns transaction history for admin", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, amount: 1000, type: "credit", source: "owner_deposit" }],
    });
    const res = await request(app).get("/bank/history").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).get("/bank/history").set(auth(staffToken));
    expect(res.status).toBe(403);
  });
});

describe("POST /bank/transaction", () => {
  const validTxn = {
    amount: 1000,
    type: "credit",
    source: "owner_deposit",
    description: "Cash injection",
    idempotencyKey: "bank-001",
  };

  const mockClientFactory = () => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                  // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })     // SELECT bank_accounts
      .mockResolvedValue({ rows: [] }),                  // bankWithEvent + COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(mockClientFactory());
  });

  test("admin can record an owner deposit", async () => {
    const res = await request(app)
      .post("/bank/transaction")
      .set(auth(adminToken))
      .send(validTxn);
    expect(res.status).toBe(200);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .post("/bank/transaction")
      .set(auth(staffToken))
      .send(validTxn);
    expect(res.status).toBe(403);
  });

  test("returns 400 for invalid source", async () => {
    const res = await request(app)
      .post("/bank/transaction")
      .set(auth(adminToken))
      .send({ ...validTxn, source: "unknown_source", idempotencyKey: "bank-002" });
    expect(res.status).toBe(400);
  });

  test("requires idempotency key", async () => {
    const res = await request(app)
      .post("/bank/transaction")
      .set(auth(adminToken))
      .send({ ...validTxn, idempotencyKey: undefined });
    expect(res.status).toBe(400);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/bank/transaction").send(validTxn);
    expect(res.status).toBe(401);
  });
});
