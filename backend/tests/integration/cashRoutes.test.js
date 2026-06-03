import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");
jest.mock("../../src/utils/denominationUtils.js", () => ({
  normalizeDenominations: jest.fn((m) => m),
  validateDenominations: jest.fn(),
}));

const pool = require("../../src/config/db.js").default;
import cashRouter from "../../src/routes/cash.js";

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
app.use("/cash", cashRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

beforeEach(() => pool.query.mockReset());

// ────────────────────────────────────────────────────────────────────────────────
// GET /cash/current
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /cash/current", () => {
  test("admin gets current drawer cash", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { note_value: "500", quantity: "2" },
        { note_value: "100", quantity: "3" },
      ],
    });
    const res = await request(app).get("/cash/current").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("breakdown");
    expect(Array.isArray(res.body.breakdown)).toBe(true);
    // 500*2 + 100*3 = 1300
    expect(res.body.total).toBe(1300);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).get("/cash/current").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/cash/current");
    expect(res.status).toBe(401);
  });

  test("returns total:0 when drawer is empty", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/cash/current").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.breakdown).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /cash/recount
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /cash/recount", () => {
  const validPayload = {
    breakdown: [{ note: 500, qty: 3 }, { note: 100, qty: 2 }],
    idempotencyKey: "recount_xyz789",
  };

  // Transaction sequence: BEGIN → idempotency check → SELECT FOR UPDATE (lock) →
  //   DELETE denominations → INSERT per denomination → INSERT cash_recounts → COMMIT
  const makeRecountClient = ({ duplicate = false } = {}) => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                                        // BEGIN
      .mockResolvedValueOnce({ rows: duplicate ? [{ id: 55 }] : [] })         // idempotency check
      .mockResolvedValueOnce({ rows: [] })                                     // SELECT FOR UPDATE (lock)
      .mockResolvedValueOnce({ rows: [] })                                     // DELETE denominations
      .mockResolvedValueOnce({ rows: [] })                                     // INSERT denom 1 (500)
      .mockResolvedValueOnce({ rows: [] })                                     // INSERT denom 2 (100)
      .mockResolvedValueOnce({ rows: [{ id: 99 }] })                           // INSERT cash_recounts
      .mockResolvedValue(undefined),                                            // COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(makeRecountClient());
  });

  test("admin can recount drawer cash successfully", async () => {
    const res = await request(app)
      .post("/cash/recount")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(1700); // 500*3 + 100*2
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .post("/cash/recount")
      .set(auth(staffToken))
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/cash/recount").send(validPayload);
    expect(res.status).toBe(401);
  });

  test("returns 400 when breakdown is missing", async () => {
    const res = await request(app)
      .post("/cash/recount")
      .set(auth(adminToken))
      .send({ idempotencyKey: "recount_xyz789" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/breakdown/i);
  });

  test("returns 400 when idempotencyKey is missing", async () => {
    const res = await request(app)
      .post("/cash/recount")
      .set(auth(adminToken))
      .send({ breakdown: [{ note: 500, qty: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/idempotency/i);
  });

  test("returns 400 when breakdown is empty array", async () => {
    const res = await request(app)
      .post("/cash/recount")
      .set(auth(adminToken))
      .send({ breakdown: [], idempotencyKey: "recount_abc" });
    expect(res.status).toBe(400);
  });

  test("returns 200 with 'Already processed' for duplicate idempotency key", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeRecountClient({ duplicate: true }));
    const res = await request(app)
      .post("/cash/recount")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Already processed");
  });
});
