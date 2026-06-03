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
import menuRouter from "../../src/routes/menu.js";

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
app.use("/menu", menuRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

const mockItem = { id: 1, name: "Burger", price: 150, is_active: true, restaurant_id: 1 };

describe("GET /menu", () => {
  test("returns menu list for authenticated user", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockItem] });
    const res = await request(app).get("/menu").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/menu");
    expect(res.status).toBe(401);
  });

  test("STAFF can view the menu", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockItem] });
    const res = await request(app).get("/menu").set(auth(staffToken));
    expect(res.status).toBe(200);
  });
});

describe("POST /menu — create menu item", () => {
  const validItem = {
    name: "Burger",
    price: 150,
    idempotencyKey: "menu-001",
  };

  const mockClientFactory = () => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)            // BEGIN
      .mockResolvedValueOnce({ rows: [] })         // idempotency check
      .mockResolvedValueOnce({ rows: [] })         // duplicate name check
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // category check (if any)
      .mockResolvedValueOnce({ rows: [mockItem] }) // INSERT menu
      .mockResolvedValue(undefined),               // COMMIT + extras
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(mockClientFactory());
  });

  test("creates menu item as admin", async () => {
    const res = await request(app)
      .post("/menu")
      .set(auth(adminToken))
      .send(validItem);
    expect(res.status).toBe(201);
  });

  test("returns 403 for STAFF role", async () => {
    const res = await request(app)
      .post("/menu")
      .set(auth(staffToken))
      .send(validItem);
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/menu").send(validItem);
    expect(res.status).toBe(401);
  });

  test("rejects missing name", async () => {
    const res = await request(app)
      .post("/menu")
      .set(auth(adminToken))
      .send({ ...validItem, name: undefined, idempotencyKey: "menu-002" });
    expect(res.status).toBe(400);
  });

  test("rejects missing price", async () => {
    const res = await request(app)
      .post("/menu")
      .set(auth(adminToken))
      .send({ ...validItem, price: undefined, idempotencyKey: "menu-003" });
    expect(res.status).toBe(400);
  });

  test("rejects missing idempotency key", async () => {
    const res = await request(app)
      .post("/menu")
      .set(auth(adminToken))
      .send({ name: "Burger", price: 150 });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /menu/:id", () => {
  test("admin can soft-delete a menu item", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const res = await request(app).delete("/menu/1").set(auth(adminToken));
    expect(res.status).toBe(200);
  });

  test("STAFF cannot delete menu items", async () => {
    const res = await request(app).delete("/menu/1").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).delete("/menu/1");
    expect(res.status).toBe(401);
  });
});
