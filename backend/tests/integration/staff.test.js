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
import staffRouter from "../../src/routes/staff.js";

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
app.use("/staff", staffRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

const mockStaff = { id: 1, name: "Alice", email: "alice@test.com", role: "STAFF", salary: 3000, is_active: true };

describe("GET /staff", () => {
  test("returns staff list for authenticated user", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockStaff] });
    const res = await request(app).get("/staff").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("STAFF can view staff list", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockStaff] });
    const res = await request(app).get("/staff").set(auth(staffToken));
    expect(res.status).toBe(200);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/staff");
    expect(res.status).toBe(401);
  });
});

describe("POST /staff — create staff member", () => {
  const validStaff = {
    name: "Bob",
    email: "bob@test.com",
    password: "securepass123",
    role: "STAFF",
    salary: 2500,
  };

  const mockClientFactory = ({ duplicateEmail = false } = {}) => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                                             // BEGIN
      .mockResolvedValueOnce({ rows: duplicateEmail ? [{ id: 99 }] : [] })         // SELECT email check
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })                               // INSERT users
      .mockResolvedValueOnce({ rows: [mockStaff] })                                // INSERT staff
      .mockResolvedValue(undefined),                                                // COMMIT + extras
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(mockClientFactory());
  });

  test("admin creates a staff member successfully", async () => {
    const res = await request(app)
      .post("/staff")
      .set(auth(adminToken))
      .send(validStaff);
    expect(res.status).toBe(201);
  });

  test("returns 403 for STAFF role", async () => {
    const res = await request(app)
      .post("/staff")
      .set(auth(staffToken))
      .send(validStaff);
    expect(res.status).toBe(403);
  });

  test("returns 400 for duplicate email", async () => {
    pool.connect.mockResolvedValue(mockClientFactory({ duplicateEmail: true }));
    const res = await request(app)
      .post("/staff")
      .set(auth(adminToken))
      .send(validStaff);
    expect(res.status).toBe(400);
  });

  test("returns 400 for missing name", async () => {
    const res = await request(app)
      .post("/staff")
      .set(auth(adminToken))
      .send({ ...validStaff, name: undefined });
    expect(res.status).toBe(400);
  });

  test("returns 400 for missing email", async () => {
    const res = await request(app)
      .post("/staff")
      .set(auth(adminToken))
      .send({ ...validStaff, email: undefined });
    expect(res.status).toBe(400);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/staff").send(validStaff);
    expect(res.status).toBe(401);
  });
});

describe("DELETE /staff/:id", () => {
  test("admin can delete staff", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)                      // BEGIN
        .mockResolvedValueOnce({ rows: [{ user_id: 10 }] })   // SELECT staff user_id
        .mockResolvedValueOnce({ rows: [] })                   // UPDATE staff is_active
        .mockResolvedValueOnce({ rows: [] })                   // UPDATE users is_active
        .mockResolvedValue(undefined),                         // COMMIT
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(client);

    const res = await request(app).delete("/staff/1").set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).delete("/staff/1").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).delete("/staff/1");
    expect(res.status).toBe(401);
  });
});

describe("GET /staff/summary", () => {
  test("admin can get staff salary summary", async () => {
    // summary route makes 3 separate pool.query calls
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: "9000" }] })   // total salary
      .mockResolvedValueOnce({ rows: [{ paid: "1000" }] })     // paid this month
      .mockResolvedValueOnce({ rows: [{ balance: "0" }] })     // outstanding balance
      .mockResolvedValueOnce({ rows: [{ total: "0" }] });      // pending advances
    const res = await request(app).get("/staff/summary").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.totalSalary).toBe(9000);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).get("/staff/summary").set(auth(staffToken));
    expect(res.status).toBe(403);
  });
});
