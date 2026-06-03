import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");

const pool = require("../../src/config/db.js").default;
import combosRouter from "../../src/routes/combos.js";

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
app.use("/combos", combosRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

beforeEach(() => pool.query.mockReset());

const mockCombo = { id: 1, name: "Family Bundle", combo_type: "bundle", bundle_price: "599" };

// ────────────────────────────────────────────────────────────────────────────────
// GET /combos
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /combos", () => {
  test("returns combo list with items and tiers", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [mockCombo] })                              // combos
      .mockResolvedValueOnce({ rows: [{ combo_id: 1, menu_item_id: 5, quantity: 2, menu_item_name: "Burger", item_price: "150" }] }) // items
      .mockResolvedValueOnce({ rows: [{ combo_id: 1, id: 10, quantity: 2, price: "200" }] }); // tiers

    // Promise.all fires two queries simultaneously — the mocks above must cover them
    // In Jest, mockResolvedValueOnce is consumed in FIFO order, but Promise.all queries
    // run concurrently. The third mock covers either the items or tiers query.
    const res = await request(app).get("/combos").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe("Family Bundle");
    expect(Array.isArray(res.body[0].items)).toBe(true);
  });

  test("returns empty array when no active combos", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/combos").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("STAFF can list combos", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/combos").set(auth(staffToken));
    expect(res.status).toBe(200);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/combos");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /combos — create bundle combo
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /combos", () => {
  const validBundle = {
    name: "Family Bundle",
    combo_type: "bundle",
    bundle_price: 599,
    items: [{ menu_item_id: 5, quantity: 2 }],
    tiers: [],
  };

  const makeCreateClient = () => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                              // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })                  // INSERT combos
      .mockResolvedValueOnce({ rows: [] })                           // INSERT combo_items
      .mockResolvedValue(undefined),                                  // COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    // menu item validation uses pool.query directly (not a transaction)
    pool.query.mockResolvedValue({ rows: [{ id: 5 }] }); // menu item check
    pool.connect = jest.fn().mockResolvedValue(makeCreateClient());
  });

  test("admin creates a bundle combo (returns 201)", async () => {
    const res = await request(app)
      .post("/combos")
      .set(auth(adminToken))
      .send(validBundle);
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(1);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .post("/combos")
      .set(auth(staffToken))
      .send(validBundle);
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/combos").send(validBundle);
    expect(res.status).toBe(401);
  });

  test("returns 400 when name is missing", async () => {
    const res = await request(app)
      .post("/combos")
      .set(auth(adminToken))
      .send({ ...validBundle, name: "" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name is required/i);
  });

  test("returns 400 when items array is empty", async () => {
    const res = await request(app)
      .post("/combos")
      .set(auth(adminToken))
      .send({ ...validBundle, items: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least one item/i);
  });

  test("returns 400 for volume combo with no tiers", async () => {
    const res = await request(app)
      .post("/combos")
      .set(auth(adminToken))
      .send({ name: "Vol Deal", combo_type: "volume", items: [{ menu_item_id: 5 }], tiers: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/pricing tier/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// PUT /combos/:id
// ────────────────────────────────────────────────────────────────────────────────

describe("PUT /combos/:id", () => {
  const updatePayload = {
    name: "Updated Bundle",
    combo_type: "bundle",
    bundle_price: 699,
    items: [{ menu_item_id: 5, quantity: 2 }],
    tiers: [],
  };

  const makeUpdateClient = ({ notFound = false } = {}) => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                              // BEGIN
      .mockResolvedValueOnce({ rows: [] })                           // UPDATE combos
      .mockResolvedValueOnce({ rows: [] })                           // DELETE combo_items
      .mockResolvedValueOnce({ rows: [] })                           // INSERT combo_items
      .mockResolvedValueOnce({ rows: [] })                           // DELETE combo_tiers
      .mockResolvedValue(undefined),                                  // COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // existing combo check
      .mockResolvedValue({ rows: [{ id: 5 }] });      // menu item check
    pool.connect = jest.fn().mockResolvedValue(makeUpdateClient());
  });

  test("admin can update a combo", async () => {
    const res = await request(app)
      .put("/combos/1")
      .set(auth(adminToken))
      .send(updatePayload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("returns 404 when combo not found", async () => {
    pool.query.mockReset();
    pool.query.mockResolvedValueOnce({ rows: [] }); // combo not found
    const res = await request(app)
      .put("/combos/999")
      .set(auth(adminToken))
      .send(updatePayload);
    expect(res.status).toBe(404);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .put("/combos/1")
      .set(auth(staffToken))
      .send(updatePayload);
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).put("/combos/1").send(updatePayload);
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// DELETE /combos/:id
// ────────────────────────────────────────────────────────────────────────────────

describe("DELETE /combos/:id", () => {
  test("admin can disable a combo", async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const res = await request(app).delete("/combos/1").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("returns 404 when combo not found", async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const res = await request(app).delete("/combos/999").set(auth(adminToken));
    expect(res.status).toBe(404);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app).delete("/combos/1").set(auth(staffToken));
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).delete("/combos/1");
    expect(res.status).toBe(401);
  });
});
