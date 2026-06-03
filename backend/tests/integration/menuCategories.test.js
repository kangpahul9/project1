import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");

const pool = require("../../src/config/db.js").default;
import menuCategoriesRouter from "../../src/routes/menuCategories.js";

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
app.use("/menu-categories", menuCategoriesRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

const mockCategory = { id: 1, name: "Beverages", color: "#6366F1", sort_order: 0, is_active: true };

beforeEach(() => pool.query.mockReset());

// ────────────────────────────────────────────────────────────────────────────────
// GET /menu-categories
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /menu-categories", () => {
  test("admin can list categories", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockCategory] });
    const res = await request(app).get("/menu-categories").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe("Beverages");
  });

  test("STAFF can also list categories", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockCategory] });
    const res = await request(app).get("/menu-categories").set(auth(staffToken));
    expect(res.status).toBe(200);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/menu-categories");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /menu-categories
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /menu-categories", () => {
  const validCategory = { name: "Beverages", color: "#6366F1", sort_order: 0, idempotencyKey: "cat_abc123" };

  const makeCategoryClient = ({ duplicate = false, nameDuplicate = false } = {}) => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                                          // BEGIN
      .mockResolvedValueOnce({ rows: duplicate ? [{ id: 1 }] : [] })            // idempotency check
      .mockResolvedValueOnce({ rows: nameDuplicate ? [{ id: 2 }] : [] })        // duplicate name check
      .mockResolvedValueOnce({ rows: [mockCategory] })                           // INSERT
      .mockResolvedValue(undefined),                                             // COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(makeCategoryClient());
  });

  test("admin creates a category (returns 201)", async () => {
    const res = await request(app)
      .post("/menu-categories")
      .set(auth(adminToken))
      .send(validCategory);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Beverages");
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .post("/menu-categories")
      .set(auth(staffToken))
      .send(validCategory);
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/menu-categories").send(validCategory);
    expect(res.status).toBe(401);
  });

  test("returns 400 for missing name", async () => {
    const res = await request(app)
      .post("/menu-categories")
      .set(auth(adminToken))
      .send({ color: "#6366F1", idempotencyKey: "cat_abc123" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name required/i);
  });

  test("returns 400 for missing idempotencyKey", async () => {
    const res = await request(app)
      .post("/menu-categories")
      .set(auth(adminToken))
      .send({ name: "Beverages", color: "#6366F1" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/idempotency/i);
  });

  test("returns 200 'Already processed' for duplicate idempotency key", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeCategoryClient({ duplicate: true }));
    const res = await request(app)
      .post("/menu-categories")
      .set(auth(adminToken))
      .send(validCategory);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Already processed");
  });

  test("returns 400 for duplicate category name", async () => {
    pool.connect = jest.fn().mockResolvedValue(makeCategoryClient({ nameDuplicate: true }));
    const res = await request(app)
      .post("/menu-categories")
      .set(auth(adminToken))
      .send(validCategory);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// PUT /menu-categories/:id
// ────────────────────────────────────────────────────────────────────────────────

describe("PUT /menu-categories/:id", () => {
  test("admin can update a category", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [mockCategory] })   // SELECT existing
      .mockResolvedValueOnce({ rows: [] })                // duplicate name check (no dup)
      .mockResolvedValueOnce({ rows: [{ ...mockCategory, name: "Drinks" }] }); // UPDATE
    const res = await request(app)
      .put("/menu-categories/1")
      .set(auth(adminToken))
      .send({ name: "Drinks" });
    expect(res.status).toBe(200);
  });

  test("returns 404 when category not found", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // SELECT existing — not found
    const res = await request(app)
      .put("/menu-categories/999")
      .set(auth(adminToken))
      .send({ name: "Drinks" });
    expect(res.status).toBe(404);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .put("/menu-categories/1")
      .set(auth(staffToken))
      .send({ name: "Drinks" });
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).put("/menu-categories/1").send({ name: "Drinks" });
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// DELETE /menu-categories/:id (soft disable)
// ────────────────────────────────────────────────────────────────────────────────

describe("DELETE /menu-categories/:id", () => {
  test("admin can disable a category", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 });
    const res = await request(app).delete("/menu-categories/1").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/disabled/i);
  });

  test("returns 404 when category not found", async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).delete("/menu-categories/999").set(auth(adminToken));
    expect(res.status).toBe(404);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).delete("/menu-categories/1").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).delete("/menu-categories/1");
    expect(res.status).toBe(401);
  });
});
