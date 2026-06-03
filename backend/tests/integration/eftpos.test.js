import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

// Must be set before any module import that uses fetch
global.fetch = jest.fn();

jest.mock("../../src/config/db.js");

const pool = require("../../src/config/db.js").default;
import eftposRouter from "../../src/routes/eftpos.js";

const SECRET = process.env.JWT_SECRET;
const adminToken = jwt.sign({ id: 1, restaurantId: 1, role: "ADMIN" }, SECRET, {
  expiresIn: "1h", issuer: "kangpos", audience: "kangpos-users",
});
const auth = (t) => ({ Authorization: `Bearer ${t}` });

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.log = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  next();
});
app.use("/eftpos", eftposRouter);
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ error: err.message }));

const tyroSettings = {
  eftpos_provider: "tyro",
  eftpos_api_key: "test_api_key",
  eftpos_merchant_id: "MERCH001",
  eftpos_terminal_id: "TERM001",
};

const linklySettings = {
  eftpos_provider: "linkly",
  eftpos_api_key: "linkly_bearer_token",
  eftpos_merchant_id: null,
  eftpos_terminal_id: "TERM002",
};

beforeEach(() => {
  pool.query.mockReset();
  global.fetch.mockReset();
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /eftpos/config
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /eftpos/config", () => {
  test("returns configured:true when settings are complete", async () => {
    pool.query.mockResolvedValueOnce({ rows: [tyroSettings] });
    const res = await request(app).get("/eftpos/config").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
    expect(res.body.provider).toBe("tyro");
  });

  test("returns configured:false when no settings row", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get("/eftpos/config").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
    expect(res.body.provider).toBeNull();
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/eftpos/config");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// POST /eftpos/charge
// ────────────────────────────────────────────────────────────────────────────────

describe("POST /eftpos/charge", () => {
  test("returns 400 when amountCents is missing", async () => {
    const res = await request(app)
      .post("/eftpos/charge")
      .set(auth(adminToken))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid amount/i);
  });

  test("returns 400 when amountCents is zero", async () => {
    const res = await request(app)
      .post("/eftpos/charge")
      .set(auth(adminToken))
      .send({ amountCents: 0 });
    expect(res.status).toBe(400);
  });

  test("returns 503 when eftpos provider not configured", async () => {
    pool.query.mockResolvedValueOnce({ rows: [{}] }); // empty settings
    const res = await request(app)
      .post("/eftpos/charge")
      .set(auth(adminToken))
      .send({ amountCents: 1000 });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });

  test("returns 503 when eftpos api key is missing", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ eftpos_provider: "tyro", eftpos_api_key: null }],
    });
    const res = await request(app)
      .post("/eftpos/charge")
      .set(auth(adminToken))
      .send({ amountCents: 1000 });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/api key missing/i);
  });

  test("initiates Tyro transaction and returns transactionId", async () => {
    pool.query.mockResolvedValueOnce({ rows: [tyroSettings] });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ transactionId: "TYRO_TX_001" }),
    });

    const res = await request(app)
      .post("/eftpos/charge")
      .set(auth(adminToken))
      .send({ amountCents: 2500 });
    expect(res.status).toBe(200);
    expect(res.body.transactionId).toBe("TYRO_TX_001");
    expect(res.body.provider).toBe("tyro");
  });

  test("initiates Linkly transaction and returns transactionId", async () => {
    pool.query.mockResolvedValueOnce({ rows: [linklySettings] });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const res = await request(app)
      .post("/eftpos/charge")
      .set(auth(adminToken))
      .send({ amountCents: 3000 });
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe("linkly");
    expect(typeof res.body.transactionId).toBe("string");
  });

  test("returns 400 for unknown eftpos provider", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ eftpos_provider: "unknown_vendor", eftpos_api_key: "key" }],
    });
    const res = await request(app)
      .post("/eftpos/charge")
      .set(auth(adminToken))
      .send({ amountCents: 1000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unknown/i);
  });

  test("propagates fetch error when Tyro API returns non-ok", async () => {
    pool.query.mockResolvedValueOnce({ rows: [tyroSettings] });
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: "Unauthorized" }),
    });

    const res = await request(app)
      .post("/eftpos/charge")
      .set(auth(adminToken))
      .send({ amountCents: 1000 });
    expect(res.status).toBe(400);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).post("/eftpos/charge").send({ amountCents: 1000 });
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// GET /eftpos/status/:transactionId
// ────────────────────────────────────────────────────────────────────────────────

describe("GET /eftpos/status/:transactionId", () => {
  test("returns APPROVED status from Tyro poll", async () => {
    pool.query.mockResolvedValueOnce({ rows: [tyroSettings] });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "APPROVED" }),
    });

    const res = await request(app)
      .get("/eftpos/status/TYRO_TX_001")
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
  });

  test("returns APPROVED status from Linkly poll", async () => {
    pool.query.mockResolvedValueOnce({ rows: [linklySettings] });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Response: { ResponseCode: "00" } }),
    });

    const res = await request(app)
      .get("/eftpos/status/pos_12345")
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
  });

  test("returns PENDING status from Linkly poll when response code is blank", async () => {
    pool.query.mockResolvedValueOnce({ rows: [linklySettings] });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Response: { ResponseCode: "" } }),
    });

    const res = await request(app)
      .get("/eftpos/status/pos_12345")
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("PENDING");
  });

  test("returns 503 when not configured", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get("/eftpos/status/TX_001")
      .set(auth(adminToken));
    expect(res.status).toBe(503);
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/eftpos/status/TX_001");
    expect(res.status).toBe(401);
  });
});
