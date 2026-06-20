import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");

const pool = require("../../src/config/db.js").default;
import rosterRouter from "../../src/routes/roster.js";

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
  req.businessDayId = 10;
  next();
});
app.use("/roster", rosterRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

// Today's date string for shift mocks — must use LOCAL date so the window check
// (which parses "YYY-MM-DDTHH:MM:SS" as local time) stays in range regardless of timezone.
const _now = new Date();
const TODAY = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;

beforeEach(() => {
  pool.query.mockReset();
  pool.connect = jest.fn();
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /roster  —  shift list with weekly hours
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /roster", () => {
  test("returns shifts merged with weekly hours", async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, date: "2026-05-26", shift_start: "09:00:00", shift_end: "17:00:00", staff: [{ id: 2, name: "Bob" }] }],
      }) // shifts
      .mockResolvedValueOnce({
        rows: [{ id: 2, name: "Bob", weekly_hours: "8" }],
      }); // hours

    const res = await request(app)
      .get("/roster")
      .query({ start: "2026-05-26", end: "2026-06-01" })
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe(1);
    expect(res.body[0].staff[0].weekly_hours).toBe(8);
  });

  test("returns 400 when start or end is missing", async () => {
    const res = await request(app)
      .get("/roster")
      .query({ start: "2026-05-26" })
      .set(auth(adminToken));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/start & end required/i);
  });

  test("STAFF can also access the roster", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get("/roster")
      .query({ start: "2026-05-26", end: "2026-06-01" })
      .set(auth(staffToken));
    expect(res.status).toBe(200);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/roster").query({ start: "2026-05-26", end: "2026-06-01" });
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /roster  —  create shift
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /roster", () => {
  const validPayload = {
    date: "2026-05-26",
    shift_start: "09:00",
    shift_end: "17:00",
    staff_ids: [2],
  };

  const makeCreateClient = () => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 2 }] }) // staff check
      .mockResolvedValueOnce({ rows: [] }) // overlap check
      .mockResolvedValueOnce({ rows: [{ id: 10, date: "2026-05-26", shift_start: "09:00", shift_end: "17:00", restaurant_id: 1 }] }) // INSERT shift
      .mockResolvedValueOnce({ rows: [] }) // INSERT assignment
      .mockResolvedValue(undefined), // COMMIT
    release: jest.fn(),
  });

  test("admin creates a shift (returns 201)", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeCreateClient());
    const res = await request(app)
      .post("/roster")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(10);
  });

  test("returns 400 when date or times are missing", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeCreateClient());
    const res = await request(app)
      .post("/roster")
      .set(auth(adminToken))
      .send({ date: "2026-05-26", shift_start: "09:00" }); // missing shift_end
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/missing shift details/i);
  });

  test("returns 400 when staff_ids is empty", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeCreateClient());
    const res = await request(app)
      .post("/roster")
      .set(auth(adminToken))
      .send({ ...validPayload, staff_ids: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least one staff/i);
  });

  test("returns 400 when shift_start >= shift_end", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeCreateClient());
    const res = await request(app)
      .post("/roster")
      .set(auth(adminToken))
      .send({ ...validPayload, shift_start: "17:00", shift_end: "09:00" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid shift timing/i);
  });

  test("returns 400 when staff doesn't belong to restaurant", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // staff check returns empty (not found)
        .mockResolvedValue(undefined), // ROLLBACK
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(client);
    const res = await request(app)
      .post("/roster")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid staff selection/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).post("/roster").set(auth(staffToken)).send(validPayload);
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/roster").send(validPayload);
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /roster/pay-types
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /roster/pay-types", () => {
  test("returns list of pay types for admin", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: "Weekday", base_rate: "25.00" }],
    });
    const res = await request(app).get("/roster/pay-types").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe("Weekday");
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).get("/roster/pay-types").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/roster/pay-types");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /roster/pay-types
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /roster/pay-types", () => {
  test("admin creates pay type (returns 201)", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 5, name: "Weekend", base_rate: "35.00", restaurant_id: 1 }],
    });
    const res = await request(app)
      .post("/roster/pay-types")
      .set(auth(adminToken))
      .send({ name: "Weekend", base_rate: 35 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Weekend");
  });

  test("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/roster/pay-types")
      .set(auth(adminToken))
      .send({ base_rate: 25 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name required/i);
  });

  test("returns 400 when base_rate is missing or zero", async () => {
    const res = await request(app)
      .post("/roster/pay-types")
      .set(auth(adminToken))
      .send({ name: "Test", base_rate: 0 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/base rate required/i);
  });

  test("returns 409 for duplicate pay type name", async () => {
    pool.query.mockRejectedValueOnce({ code: "23505" });
    const res = await request(app)
      .post("/roster/pay-types")
      .set(auth(adminToken))
      .send({ name: "Weekday", base_rate: 25 });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .post("/roster/pay-types")
      .set(auth(staffToken))
      .send({ name: "Test", base_rate: 20 });
    expect(res.status).toBe(403);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// PUT /roster/pay-types/:id
// ────────────────────────────────────────────────────────────────────────────────

describe("PUT /roster/pay-types/:id", () => {
  test("admin updates pay type", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, name: "Weekday Updated", base_rate: "27.50" }],
    });
    const res = await request(app)
      .put("/roster/pay-types/1")
      .set(auth(adminToken))
      .send({ name: "Weekday Updated", base_rate: 27.5 });
    expect(res.status).toBe(200);
    expect(res.body.base_rate).toBe("27.50");
  });

  test("returns 404 when pay type not found", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put("/roster/pay-types/999")
      .set(auth(adminToken))
      .send({ name: "X", base_rate: 20 });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .put("/roster/pay-types/1")
      .set(auth(staffToken))
      .send({ name: "X", base_rate: 20 });
    expect(res.status).toBe(403);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// DELETE /roster/pay-types/:id
// ────────────────────────────────────────────────────────────────────────────────

describe("DELETE /roster/pay-types/:id", () => {
  test("admin deletes pay type and returns success", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .delete("/roster/pay-types/1")
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).delete("/roster/pay-types/1").set(auth(staffToken));
    expect(res.status).toBe(403);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /roster/my-status
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /roster/my-status", () => {
  test("returns clocked_in:true when open log exists", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 5, clock_in: "2026-05-28T08:00:00Z", shift_start: "08:00:00", shift_end: "17:00:00", date: "2026-05-28" }],
    });
    const res = await request(app).get("/roster/my-status").set(auth(staffToken));
    expect(res.status).toBe(200);
    expect(res.body.clocked_in).toBe(true);
    expect(res.body.log.id).toBe(5);
  });

  test("returns clocked_in:false when no open log", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/roster/my-status").set(auth(staffToken));
    expect(res.status).toBe(200);
    expect(res.body.clocked_in).toBe(false);
    expect(res.body.log).toBeNull();
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/roster/my-status");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /roster/my-shifts
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /roster/my-shifts", () => {
  test("returns upcoming shifts for staff member", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 3, date: "2026-06-01", shift_start: "09:00:00", shift_end: "17:00:00" }],
    });
    const res = await request(app).get("/roster/my-shifts").set(auth(staffToken));
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe(3);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/roster/my-shifts");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /roster/clock-in
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /roster/clock-in", () => {
  // Shift with today's date and wide time window so now falls in valid range
  const todayShift = {
    id: 1, date: TODAY, shift_start: "00:00:00", shift_end: "23:59:59", restaurant_id: 1,
  };

  const makeClockInClient = () => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [todayShift] }) // find shifts for today
      .mockResolvedValueOnce({ rows: [] }) // double clock-in check (not clocked in yet)
      .mockResolvedValueOnce({ rows: [] }) // previous open shift (none)
      .mockResolvedValueOnce({ rows: [{ id: 7, shift_id: 1, clock_in: new Date().toISOString() }] }) // INSERT log
      .mockResolvedValue(undefined), // COMMIT
    release: jest.fn(),
  });

  test("clocks in successfully when shift found and not already clocked in", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeClockInClient());
    const res = await request(app)
      .post("/roster/clock-in")
      .set(auth(staffToken))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/clock-in successful/i);
    expect(res.body.log.id).toBe(7);
  });

  test("returns 400 when no shift assigned today", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // no shifts
        .mockResolvedValue(undefined), // ROLLBACK
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(client);
    const res = await request(app).post("/roster/clock-in").set(auth(staffToken)).send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no shift assigned today/i);
  });

  test("returns 400 when already clocked in", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [todayShift] }) // shift found
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] }) // already clocked in
        .mockResolvedValue(undefined), // ROLLBACK
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(client);
    const res = await request(app).post("/roster/clock-in").set(auth(staffToken)).send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already clocked in/i);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/roster/clock-in").send({});
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /roster/clock-out
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /roster/clock-out", () => {
  const makeClockOutClient = () => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rows: [{
          id: 5,
          clock_in: new Date(Date.now() - 3600 * 1000).toISOString(), // 1hr ago
          shift_start: "00:00:00", shift_end: "23:59:00", date: TODAY, base_rate: "25.00",
        }],
      }) // find active log
      .mockResolvedValueOnce({ rows: [] }) // UPDATE log
      .mockResolvedValue(undefined), // COMMIT
    release: jest.fn(),
  });

  test("clocks out successfully and returns hours worked", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeClockOutClient());
    const res = await request(app).post("/roster/clock-out").set(auth(staffToken)).send({});
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/clock-out successful/i);
    expect(res.body.actualHours).toBeGreaterThan(0);
  });

  test("returns 400 when no active shift found", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // no active log
        .mockResolvedValue(undefined), // ROLLBACK
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(client);
    const res = await request(app).post("/roster/clock-out").set(auth(staffToken)).send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no active shift found/i);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/roster/clock-out").send({});
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /roster/overview  —  admin live staff overview
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /roster/overview", () => {
  test("returns categorised staff (working, late, absent, upcoming)", async () => {
    const now = new Date();
    const pastStart = new Date(now.getTime() - 30 * 60000); // 30min ago
    const futureStart = new Date(now.getTime() + 60 * 60000); // 1hr from now

    pool.query.mockResolvedValueOnce({
      rows: [
        // Working: clocked in, no clock out
        { shift_id: 1, date: TODAY, shift_start: pastStart.toTimeString().slice(0, 8), shift_end: "23:59:00", id: 2, staff_id: 2, name: "Alice", clock_in: pastStart.toISOString(), clock_out: null },
        // Upcoming: starts in future, not clocked in
        { shift_id: 2, date: TODAY, shift_start: futureStart.toTimeString().slice(0, 8), shift_end: "23:59:00", id: 3, staff_id: 3, name: "Bob", clock_in: null, clock_out: null },
      ],
    });

    const res = await request(app).get("/roster/overview").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.working)).toBe(true);
    expect(Array.isArray(res.body.upcoming)).toBe(true);
    expect(res.body.working[0].name).toBe("Alice");
    expect(res.body.totalActive).toBe(1);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).get("/roster/overview").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/roster/overview");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /roster/shifts  —  admin shift list with clock data
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /roster/shifts", () => {
  test("returns shift data with calculated hours", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ shift_id: 1, date: "2026-05-26", shift_start: "09:00:00", shift_end: "17:00:00", staff_id: 2, name: "Bob", clock_in: null, clock_out: null, actual_hours: null, base_rate: "25.00" }],
    });
    const res = await request(app)
      .get("/roster/shifts")
      .query({ start: "2026-05-26", end: "2026-06-01" })
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body[0].hours).toBe(8);
  });

  test("returns 400 when start or end is missing", async () => {
    const res = await request(app)
      .get("/roster/shifts")
      .query({ start: "2026-05-26" })
      .set(auth(adminToken));
    expect(res.status).toBe(400);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .get("/roster/shifts")
      .query({ start: "2026-05-26", end: "2026-06-01" })
      .set(auth(staffToken));
    expect(res.status).toBe(403);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /roster/send-to-xero  —  AUD-only payroll batch
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /roster/send-to-xero", () => {
  const validPayload = {
    shifts: [{ shift_id: 1, staff_id: 2, hours: 8 }],
  };

  test("returns 403 for non-AUD restaurants", async () => {
    // Create a separate app with INR settings for this test
    const inrApp = express();
    inrApp.use(express.json());
    inrApp.use((req, _res, next) => {
      req.log = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
      req.settings = { currency: { code: "INR" } };
      req.businessDayId = 10;
      next();
    });
    inrApp.use("/roster", rosterRouter);
    inrApp.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

    const res = await request(inrApp)
      .post("/roster/send-to-xero")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/AUD/i);
  });

  test("returns 400 when shifts array is empty (AUD)", async () => {
    const client = { query: jest.fn().mockResolvedValue(undefined), release: jest.fn() };
    pool.connect = jest.fn().mockResolvedValue(client);
    const res = await request(app)
      .post("/roster/send-to-xero")
      .set(auth(adminToken))
      .send({ shifts: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no shifts provided/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .post("/roster/send-to-xero")
      .set(auth(staffToken))
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/roster/send-to-xero").send(validPayload);
    expect(res.status).toBe(401);
  });

  test("creates payroll batch for valid AUD shifts", async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 50, id: 50 }] }) // INSERT batch
        .mockResolvedValueOnce({ rows: [{ paid: "0" }] }) // already paid check
        .mockResolvedValueOnce({ rows: [] }) // INSERT entry
        .mockResolvedValueOnce({ rows: [] }) // UPDATE batch status
        .mockResolvedValue(undefined), // COMMIT
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(mockClient);
    const res = await request(app)
      .post("/roster/send-to-xero")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/payroll batch prepared/i);
    expect(res.body.batch_id).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /roster/logs
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /roster/logs", () => {
  test("returns shift logs for date range", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ name: "Bob", date: "2026-05-26", clock_in: "2026-05-26T09:00:00Z", clock_out: "2026-05-26T17:00:00Z" }],
    });
    const res = await request(app)
      .get("/roster/logs")
      .query({ start: "2026-05-26", end: "2026-06-01" })
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe("Bob");
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .get("/roster/logs")
      .query({ start: "2026-05-26", end: "2026-06-01" })
      .set(auth(staffToken));
    expect(res.status).toBe(403);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /roster/copy  —  copy shifts to another date
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /roster/copy", () => {
  test("copies shifts and assignments to target date", async () => {
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, shift_start: "09:00:00", shift_end: "17:00:00", pay_type_id: null, base_rate: "0" }] }) // SELECT source
        .mockResolvedValueOnce({ rows: [{ id: 20 }] }) // INSERT new shift
        .mockResolvedValueOnce({ rows: [{ staff_id: 2 }] }) // SELECT staff assignments
        .mockResolvedValueOnce({ rows: [] }) // INSERT staff assignment
        .mockResolvedValue(undefined), // COMMIT
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(mockClient);

    const res = await request(app)
      .post("/roster/copy")
      .set(auth(adminToken))
      .send({ from_date: "2026-05-26", to_date: "2026-06-02" });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/copied successfully/i);
  });

  test("returns 400 when from_date or to_date is missing", async () => {
    const client = {
      query: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(client);
    const res = await request(app)
      .post("/roster/copy")
      .set(auth(adminToken))
      .send({ from_date: "2026-05-26" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .post("/roster/copy")
      .set(auth(staffToken))
      .send({ from_date: "2026-05-26", to_date: "2026-06-02" });
    expect(res.status).toBe(403);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// PUT /roster/:id  —  update shift
// ────────────────────────────────────────────────────────────────────────────────

describe("PUT /roster/:id", () => {
  const makeUpdateClient = ({ notFound = false } = {}) => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: notFound ? [] : [{ id: 1, date: "2026-05-26", shift_start: "09:00:00", shift_end: "17:00:00" }] }) // SELECT shift
      .mockResolvedValueOnce({ rows: [{ id: 1, date: "2026-05-26", shift_start: "10:00:00", shift_end: "18:00:00" }] }) // UPDATE shift
      .mockResolvedValue(undefined), // COMMIT
    release: jest.fn(),
  });

  test("admin updates shift timing (no staff_ids change)", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeUpdateClient());
    const res = await request(app)
      .put("/roster/1")
      .set(auth(adminToken))
      .send({ shift_start: "10:00:00", shift_end: "18:00:00" });
    expect(res.status).toBe(200);
  });

  test("returns 400 when shift not found", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeUpdateClient({ notFound: true }));
    const res = await request(app)
      .put("/roster/999")
      .set(auth(adminToken))
      .send({ shift_start: "10:00", shift_end: "18:00" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/shift not found/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .put("/roster/1")
      .set(auth(staffToken))
      .send({ shift_start: "10:00" });
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).put("/roster/1").send({ shift_start: "10:00" });
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// DELETE /roster/:id  —  soft delete shift
// ────────────────────────────────────────────────────────────────────────────────

describe("DELETE /roster/:id", () => {
  const makeDeleteClient = ({ notFound = false } = {}) => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: notFound ? [] : [{ id: 1 }] }) // SELECT shift FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }) // UPDATE is_deleted=TRUE
      .mockResolvedValue(undefined), // COMMIT
    release: jest.fn(),
  });

  test("admin soft-deletes a shift", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeDeleteClient());
    const res = await request(app).delete("/roster/1").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted successfully/i);
  });

  test("returns 400 when shift not found", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeDeleteClient({ notFound: true }));
    const res = await request(app).delete("/roster/999").set(auth(adminToken));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/shift not found/i);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).delete("/roster/1").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).delete("/roster/1");
    expect(res.status).toBe(401);
  });
});
