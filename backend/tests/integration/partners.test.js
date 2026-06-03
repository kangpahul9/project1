import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import partnersRouter from "../../src/routes/partners.js";

// Mock the pool so no real DB is needed
jest.mock("../../src/config/db.js");
const pool = require("../../src/config/db.js").default;

const SECRET = process.env.JWT_SECRET;
const adminToken = jwt.sign(
  { id: 1, restaurantId: 1, role: "ADMIN" },
  SECRET,
  { expiresIn: "1h", issuer: "kangpos", audience: "kangpos-users" }
);
const staffToken = jwt.sign(
  { id: 2, restaurantId: 1, role: "STAFF" },
  SECRET,
  { expiresIn: "1h", issuer: "kangpos", audience: "kangpos-users" }
);

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.log = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  next();
});
app.use("/partners", partnersRouter);
app.use((err, _req, res, _next) => {
  res.status(err.status || 400).json({ message: err.message });
});

const mockPartner = { id: 1, name: "Alice", phone: "0400000001", email: "alice@test.com", share_percent: 30, restaurant_id: 1 };

describe("GET /partners", () => {
  test("returns partner list for authenticated user", async () => {
    pool.query.mockResolvedValueOnce({ rows: [mockPartner] });

    const res = await request(app).get("/partners").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Alice");
  });

  test("returns 401 without token", async () => {
    const res = await request(app).get("/partners");
    expect(res.status).toBe(401);
  });
});

describe("POST /partners", () => {
  const mockClientFactory = ({ existingPartner = null, currentTotal = 0 } = {}) => ({
    query: jest.fn()
      .mockResolvedValueOnce(undefined)                               // BEGIN
      .mockResolvedValueOnce({ rows: existingPartner ? [existingPartner] : [] }) // check existing
      .mockResolvedValueOnce({ rows: [{ total: currentTotal }] })     // SUM share_percent
      .mockResolvedValueOnce({ rows: [mockPartner] })                 // INSERT
      .mockResolvedValueOnce(undefined),                              // COMMIT
    release: jest.fn(),
  });

  beforeEach(() => {
    pool.connect = jest.fn();
  });

  test("creates a partner successfully", async () => {
    pool.connect.mockResolvedValue(mockClientFactory());

    const res = await request(app)
      .post("/partners")
      .set(auth(adminToken))
      .send({ name: "Alice", phone: "0400000001", email: "alice@test.com", share_percent: 30, idempotencyKey: "key-1" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Alice");
  });

  test("returns 403 for STAFF role", async () => {
    const res = await request(app)
      .post("/partners")
      .set(auth(staffToken))
      .send({ name: "Bob", share_percent: 20, idempotencyKey: "key-2" });

    expect(res.status).toBe(403);
  });

  test("returns 401 without token", async () => {
    const res = await request(app)
      .post("/partners")
      .send({ name: "Bob", share_percent: 20, idempotencyKey: "key-3" });

    expect(res.status).toBe(401);
  });

  test("rejects duplicate partner name", async () => {
    pool.connect.mockResolvedValue(
      mockClientFactory({ existingPartner: mockPartner })
    );

    const res = await request(app)
      .post("/partners")
      .set(auth(adminToken))
      .send({ name: "Alice", share_percent: 30, idempotencyKey: "key-4" });

    expect(res.status).toBe(400);
  });

  test("rejects when total share would exceed 100%", async () => {
    pool.connect.mockResolvedValue(
      mockClientFactory({ currentTotal: 80 })
    );

    const res = await request(app)
      .post("/partners")
      .set(auth(adminToken))
      .send({ name: "Carol", share_percent: 30, idempotencyKey: "key-5" });

    expect(res.status).toBe(400);
  });

  test("requires idempotency key", async () => {
    pool.connect.mockResolvedValue(mockClientFactory());

    const res = await request(app)
      .post("/partners")
      .set(auth(adminToken))
      .send({ name: "Dave", share_percent: 10 });

    expect(res.status).toBe(400);
  });

  test("requires name", async () => {
    pool.connect.mockResolvedValue(mockClientFactory());

    const res = await request(app)
      .post("/partners")
      .set(auth(adminToken))
      .send({ share_percent: 10, idempotencyKey: "key-6" });

    expect(res.status).toBe(400);
  });
});

describe("PUT /partners/:id", () => {
  test("updates partner as admin", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ ...mockPartner, share_percent: 40 }] })
        .mockResolvedValueOnce(undefined),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);

    const res = await request(app)
      .put("/partners/1")
      .set(auth(adminToken))
      .send({ name: "Alice", share_percent: 40, phone: "0400000001", email: "alice@test.com" });

    expect(res.status).toBe(200);
    expect(res.body.share_percent).toBe(40);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .put("/partners/1")
      .set(auth(staffToken))
      .send({ name: "Alice", share_percent: 40 });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /partners/:id", () => {
  test("deletes partner and clears FK references", async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);

    const res = await request(app)
      .delete("/partners/1")
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("returns 403 for STAFF", async () => {
    const res = await request(app)
      .delete("/partners/1")
      .set(auth(staffToken));

    expect(res.status).toBe(403);
  });
});
