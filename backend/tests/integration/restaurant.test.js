import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

jest.mock("../../src/config/db.js");

const pool = require("../../src/config/db.js").default;
import restaurantRouter from "../../src/routes/restaurant.js";

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
app.use("/restaurant", restaurantRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ message: err.message }));

const mockRestaurant = {
  id: 1, name: "KangFood", phone: "0400111222", email: "owner@kangfood.com",
  address: "123 Main St", logo_url: null, currency: "₹",
  receipt_footer: "Thank you", subscription_status: "active",
};

beforeEach(() => pool.query.mockReset());

// ────────────────────────────────────────────────────────────────────────────────
// GET /restaurant/info
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /restaurant/info", () => {
  test("returns restaurant info for authenticated user", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockRestaurant] });
    const res = await request(app).get("/restaurant/info").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("KangFood");
  });

  test("STAFF can also fetch restaurant info", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockRestaurant] });
    const res = await request(app).get("/restaurant/info").set(auth(staffToken));
    expect(res.status).toBe(200);
  });

  test("returns 404 when restaurant not found", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/restaurant/info").set(auth(adminToken));
    expect(res.status).toBe(404);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/restaurant/info");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// PUT /restaurant/info
// ────────────────────────────────────────────────────────────────────────────────

describe("PUT /restaurant/info", () => {
  const validPayload = {
    name: "KangFood Updated",
    phone: "0400111222",
    email: "owner@kangfood.com",
    currency: "₹",
  };

  const makeUpdateClient = ({ notFound = false } = {}) => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                                        // BEGIN
      .mockResolvedValueOnce({ rows: notFound ? [] : [{ ...mockRestaurant, name: validPayload.name }] }) // UPDATE
      .mockResolvedValue(undefined),                                           // COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn().mockResolvedValue(makeUpdateClient());
  });

  test("admin can update restaurant info (returns 200)", async () => {
    const res = await request(app)
      .put("/restaurant/info")
      .set(auth(adminToken))
      .send(validPayload);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("KangFood Updated");
  });

  test("STAFF cannot update restaurant info (admin only)", async () => {
    const res = await request(app)
      .put("/restaurant/info")
      .set(auth(staffToken))
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  test("returns 400 when name is missing", async () => {
    const res = await request(app)
      .put("/restaurant/info")
      .set(auth(adminToken))
      .send({ phone: "0400111222" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name required/i);
  });

  test("returns 400 for invalid email", async () => {
    const res = await request(app)
      .put("/restaurant/info")
      .set(auth(adminToken))
      .send({ ...validPayload, email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid email/i);
  });

  test("returns 400 for too-short phone number", async () => {
    const res = await request(app)
      .put("/restaurant/info")
      .set(auth(adminToken))
      .send({ ...validPayload, phone: "123" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid phone/i);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).put("/restaurant/info").send(validPayload);
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /restaurant/settings
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /restaurant/settings", () => {
  test("returns settings when found", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ restaurant_id: 1, use_business_day: true, enable_partners: false }],
    });
    const res = await request(app).get("/restaurant/settings").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.use_business_day).toBe(true);
  });

  test("returns empty object when no settings row exists", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/restaurant/settings").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/restaurant/settings");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// PUT /restaurant/settings
// ────────────────────────────────────────────────────────────────────────────────

describe("PUT /restaurant/settings", () => {
  const validSettings = {
    use_business_day: true,
    enable_cash_recount: true,
    allow_staff_print: true,
    enable_vendor_ledger: true,
    enable_customer_ledger: true,
    enable_whatsapp: false,
    enable_email: false,
    enable_partners: false,
  };

  test("saves settings via upsert and returns result", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ restaurant_id: 1, ...validSettings }] });
    const res = await request(app)
      .put("/restaurant/settings")
      .set(auth(adminToken))
      .send(validSettings);
    expect(res.status).toBe(200);
    expect(res.body.use_business_day).toBe(true);
  });

  test("STAFF cannot update settings (admin only)", async () => {
    const res = await request(app)
      .put("/restaurant/settings")
      .set(auth(staffToken))
      .send(validSettings);
    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).put("/restaurant/settings").send(validSettings);
    expect(res.status).toBe(401);
  });
});
