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

const pool = require("../../src/config/db.js").default;
import vendorsRouter from "../../src/routes/vendors.js";

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
app.use("/vendors", vendorsRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

const mockVendor = { id: 1, name: "Wholesale Co", phone: "0400111222", is_active: true, restaurant_id: 1 };

// Reset pool.query mock between tests to prevent Once-queue pollution
beforeEach(() => pool.query.mockReset());

describe("GET /vendors", () => {
  test("returns vendor list for authenticated user", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockVendor] });
    const res = await request(app).get("/vendors").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe("Wholesale Co");
  });

  test("STAFF can also view vendors", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockVendor] });
    const res = await request(app).get("/vendors").set(auth(staffToken));
    expect(res.status).toBe(200);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/vendors");
    expect(res.status).toBe(401);
  });
});

describe("POST /vendors — create vendor", () => {
  const validVendor = { name: "Wholesale Co", phone: "0400111222" };

  test("admin creates a vendor successfully (returns 201)", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })           // no duplicate
      .mockResolvedValueOnce({ rows: [mockVendor] }); // INSERT
    const res = await request(app)
      .post("/vendors")
      .set(auth(adminToken))
      .send(validVendor);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Wholesale Co");
  });

  test("returns 403 for STAFF role", async () => {
    const res = await request(app)
      .post("/vendors")
      .set(auth(staffToken))
      .send(validVendor);
    expect(res.status).toBe(403);
  });

  test("returns 400 for duplicate vendor name", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockVendor] }); // duplicate found
    const res = await request(app)
      .post("/vendors")
      .set(auth(adminToken))
      .send(validVendor);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("already exists");
  });

  test("returns 400 for missing name", async () => {
    const res = await request(app)
      .post("/vendors")
      .set(auth(adminToken))
      .send({ phone: "0400111222" });
    expect(res.status).toBe(400);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/vendors").send(validVendor);
    expect(res.status).toBe(401);
  });
});

describe("DELETE /vendors/:id", () => {
  test("admin can soft-delete a vendor", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await request(app).delete("/vendors/1").set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).delete("/vendors/1").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).delete("/vendors/1");
    expect(res.status).toBe(401);
  });
});
