import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

global.fetch = jest.fn();

jest.mock("../../src/config/db.js");

const pool = require("../../src/config/db.js").default;
import xeroRouter from "../../src/routes/xero.js";

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
  req.settings = { currency: { code: "AUD" } };
  next();
});
app.use("/xero", xeroRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

// A valid connected Xero connection row (expires far in the future so refresh is skipped)
const mockConn = {
  access_token: "access_abc",
  refresh_token: "refresh_abc",
  tenant_id: "tenant_xyz",
  tenant_name: "Test Org",
  connected_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
};

beforeEach(() => {
  pool.query.mockReset();
  // Default client — validation tests throw before any query, but finally still calls release
  const defaultClient = { query: jest.fn().mockResolvedValue(undefined), release: jest.fn() };
  pool.connect = jest.fn().mockResolvedValue(defaultClient);
  global.fetch.mockReset();
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /xero/connect
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /xero/connect", () => {
  test("returns OAuth URL when XERO_CLIENT_ID is set", async () => {
    const res = await request(app).get("/xero/connect").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/login\.xero\.com/);
    expect(res.body.url).toMatch(/client_id=/);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).get("/xero/connect").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/xero/connect");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /xero/status
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /xero/status", () => {
  test("returns connected:true when connection exists", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockConn] });
    const res = await request(app).get("/xero/status").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(res.body.tenant_name).toBe("Test Org");
  });

  test("returns connected:false when no connection row", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/xero/status").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).get("/xero/status").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/xero/status");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// DELETE /xero/disconnect
// ────────────────────────────────────────────────────────────────────────────────

describe("DELETE /xero/disconnect", () => {
  test("deletes connection and returns success message", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete("/xero/disconnect").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/disconnected/i);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM xero_connections"),
      expect.any(Array)
    );
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).delete("/xero/disconnect").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).delete("/xero/disconnect");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// PUT /xero/staff/:staffId/employee
// ────────────────────────────────────────────────────────────────────────────────

describe("PUT /xero/staff/:staffId/employee", () => {
  test("updates xero_employee_id for staff", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 5, name: "Alice", xero_employee_id: "EMP_XYZ" }],
    });
    const res = await request(app)
      .put("/xero/staff/5/employee")
      .set(auth(adminToken))
      .send({ xero_employee_id: "EMP_XYZ" });
    expect(res.status).toBe(200);
    expect(res.body.xero_employee_id).toBe("EMP_XYZ");
  });

  test("returns 400 when staff not found", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put("/xero/staff/999/employee")
      .set(auth(adminToken))
      .send({ xero_employee_id: "EMP_XYZ" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not found/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .put("/xero/staff/5/employee")
      .set(auth(staffToken))
      .send({ xero_employee_id: "EMP" });
    expect(res.status).toBe(403);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// PUT /xero/pay-types/:id/earnings-rate
// ────────────────────────────────────────────────────────────────────────────────

describe("PUT /xero/pay-types/:id/earnings-rate", () => {
  test("updates xero_earnings_rate_id for pay type", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 3, name: "Weekday", xero_earnings_rate_id: "EARN_123" }],
    });
    const res = await request(app)
      .put("/xero/pay-types/3/earnings-rate")
      .set(auth(adminToken))
      .send({ xero_earnings_rate_id: "EARN_123" });
    expect(res.status).toBe(200);
    expect(res.body.xero_earnings_rate_id).toBe("EARN_123");
  });

  test("returns 400 when pay type not found", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put("/xero/pay-types/999/earnings-rate")
      .set(auth(adminToken))
      .send({ xero_earnings_rate_id: "EARN" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not found/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /xero/employees
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /xero/employees", () => {
  test("returns mapped employee list from Xero API", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockConn] }); // getConnection
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Employees: [
          { EmployeeID: "EMP_001", FirstName: "John", LastName: "Doe" },
          { EmployeeID: "EMP_002", FirstName: "Jane", LastName: "Smith" },
        ],
      }),
    });

    const res = await request(app).get("/xero/employees").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe("EMP_001");
    expect(res.body[0].name).toBe("John Doe");
  });

  test("returns 400 when not connected to Xero", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // no connection
    const res = await request(app).get("/xero/employees").set(auth(adminToken));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not connected/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).get("/xero/employees").set(auth(staffToken));
    expect(res.status).toBe(403);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /xero/earnings-rates
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /xero/earnings-rates", () => {
  test("returns earnings rates list from Xero API", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockConn] });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        PayItems: {
          EarningsRates: [
            { EarningsRateID: "RATE_001", Name: "Ordinary Time" },
            { EarningsRateID: "RATE_002", Name: "Overtime" },
          ],
        },
      }),
    });

    const res = await request(app).get("/xero/earnings-rates").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe("RATE_001");
    expect(res.body[0].name).toBe("Ordinary Time");
  });

  test("returns empty array when no earnings rates", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockConn] });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ PayItems: {} }),
    });
    const res = await request(app).get("/xero/earnings-rates").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /xero/send-payroll — validation paths
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /xero/send-payroll — validation", () => {
  const validPayload = {
    entries: [{ shift_id: 1, staff_id: 2, hours: 8, rate: 25, amount: 200, pay_type_id: 3, date: "2026-05-26" }],
    pay_period_start: "2026-05-26",
    pay_period_end: "2026-06-01",
  };

  test("returns 400 when entries is empty", async () => {
    const res = await request(app)
      .post("/xero/send-payroll")
      .set(auth(adminToken))
      .send({ ...validPayload, entries: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no entries/i);
  });

  test("returns 400 when pay_period_start is missing", async () => {
    const res = await request(app)
      .post("/xero/send-payroll")
      .set(auth(adminToken))
      .send({ ...validPayload, pay_period_start: undefined });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/pay_period_start/i);
  });

  test("returns 400 when not connected to Xero", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // getConnection returns null
    const mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(mockClient);
    const res = await request(app)
      .post("/xero/send-payroll")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not connected/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .post("/xero/send-payroll")
      .set(auth(staffToken))
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/xero/send-payroll").send(validPayload);
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /xero/send-payroll — success path
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /xero/send-payroll — success", () => {
  const validPayload = {
    entries: [{ shift_id: 1, staff_id: 2, hours: 8, rate: 25, amount: 200, pay_type_id: 3, date: "2026-05-26" }],
    pay_period_start: "2026-05-26",
    pay_period_end: "2026-06-01",
  };

  test("sends timesheets to Xero and records payroll batch", async () => {
    // getConnection
    pool.query.mockResolvedValueOnce({ rows: [mockConn] });

    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ id: 2, name: "Bob", xero_employee_id: "EMP_001" }] }) // staff query
        .mockResolvedValueOnce({ rows: [{ id: 3, xero_earnings_rate_id: "RATE_001", base_rate: "25.00" }] }) // pay_types
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // INSERT batch
        .mockResolvedValueOnce({ rows: [] }) // INSERT entry
        .mockResolvedValue(undefined), // COMMIT
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(mockClient);

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Timesheets: [{ TimesheetID: "TS_001" }] }),
    });

    const res = await request(app)
      .post("/xero/send-payroll")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/xero/i);
    expect(Array.isArray(res.body.timesheet_ids)).toBe(true);
  });
});
